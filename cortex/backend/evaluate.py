"""
Evaluate on held-out test split: baseline vs routed accuracy, calibration before/after, bootstrap CI, plots.
Writes cortex/experiments/<run_id>/metrics.json, reliability_*.json, and PNGs.
"""
from __future__ import annotations

import json
import os
import pickle
from pathlib import Path
from typing import Any

import numpy as np

from . import database
from .calibration import (
    apply_temperature_to_confidence,
    brier_score,
    expected_calibration_error,
    reliability_diagram_bins_detailed,
)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CALIBRATION_ARTIFACT = MODELS_DIR / "calibration.json"
ROUTER_ARTIFACT = MODELS_DIR / "router.pkl"

RANDOM_SEED = 42
N_BOOTSTRAP = 1000


def _load_calibration() -> dict[str, Any] | None:
    if not CALIBRATION_ARTIFACT.exists():
        return None
    with open(CALIBRATION_ARTIFACT) as f:
        return json.load(f)


def _load_router():
    if not ROUTER_ARTIFACT.exists():
        return None
    with open(ROUTER_ARTIFACT, "rb") as f:
        return pickle.load(f)


def _router_predict_proba(artifact: dict, record: dict, model_to_idx: dict, models: list) -> float:
    """Predict P(correct) for one record using saved router (shared build_feature_vector)."""
    from .router_train import _feature_vector_from_record

    vec = _feature_vector_from_record(record, model_to_idx, models).reshape(1, -1)
    X = artifact["scaler"].transform(vec)
    return float(artifact["clf"].predict_proba(X)[0, 1])


