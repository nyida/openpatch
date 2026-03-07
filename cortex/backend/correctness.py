"""
CORTEX Component 2: Correctness Evaluation Layer.
Determines whether a model output is correct (e.g. vs ground truth).
Supports benchmark datasets: MMLU, GSM8K, TruthfulQA (loaders + eval).
"""
from __future__ import annotations

import re
from typing import Any


def normalize_answer(s: str) -> str:
    """Lowercase, strip, collapse whitespace, remove punctuation for comparison."""
    s = " ".join(s.lower().strip().split())
    s = re.sub(r"[^\w\s]", "", s)
    return s.strip()


def exact_match(predicted: str, ground_truth: str) -> bool:
    return normalize_answer(predicted) == normalize_answer(ground_truth)


def contains_match(predicted: str, ground_truth: str) -> bool:
    """True if normalized ground_truth appears in normalized predicted."""
    return normalize_answer(ground_truth) in normalize_answer(predicted)


def gsm8k_extract_answer(text: str) -> str | None:
    """Extract final numeric answer from GSM8K-style reasoning (e.g. #### 42)."""
    m = re.search(r"####\s*([-\d.,]+)", text)
    return m.group(1).strip() if m else None


def evaluate_correct(
    prompt: str,
    model: str,
    output: str,
    ground_truth: str | None = None,
    *,
    dataset: str = "generic",
) -> bool | None:
    """
    Returns True/False if ground_truth provided; None if no ground truth.
    For GSM8K, extracts #### answer from output and compares to ground_truth.
    """
    if ground_truth is None or ground_truth == "":
        return None
    if dataset == "gsm8k":
        pred = gsm8k_extract_answer(output)
        if pred is None:
            return False
        gt_norm = re.sub(r"[^\d.-]", "", str(ground_truth).strip())
        pred_norm = re.sub(r"[^\d.-]", "", pred)
        return gt_norm == pred_norm or exact_match(pred, str(ground_truth))
    return exact_match(output, ground_truth) or contains_match(output, ground_truth)
