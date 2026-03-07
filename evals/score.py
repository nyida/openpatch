"""
Score: read app_runs/logs/runs.jsonl (eval records), compute accuracy + invalid rate per mode, write metrics.csv.
Usage: python -m evals.score --config evals/configs/main.yaml
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_yaml(path: Path) -> dict:
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def _normalize(s: str) -> str:
    return (s or "").strip().lower().replace(".", "").replace(",", "")


def _correct(pred: str, gt: str) -> bool:
    return _normalize(pred) == _normalize(gt)


# Parser-based: ANSWER line with value (matches TS hasAnswerFormat)
_ANSWER_LINE = __import__("re").compile(r"(?m)^\s*ANSWER\s*:\s*\S+")


def _has_answer_format(raw: str) -> bool:
    return bool(_ANSWER_LINE.search((raw or "").strip()))


def _invalid_format(record: dict) -> bool:
    """True if parsed_answer is missing/empty or chosen candidate raw fails ANSWER format.
    Guardrails: baseline records may omit judge; we treat chosen_index as 0. If candidates
    is missing or chosen_index is out of range, we treat as invalid (no index error)."""
    out = record.get("outputs") or {}
    parsed = (out.get("parsed_answer") or "").strip()
    if not parsed:
        return True
    cands = out.get("candidates") or []
    judge = out.get("judge") or {}
    idx = judge.get("chosen_index", 0) if judge else 0
    if not cands or idx < 0 or idx >= len(cands):
        return True
    chosen_raw = (cands[idx].get("raw") or "").strip()
    return not _has_answer_format(chosen_raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Score eval runs -> metrics.csv")
    parser.add_argument("--config", required=True, help="Path to config YAML")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = ROOT / config_path
    config = load_yaml(config_path)
    results_dir = Path(config.get("results_dir", "evals/results"))
    if not results_dir.is_absolute():
        results_dir = ROOT / results_dir
    runs_log = config.get("runs_log", "app_runs/logs/runs.jsonl")
    log_path = ROOT / runs_log if not Path(runs_log).is_absolute() else Path(runs_log)
    if not results_dir.is_absolute():
        results_dir = ROOT / results_dir
    results_dir.mkdir(parents=True, exist_ok=True)

    records = []
    if log_path.exists():
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    if rec.get("eval"):
                        records.append(rec)
                except json.JSONDecodeError:
                    continue

    # Per (dataset_id, item_id, mode): one record -> accuracy, invalid
    rows = []
    for rec in records:
        ev = rec.get("eval") or {}
        dataset_id = ev.get("dataset_id", "?")
        item_id = ev.get("item_id", "?")
        mode = rec.get("mode", "?")
        gt = ev.get("ground_truth", "")
        out = rec.get("outputs") or {}
        final = (out.get("final_answer") or "").strip()
        parsed = (out.get("parsed_answer") or "").strip()
        correct = bool(parsed and _correct(parsed, gt))
        invalid = not parsed or _invalid_format(rec)
        latency_ms = rec.get("latency_ms") or 0
        confidence = out.get("confidence")
        if confidence is not None:
            try:
                confidence = float(confidence)
            except (TypeError, ValueError):
                confidence = ""
        else:
            confidence = ""
        rows.append({
            "dataset_id": dataset_id,
            "item_id": item_id,
            "mode": mode,
            "correct": 1 if correct else 0,
            "invalid_format": 1 if invalid else 0,
            "latency_ms": latency_ms,
            "confidence": confidence,
        })

    # Aggregate per mode
    from collections import defaultdict
    by_mode = defaultdict(lambda: {"correct": [], "invalid": [], "latency": [], "confidence": [], "correct_list": []})
    for r in rows:
        by_mode[r["mode"]]["correct"].append(r["correct"])
        by_mode[r["mode"]]["invalid"].append(r["invalid_format"])
        by_mode[r["mode"]]["latency"].append(r["latency_ms"])
        if r.get("confidence") != "" and r.get("confidence") is not None:
            try:
                by_mode[r["mode"]]["confidence"].append(float(r["confidence"]))
                by_mode[r["mode"]]["correct_list"].append(r["correct"])
            except (TypeError, ValueError):
                pass

    metrics_path = results_dir / "metrics.csv"
    with open(metrics_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["dataset_id", "item_id", "mode", "correct", "invalid_format", "latency_ms", "confidence"])
        w.writeheader()
        w.writerows(rows)

    # Summary CSV: mode, accuracy, invalid_rate, mean_latency_ms, ece, brier (when confidence present)
    summary = []
    for mode in sorted(by_mode.keys()):
        c = by_mode[mode]["correct"]
        inv = by_mode[mode]["invalid"]
        lat = by_mode[mode]["latency"]
        conf_list = by_mode[mode]["confidence"]
        correct_list = by_mode[mode]["correct_list"]
        n = len(c) or 1
        row = {
            "mode": mode,
            "accuracy": sum(c) / n,
            "invalid_rate": sum(inv) / n,
            "mean_latency_ms": sum(lat) / n,
            "n": n,
        }
        if conf_list and len(conf_list) == len(correct_list):
            # Brier: mean (confidence - correct)^2
            brier = sum((p - y) ** 2 for p, y in zip(conf_list, correct_list)) / len(conf_list)
            row["brier"] = round(brier, 4)
            # ECE (equal-mass bins): 10 bins by confidence quantiles
            n_bins = min(10, len(conf_list))
            sorted_idx = sorted(range(len(conf_list)), key=lambda i: conf_list[i])
            bin_size = len(sorted_idx) // n_bins
            ece = 0.0
            for b in range(n_bins):
                start = b * bin_size
                end = len(sorted_idx) if b == n_bins - 1 else (b + 1) * bin_size
                idx_bin = sorted_idx[start:end]
                if not idx_bin:
                    continue
                acc_bin = sum(correct_list[i] for i in idx_bin) / len(idx_bin)
                conf_bin = sum(conf_list[i] for i in idx_bin) / len(idx_bin)
                ece += len(idx_bin) * abs(acc_bin - conf_bin)
            ece /= len(conf_list)
            row["ece"] = round(ece, 4)
        else:
            row["ece"] = ""
            row["brier"] = ""
        summary.append(row)
    summary_path = results_dir / "summary_by_mode.csv"
    fieldnames = ["mode", "accuracy", "invalid_rate", "mean_latency_ms", "n", "ece", "brier"]
    with open(summary_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(summary)

    print(f"Wrote {metrics_path} and {summary_path}")


if __name__ == "__main__":
    main()
