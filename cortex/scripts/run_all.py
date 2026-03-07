#!/usr/bin/env python3
"""
Reproducible pipeline: run_experiment -> train_temperature -> train_router -> evaluate.
Sets random seeds (Python, numpy, sklearn) and writes them to metrics.json.
Usage (from repo root): python cortex/scripts/run_all.py [dataset_path] [db_path]
       or from cortex/:  python scripts/run_all.py [dataset_path] [db_path]
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure backend is importable (run from repo root or from cortex/)
_CORTEX_ROOT = Path(__file__).resolve().parent.parent
if str(_CORTEX_ROOT) not in sys.path:
    sys.path.insert(0, str(_CORTEX_ROOT))

# Set seeds before any other imports that use randomness
RANDOM_SEED = 42
os.environ["PYTHONHASHSEED"] = str(RANDOM_SEED)

import random
random.seed(RANDOM_SEED)

import numpy as np
np.random.seed(RANDOM_SEED)


def main() -> None:
    dataset_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else str(_CORTEX_ROOT / "datasets" / "sample.json")
    )
    db_path = sys.argv[2] if len(sys.argv) > 2 else None
    if db_path:
        os.environ["CORTEX_DB_PATH"] = db_path

    run_id = Path(dataset_path).stem + "_run"
    output_dir = str(_CORTEX_ROOT / "experiments")

    # (a) Collect records
    from backend.experiment_runner import run_experiment
    out_exp = run_experiment(
        dataset_path,
        output_dir=output_dir,
        db_path=db_path,
        dataset_name=Path(dataset_path).stem,
        seed=RANDOM_SEED,
    )
    if out_exp.get("error"):
        print("experiment_runner failed:", out_exp)
        sys.exit(1)
    print("Experiment records:", out_exp.get("n_records", 0))

    # (b) Train temperature scaling
    from backend.calibration_train import train_temperature
    out_cal = train_temperature(db_path=db_path, split="val", dataset_name=out_exp.get("dataset_name"))
    if out_cal.get("error"):
        print("calibration_train warning:", out_cal)
    else:
        print("Calibration temperature:", out_cal.get("temperature"))

    # (c) Train router
    from backend.router_train import train_router
    out_router = train_router(db_path=db_path, split="train", dataset_name=out_exp.get("dataset_name"))
    if out_router.get("error"):
        print("router_train warning:", out_router)
    else:
        print("Router fitted:", out_router.get("fitted"))

    # (d) Evaluate
    from backend.evaluate import run_evaluate
    out_eval = run_evaluate(
        db_path=db_path,
        dataset_name=out_exp.get("dataset_name"),
        output_dir=output_dir,
        run_id=run_id,
    )
    if out_eval.get("error"):
        print("evaluate failed:", out_eval)
        sys.exit(1)
    metrics = out_eval.get("metrics", {})
    metrics["random_seed"] = RANDOM_SEED
    metrics["dataset_path"] = dataset_path
    out_dir = out_eval.get("output_dir", output_dir + "/" + run_id)
    with open(Path(out_dir) / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("Metrics:", json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
