"""
CORTEX Experimental Pipeline.
Collects per-(prompt, model) records with raw_confidence, feature_json, correct, and train/val/test split
for calibration and router training. Optionally computes legacy metrics on the full set.
"""
from __future__ import annotations

import json
import os
import random
from pathlib import Path
from typing import Any

from .confidence import (
    estimate_confidence,
    extract_per_response_features,
    features_to_dict,
    build_per_response_feature_json,
)
from .correctness import evaluate_correct
from .database import (
    get_connection,
    init_schema,
    insert_experiment_record,
    insert_query,
    insert_routing,
)
from .inference import run_multi_model_inference, ModelResponse
from .routing import select_best_model_by_confidence

# Reproducibility
RANDOM_SEED = 42


def load_dataset(path: str) -> list[dict[str, Any]]:
    """
    Load dataset from JSON: list of { "id", "prompt", "ground_truth" } or { "question", "answer" }.
    """
    with open(path) as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = data.get("items", data.get("data", [data]))
    out = []
    for item in data:
        prompt = item.get("prompt") or item.get("question") or item.get("input", "")
        gt = item.get("ground_truth") or item.get("answer") or item.get("expected", "")
        out.append({"id": item.get("id", len(out)), "prompt": prompt, "ground_truth": gt})
    return out


def _assign_splits(n: int, seed: int = RANDOM_SEED) -> list[str]:
    """
    Deterministic train/val/test (60/20/20). One split per prompt; no reuse across splits.
    Rule: shuffle indices with seed, then assign by position. Stored in metrics for reproducibility.
    """
    rng = random.Random(seed)
    indices = list(range(n))
    rng.shuffle(indices)
    train_end = int(0.6 * n)
    val_end = int(0.8 * n)
    out = [""] * n
    for i, idx in enumerate(indices):
        if i < train_end:
            out[idx] = "train"
        elif i < val_end:
            out[idx] = "val"
        else:
            out[idx] = "test"
    return out


SPLIT_RULE = "shuffle_indices_seed(seed)_60_20_20_no_reuse"


def run_experiment(
    dataset_path: str,
    *,
    models: list[str] | None = None,
    output_dir: str = "cortex/experiments",
    db_path: str | None = None,
    dataset_name: str | None = None,
    seed: int = RANDOM_SEED,
) -> dict[str, Any]:
    """
    For each prompt: run all models, compute raw_confidence and features, evaluate correctness.
    Store per-(prompt, model) records in experiment_records with prompt_id, model_name, output_text,
    latency_ms, token_count, raw_confidence, feature_json, correct (0/1), dataset_name, split.
    """
    if db_path:
        os.environ["CORTEX_DB_PATH"] = db_path
    dataset = load_dataset(dataset_path)
    if not dataset:
        return {"error": "empty dataset", "metrics": {}, "n_records": 0}

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    dataset_name = dataset_name or Path(dataset_path).stem
    splits = _assign_splits(len(dataset), seed=seed)
    n_records = 0

    import asyncio

    with get_connection() as conn:
        init_schema(conn)
        for idx, item in enumerate(dataset):
            prompt = item["prompt"]
            ground_truth = item.get("ground_truth") or ""
            split = splits[idx]
            qid = insert_query(conn, prompt)
            responses: list[ModelResponse] = asyncio.run(
                run_multi_model_inference(prompt, models=models)
            )
            raw_confidence, features = estimate_confidence(responses)
            ensemble_dict = features_to_dict(features)
            try:
                best_response, _ = select_best_model_by_confidence(responses)
            except ValueError:
                best_response = responses[0] if responses else None
            selected_model = best_response.model if best_response else (responses[0].model if responses else "")
            for r in responses:
                per_res = extract_per_response_features(r, responses)
                feature_json = json.dumps(build_per_response_feature_json(ensemble_dict, per_res))
                correct_val = evaluate_correct(
                    prompt, r.model, r.output, ground_truth or None
                )
                correct_int = 1 if correct_val is True else (0 if correct_val is False else 0)
                insert_experiment_record(
                    conn,
                    qid,
                    r.model,
                    r.output,
                    raw_confidence,
                    feature_json,
                    correct_int,
                    dataset_name,
                    split,
                    latency_ms=r.latency_ms,
                    token_count=r.token_count,
                )
                n_records += 1
            insert_routing(conn, qid, selected_model, raw_confidence)

    return {
        "n_records": n_records,
        "dataset_name": dataset_name,
        "output_dir": output_dir,
        "n_prompts": len(dataset),
        "split_seed": seed,
        "split_rule": SPLIT_RULE,
    }


if __name__ == "__main__":
    import sys

    path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else str(Path(__file__).parent.parent / "datasets" / "sample.json")
    )
    out = run_experiment(path)
    print(json.dumps(out, indent=2))
