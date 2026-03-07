"""
Train learned router on experiment records: features -> P(correct), select argmax.
Saves router.pkl and feature_metadata.json to cortex/models/.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from . import database
from .routing import FEATURE_ORDER, build_feature_vector

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
ROUTER_ARTIFACT = MODELS_DIR / "router.pkl"
ROUTER_METADATA = MODELS_DIR / "router_metadata.json"

RANDOM_SEED = 42


def _feature_vector_from_record(
    record: dict,
    model_to_idx: dict[str, int],
    models: list[str],
) -> np.ndarray:
    """Build feature vector via shared builder so training matches inference."""
    raw = float(record.get("raw_confidence", 0.0))
    model_name = record.get("model_name", "")
    try:
        fj = record.get("feature_json")
        d = json.loads(fj) if isinstance(fj, str) else (fj or {})
    except (json.JSONDecodeError, TypeError):
        d = {}
    latency_ms = float(record.get("latency_ms") or 0.0)
    token_count = float(record.get("token_count") or 0.0)
    return build_feature_vector(raw, model_name, d, latency_ms, token_count, model_to_idx, models)


def train_router(
    *,
    db_path: str | None = None,
    split: str = "train",
    dataset_name: str | None = None,
    C: float = 1.0,
    max_iter: int = 500,
) -> dict[str, object]:
    """
    Load train split, build feature matrix and labels, fit LogisticRegression, save artifact and metadata.
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
        return {"error": f"No records for split={split}", "fitted": False}
    models = sorted({r["model_name"] for r in records})
    model_to_idx = {m: i for i, m in enumerate(models)}
    X_list = []
    y_list = []
    for r in records:
        vec = _feature_vector_from_record(r, model_to_idx, models)
        X_list.append(vec)
        y_list.append(int(r["correct"]))
    X = np.array(X_list)
    y = np.array(y_list)
    n_features = X.shape[1]
    # Assert dimension and export canonical order (matches routing.FEATURE_ORDER + one-hot + latency, tokens)
    expected_dim = len(FEATURE_ORDER) + len(models) + 2
    assert n_features == expected_dim, f"Feature dimension {n_features} != expected {expected_dim}"
    feature_names = (
        list(FEATURE_ORDER)
        + [f"model_{m}" for m in models]
        + ["latency_ms", "token_count"]
    )
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    clf = LogisticRegression(C=C, max_iter=max_iter, random_state=RANDOM_SEED)
    clf.fit(X_scaled, y)
    # Save with pickle
    import pickle
    artifact = {"scaler": scaler, "clf": clf, "model_to_idx": model_to_idx, "models": models}
    with open(ROUTER_ARTIFACT, "wb") as f:
        pickle.dump(artifact, f)
    metadata = {
        "feature_order": FEATURE_ORDER,
        "feature_names": feature_names,
        "n_features": n_features,
        "models": models,
        "n_samples": len(records),
        "dataset": dataset_name,
        "split": split,
        "random_state": RANDOM_SEED,
    }
    with open(ROUTER_METADATA, "w") as f:
        json.dump(metadata, f, indent=2)
    return {"fitted": True, "n_samples": len(records), "n_models": len(models), "metadata_path": str(ROUTER_METADATA)}


if __name__ == "__main__":
    import sys

    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    out = train_router(db_path=db_path)
    print(json.dumps(out, indent=2))
