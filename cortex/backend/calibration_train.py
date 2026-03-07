"""
Train temperature scaling on validation split to minimize ECE.
Saves artifact to cortex/models/calibration.json for use in live /query.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from . import database
from .calibration import (
    apply_temperature_to_confidence,
    expected_calibration_error,
    find_temperature,
    find_temperature_nll,
)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CALIBRATION_ARTIFACT = MODELS_DIR / "calibration.json"
N_BINS = 10


def train_temperature(
    *,
    db_path: str | None = None,
    split: str = "val",
    dataset_name: str | None = None,
    low: float = 0.5,
    high: float = 3.0,
    n_steps: int = 50,
) -> dict[str, object]:
    """
    Load experiment records (raw_confidence, correct) for the calibration split,
    fit temperature T to minimize ECE, save artifact.
    """
    if db_path:
        os.environ["CORTEX_DB_PATH"] = db_path
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with database.get_connection() as conn:
        database.init_schema(conn)
        records = database.load_experiment_records(
            conn, split=split, dataset_name=dataset_name
        )
    if not records:
        return {"error": f"No records for split={split}", "temperature": 1.0}
    confidences = [float(r["raw_confidence"]) for r in records]
    corrects = [bool(r["correct"]) for r in records]
    best_t, best_nll = find_temperature_nll(
        confidences, corrects, low=low, high=high, n_steps=n_steps
    )
    _, best_ece = find_temperature(confidences, corrects, low=low, high=high, n_steps=n_steps)
    artifact = {
        "temperature": best_t,
        "method": "temp_scaling_logit",
        "n_bins": N_BINS,
        "fit_metric": "NLL",
        "fit_nll": best_nll,
        "fit_ece": float(expected_calibration_error(
            [apply_temperature_to_confidence(p, best_t) for p in confidences], corrects
        )),
        "dataset": dataset_name,
        "split": split,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_samples": len(records),
    }
    with open(CALIBRATION_ARTIFACT, "w") as f:
        json.dump(artifact, f, indent=2)
    return artifact


if __name__ == "__main__":
    import sys

    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    out = train_temperature(db_path=db_path)
    print(json.dumps(out, indent=2))
