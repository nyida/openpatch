"""
Score responses: load JSONL, parse outputs, compute stability/accuracy/invalid rate,
bootstrap CIs, write metrics.csv and bootstrap_results.json.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from tqdm import tqdm

from src.bootstrap import bootstrap_results_per_model
from src.metrics import (
    _parsed_value_to_label,
    accuracy,
    deterministic_stability,
    invalid_rate,
    jensen_shannon_stability,
    jensen_shannon_stability_parsed,
    parsed_label_stability,
    stability_accuracy_spearman,
)
from src.parser import parse_response
from src.prompt_loader import load_prompts
from src.utils import ensure_dir, load_yaml, write_json_snapshot


def _load_jsonl(path: Path) -> list[dict]:
    """Load JSONL file; return list of records. Skip malformed lines."""
    out = []
    if not path.exists():
        return out
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def _build_ground_truth(prompts: list[dict]) -> dict[str, str]:
    """base_id -> ground_truth."""
    return {p["base_id"]: p["ground_truth"] for p in prompts}


def run_scoring(config_path: str) -> None:
    """Load config and log; parse; compute metrics; write metrics.csv and bootstrap_results.json."""
    config = load_yaml(config_path)
    config_dir = Path(config_path).resolve().parent.parent
    log_path = config_dir / config["output"]["log_path"]
    results_path = config_dir / config["output"]["results_path"]
    prompts_path = config_dir / "prompts" / "prompts.json"
    bootstrap_iter = config["bootstrap"]["iterations"]
    confidence_level = config["bootstrap"]["confidence_level"]

    ensure_dir(results_path)
    prompts = load_prompts(prompts_path)
    gt_map = _build_ground_truth(prompts)
    records = _load_jsonl(log_path)

    # Group: model -> base_id -> temp -> variant_id -> [(sample_index, seed, response)]
    # Order by sample_index (if present) else seed so list order is deterministic.
    structure: dict[str, dict[str, dict[str, dict[str, list[tuple[int | None, int, str]]]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    )
    for rec in tqdm(records, desc="Grouping responses"):
        model = rec.get("model")
        base_id = rec.get("base_id")
        variant_id = rec.get("variant_id")
        temp = rec.get("temperature")
        sample_index = rec.get("sample_index")
        seed = rec.get("seed", 0)
        failure = rec.get("failure")
        response = rec.get("response", "") if not failure else ""
        if model is None or base_id is None or variant_id is None or temp is None:
            continue
        structure[model][base_id][temp][variant_id].append((sample_index, seed, response))

    def _ordered_responses(tuples: list[tuple[int | None, int, str]]) -> list[str]:
        """Sort by sample_index (if present) then seed for canonical sample order; return response list."""
        sorted_t = sorted(tuples, key=lambda x: (x[0] is not None, x[0] if x[0] is not None else 0, x[1]))
        return [t[2] for t in sorted_t]

    # Compute per (model, base_id, temp): raw + parsed stability, accuracy, invalid_rate
    rows: list[dict] = []
    per_model_stability: dict[str, list[float]] = defaultdict(list)
    per_model_stability_per_item: dict[str, list[float]] = defaultdict(list)
    per_model_accuracy_per_item: dict[str, list[float]] = defaultdict(list)
    # For Spearman we need one (stability, accuracy) per (model, base_id): average over temps
    per_model_base_stab: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    per_model_base_acc: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    for model in structure:
        for base_id in structure[model]:
            gt = gt_map.get(base_id, "")
            for temp in structure[model][base_id]:
                var_data = structure[model][base_id][temp]
                ordered = [_ordered_responses(var_data[vid]) for vid in sorted(var_data.keys())]
                if not ordered:
                    continue
                n_samples = len(ordered[0])
                if not all(len(r) == n_samples for r in ordered):
                    continue
                variant_responses = ordered
                det_stab = deterministic_stability(variant_responses)
                js_stab = jensen_shannon_stability(variant_responses)
                all_parse_results = []
                all_parsed_values = []
                parsed_labels_per_variant = []
                for rlist in variant_responses:
                    labels = []
                    for resp in rlist:
                        pr = parse_response(resp)
                        all_parse_results.append(pr)
                        if pr.get("valid"):
                            all_parsed_values.append(pr.get("value"))
                        labels.append(_parsed_value_to_label(pr.get("value"), pr.get("valid", False)))
                    parsed_labels_per_variant.append(labels)
                parsed_stab = parsed_label_stability(parsed_labels_per_variant)
                js_stab_parsed = jensen_shannon_stability_parsed(parsed_labels_per_variant)
                acc = accuracy(all_parsed_values, gt) if all_parsed_values else 0.0
                inv = invalid_rate(all_parse_results)
                rows.append({
                    "model": model,
                    "base_id": base_id,
                    "temperature": temp,
                    "deterministic_stability": round(det_stab, 6),
                    "parsed_stability": round(parsed_stab, 6),
                    "js_stability": round(js_stab, 6),
                    "js_stability_parsed": round(js_stab_parsed, 6),
                    "accuracy": round(acc, 6),
                    "invalid_rate": round(inv, 6),
                })
                per_model_stability[model].append(det_stab)
                per_model_base_stab[model][base_id].append(det_stab)
                per_model_base_acc[model][base_id].append(acc)

    for model in per_model_base_stab:
        for base_id in sorted(per_model_base_stab[model].keys()):
            stabs = per_model_base_stab[model][base_id]
            accs = per_model_base_acc[model][base_id]
            per_model_stability_per_item[model].append(sum(stabs) / len(stabs) if stabs else 0.0)
            per_model_accuracy_per_item[model].append(sum(accs) / len(accs) if accs else 0.0)

    # metrics.csv
    csv_path = results_path / "metrics.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("model,base_id,temperature,deterministic_stability,parsed_stability,js_stability,js_stability_parsed,accuracy,invalid_rate\n")
        for r in rows:
            f.write(
                f"{r['model']},{r['base_id']},{r['temperature']},"
                f"{r['deterministic_stability']},{r['parsed_stability']},{r['js_stability']},{r['js_stability_parsed']},"
                f"{r['accuracy']},{r['invalid_rate']}\n"
            )

    # Bootstrap per model (over base items)
    bootstrap_res = bootstrap_results_per_model(
        {m: per_model_stability[m] for m in per_model_stability},
        n_iterations=bootstrap_iter,
        confidence_level=confidence_level,
        random_state=42,
    )
    bootstrap_path = results_path / "bootstrap_results.json"
    write_json_snapshot(bootstrap_res, bootstrap_path)

    # Stability-accuracy Spearman per model
    spearman_per_model = {}
    for model in per_model_stability_per_item:
        rho, p = stability_accuracy_spearman(
            per_model_stability_per_item[model],
            per_model_accuracy_per_item[model],
        )
        spearman_per_model[model] = {"spearman_rho": rho, "p_value": p}
    spearman_path = results_path / "stability_accuracy_spearman.json"
    write_json_snapshot(spearman_per_model, spearman_path)

    print(f"Scoring complete. Metrics: {csv_path}")
    print(f"Bootstrap: {bootstrap_path}")
    print(f"Spearman: {spearman_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Score responses and compute metrics")
    parser.add_argument("--config", required=True, help="Path to main config YAML (e.g. configs/main.yaml)")
    args = parser.parse_args()
    run_scoring(args.config)


if __name__ == "__main__":
    main()
