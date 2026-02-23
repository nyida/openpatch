"""
Load and validate prompts from JSON. Enforces schema: base_id, task, ground_truth, paraphrases.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ValidationError(Exception):
    """Raised when prompts.json fails validation."""

    pass


def load_prompts(path: str | Path) -> list[dict[str, Any]]:
    """
    Load prompts from JSON file. Returns list of base items.
    Validates: all paraphrases share identical ground_truth, no duplicate variant_ids,
    each base item has >= 2 paraphrases.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Prompts file not found: {path}")
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValidationError("prompts.json must be a JSON array")
    for i, item in enumerate(data):
        _validate_base_item(item, index=i)
    _validate_no_duplicate_variant_ids(data)
    return data


def _validate_base_item(item: Any, index: int) -> None:
    if not isinstance(item, dict):
        raise ValidationError(f"Item at index {index} must be an object")
    for key in ("base_id", "task", "ground_truth", "paraphrases"):
        if key not in item:
            raise ValidationError(f"Item at index {index} missing key: {key}")
    par = item["paraphrases"]
    if not isinstance(par, list):
        raise ValidationError(f"Item {index} 'paraphrases' must be an array")
    if len(par) < 2:
        raise ValidationError(f"Item at index {index} (base_id={item.get('base_id')}) must have >= 2 paraphrases")
    gt = item["ground_truth"]
    for j, pp in enumerate(par):
        if not isinstance(pp, dict):
            raise ValidationError(f"Item {index} paraphrase {j} must be an object")
        if "variant_id" not in pp or "text" not in pp:
            raise ValidationError(f"Item {index} paraphrase {j} must have variant_id and text")
        if pp.get("ground_truth") is not None and pp["ground_truth"] != gt:
            raise ValidationError(
                f"Item {index} paraphrase {j} ground_truth must match base ground_truth"
            )


def _validate_no_duplicate_variant_ids(data: list[dict[str, Any]]) -> None:
    seen: set[str] = set()
    for item in data:
        for pp in item.get("paraphrases", []):
            vid = pp.get("variant_id")
            if vid in seen:
                raise ValidationError(f"Duplicate variant_id across paraphrases: {vid}")
            seen.add(vid)