def _get_ollama_version() -> str:
    """Record ollama --version once per run for reproducibility; return 'unknown' if unavailable."""
    import subprocess
    try:
        out = subprocess.run(
            ["ollama", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode == 0 and out.stdout:
            return out.stdout.strip()
        if out.stderr:
            return out.stderr.strip() or "unknown"
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass
    return "unknown"


def run_evaluate(
    *,
    db_path: str | None = None,
    dataset_name: str | None = None,
    output_dir: str | None = None,
    run_id: str | None = None,
    split_seed: int | None = None,
    split_rule: str | None = None,
) -> dict[str, Any]:
    """
    Load test split, compute baseline / routed / oracle accuracy, routing lift with bootstrap 95% CI
    over prompts, ECE/Brier, reliability diagrams. Writes bootstrap_seed, n_bootstrap, models,
    ollama_version, split_seed, split_rule into metrics.json.
    """
    if db_path:
        os.environ["CORTEX_DB_PATH"] = db_path
    with database.get_connection() as conn:
        database.init_schema(conn)
        records = database.load_experiment_records(
            conn, split="test", dataset_name=dataset_name
        )
    if not records:
        return {"error": "No test records", "metrics": {}}

    run_id = run_id or "default"
    out_dir = Path(output_dir or "cortex/experiments") / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    cal = _load_calibration()
    T = float(cal["temperature"]) if cal else 1.0
    router = _load_router()

    # Group by prompt_id to get "first model" and "router choice" per prompt
    by_prompt: dict[int, list[dict]] = {}
    for r in records:
        pid = r["prompt_id"]
        if pid not in by_prompt:
            by_prompt[pid] = []
        by_prompt[pid].append(dict(r))

    baseline_correct = []
    routed_correct = []
    oracle_correct = []
    all_raw = []
    all_calibrated = []
    all_correct = []
    models_list = sorted({r["model_name"] for r in records})

    for pid, recs in by_prompt.items():
        if not recs:
            continue
        # Baseline: first model (by order in list; assume consistent order)
        first = recs[0]
        baseline_correct.append(first["correct"] == 1)
        # Oracle: max correct over models for this prompt
        oracle_correct.append(max(r["correct"] for r in recs) == 1)
        for r in recs:
            all_raw.append(r["raw_confidence"])
            cal_conf = apply_temperature_to_confidence(r["raw_confidence"], T)
            all_calibrated.append(cal_conf)
            all_correct.append(r["correct"] == 1)
        # Routed: if router exists, pick argmax P(correct); else pick first
        if router:
            model_to_idx = router.get("model_to_idx", {})
            models = router.get("models", [])
            probs = [_router_predict_proba(router, r, model_to_idx, models) for r in recs]
            best_idx = int(np.argmax(probs))
            routed_correct.append(recs[best_idx]["correct"] == 1)
        else:
            routed_correct.append(first["correct"] == 1)

    n_test = len(baseline_correct)
    baseline_acc = np.mean(baseline_correct)
    routed_acc = np.mean(routed_correct)
    oracle_acc = np.mean(oracle_correct)
    routing_lift = routed_acc - baseline_acc
    routed_oracle_ratio = float(routed_acc / oracle_acc) if oracle_acc > 0 else 0.0
    baseline_oracle_ratio = float(baseline_acc / oracle_acc) if oracle_acc > 0 else 0.0

    # Bootstrap 95% CI over prompts (sampling unit = prompt_id)
    rng = np.random.default_rng(RANDOM_SEED)
    lifts = []
    for _ in range(N_BOOTSTRAP):
        idx = rng.integers(0, n_test, size=n_test)
        b = np.mean([baseline_correct[i] for i in idx])
        r = np.mean([routed_correct[i] for i in idx])
        lifts.append(r - b)
    lifts = np.array(lifts)
    ci_low = float(np.percentile(lifts, 2.5))
    ci_high = float(np.percentile(lifts, 97.5))

    ece_before = expected_calibration_error(all_raw, all_correct)
    ece_after = expected_calibration_error(all_calibrated, all_correct)
    brier_before = brier_score(all_raw, all_correct)
    brier_after = brier_score(all_calibrated, all_correct)

    bins_before = reliability_diagram_bins_detailed(all_raw, all_correct)
    bins_after = reliability_diagram_bins_detailed(all_calibrated, all_correct)

    reliability_before = [
        {"bin_center": c, "confidence": avg_c, "accuracy": a, "count": k}
        for c, avg_c, a, k in bins_before
    ]
    reliability_after = [
        {"bin_center": c, "confidence": avg_c, "accuracy": a, "count": k}
        for c, avg_c, a, k in bins_after
    ]

    ollama_version = _get_ollama_version()
    metrics = {
        "baseline_accuracy": float(baseline_acc),
        "routed_accuracy": float(routed_acc),
        "oracle_accuracy": float(oracle_acc),
        "routed_oracle_ratio": routed_oracle_ratio,
        "baseline_oracle_ratio": baseline_oracle_ratio,
        "routing_lift": float(routing_lift),
        "routing_lift_ci_95": [ci_low, ci_high],
        "ece_before": float(ece_before),
        "ece_after": float(ece_after),
        "brier_before": float(brier_before),
        "brier_after": float(brier_after),
        "n_test": n_test,
        "temperature": T,
        "random_seed": RANDOM_SEED,
        "bootstrap_seed": RANDOM_SEED,
        "n_bootstrap": N_BOOTSTRAP,
        "split_seed": split_seed,
        "split_rule": split_rule,
        "models": models_list,
        "ollama_version": ollama_version,
    }

    with open(out_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(out_dir / "reliability_before.json", "w") as f:
        json.dump(reliability_before, f, indent=2)
    with open(out_dir / "reliability_after.json", "w") as f:
        json.dump(reliability_after, f, indent=2)

    # Plots
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        pass
    else:
        for name, bins, fname in [
            ("Before temperature scaling", bins_before, "reliability_diagram_before.png"),
            ("After temperature scaling", bins_after, "reliability_diagram_after.png"),
        ]:
            centers = [b[0] for b in bins]
            avg_confs = [b[1] for b in bins]
            accs = [b[2] for b in bins]
            counts = [b[3] for b in bins]
            fig, ax = plt.subplots()
            ax.bar(centers, accs, width=0.08, alpha=0.7, label="Accuracy")
            ax.plot(centers, avg_confs, "o-", alpha=0.6, label="Avg confidence")
            ax.plot([0, 1], [0, 1], "k--", alpha=0.5, label="Perfect")
            ax.set_xlabel("Confidence")
            ax.set_ylabel("Accuracy")
            ax.set_title(name)
            ax.legend()
            ax.set_xlim(0, 1)
            ax.set_ylim(0, 1)
            fig.savefig(out_dir / fname, dpi=150, bbox_inches="tight")
            plt.close()

    return {"metrics": metrics, "output_dir": str(out_dir)}


if __name__ == "__main__":
    import sys
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    out = run_evaluate(db_path=db_path)
    print(json.dumps(out.get("metrics", out), indent=2))
