"""
Stability and accuracy metrics. All functions pure and unit-testable.
Combinatorial normalization: comb(V, 2) for pairs of paraphrases.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

import numpy as np
from scipy.spatial.distance import jensenshannon
from scipy.stats import spearmanr


def _comb2(n: int) -> int:
    """Number of pairs from n items. comb(n, 2)."""
    if n < 2:
        return 0
    return n * (n - 1) // 2


def deterministic_stability(
    responses_per_variant: list[list[str]],
) -> float:
    """
    Deterministic stability: fraction of (variant pair, sample) that agree.
    responses_per_variant[i] = list of response strings for variant i (same length).
    Normalization: over all pairs of variants and all sample indices.
    """
    if not responses_per_variant or not responses_per_variant[0]:
        return 0.0
    n_variants = len(responses_per_variant)
    n_samples = len(responses_per_variant[0])
    for row in responses_per_variant:
        if len(row) != n_samples:
            raise ValueError("All variant response lists must have same length")
    total_agree = 0
    total_pairs = 0
    for i in range(n_variants):
        for j in range(i + 1, n_variants):
            for t in range(n_samples):
                total_pairs += 1
                if responses_per_variant[i][t] == responses_per_variant[j][t]:
                    total_agree += 1
    return total_agree / total_pairs if total_pairs else 0.0


def _response_to_distribution(responses: list[str]) -> tuple[list[str], list[float]]:
    """Convert list of response strings to sorted unique values and probability distribution."""
    if not responses:
        return [], []
    counts: dict[str, int] = defaultdict(int)
    for r in responses:
        counts[r] += 1
    total = len(responses)
    keys = sorted(counts.keys())
    probs = [counts[k] / total for k in keys]
    return keys, probs


def _pad_to_same_keys(
    keys1: list[str], probs1: list[float], keys2: list[str], probs2: list[float]
) -> tuple[np.ndarray, np.ndarray]:
    """Union of keys and align two probability vectors to same index order."""
    all_keys = sorted(set(keys1) | set(keys2))
    p1 = [probs1[keys1.index(k)] if k in keys1 else 0.0 for k in all_keys]
    p2 = [probs2[keys2.index(k)] if k in keys2 else 0.0 for k in all_keys]
    return np.array(p1, dtype=float), np.array(p2, dtype=float)


def jensen_shannon_stability(responses_per_variant: list[list[str]]) -> float:
    """
    Distributional stability (raw surface form): 1 - mean(JSD) over variant pairs.
    Uses raw response strings as atoms; sensitive to formatting. For decision-level
    stability use jensen_shannon_stability_parsed.
    """
    n_v = len(responses_per_variant)
    if n_v < 2:
        return 1.0
    total_jsd = 0.0
    count = 0
    for i in range(n_v):
        for j in range(i + 1, n_v):
            k1, p1 = _response_to_distribution(responses_per_variant[i])
            k2, p2 = _response_to_distribution(responses_per_variant[j])
            pa, pb = _pad_to_same_keys(k1, p1, k2, p2)
            jsd = jensenshannon(pa, pb)
            total_jsd += jsd
            count += 1
    mean_jsd = total_jsd / count if count else 0.0
    return 1.0 - mean_jsd


INVALID_LABEL = "__invalid__"


def _parsed_value_to_label(value: Any, valid: bool) -> str:
    """Turn parsed (value, valid) into a single label string for distribution/correlation."""
    if not valid or value is None:
        return INVALID_LABEL
    return str(value).strip().upper() if isinstance(value, str) else str(value)


def parsed_label_stability(parsed_labels_per_variant: list[list[str]]) -> float:
    """
    Decision-level stability: fraction of (variant pair, sample) with identical parsed label.
    parsed_labels_per_variant[i] = list of label strings for variant i (e.g. "A", "B", "__invalid__").
    Same combinatorial normalization as deterministic_stability but on labels not raw text.
    """
    if not parsed_labels_per_variant or not parsed_labels_per_variant[0]:
        return 0.0
    n_v = len(parsed_labels_per_variant)
    n_samples = len(parsed_labels_per_variant[0])
    for row in parsed_labels_per_variant:
        if len(row) != n_samples:
            raise ValueError("All variant label lists must have same length")
    total_agree = 0
    total_pairs = 0
    for i in range(n_v):
        for j in range(i + 1, n_v):
            for t in range(n_samples):
                total_pairs += 1
                if parsed_labels_per_variant[i][t] == parsed_labels_per_variant[j][t]:
                    total_agree += 1
    return total_agree / total_pairs if total_pairs else 0.0


def jensen_shannon_stability_parsed(parsed_labels_per_variant: list[list[str]]) -> float:
    """
    Distributional stability on parsed labels (decision-level): 1 - mean(JSD) over variant pairs.
    Each variant has a distribution over label strings (e.g. A, B, __invalid__). Less brittle
    than raw-text JSD which treats any character difference as a different atom.
    """
    n_v = len(parsed_labels_per_variant)
    if n_v < 2:
        return 1.0
    total_jsd = 0.0
    count = 0
    for i in range(n_v):
        for j in range(i + 1, n_v):
            k1, p1 = _response_to_distribution(parsed_labels_per_variant[i])
            k2, p2 = _response_to_distribution(parsed_labels_per_variant[j])
            pa, pb = _pad_to_same_keys(k1, p1, k2, p2)
            jsd = jensenshannon(pa, pb)
            total_jsd += jsd
            count += 1
    mean_jsd = total_jsd / count if count else 0.0
    return 1.0 - mean_jsd


def accuracy(parsed_values: list[Any], ground_truth: str) -> float:
    """
    Accuracy: fraction of parsed values that match ground_truth.
    ground_truth is string (e.g. "A", "B"); comparison is normalized (strip, upper).
    """
    if not parsed_values:
        return 0.0
    gt = str(ground_truth).strip().upper()
    matches = sum(1 for v in parsed_values if v is not None and str(v).strip().upper() == gt)
    return matches / len(parsed_values)


def invalid_rate(parse_results: list[dict[str, Any]]) -> float:
    """Invalid rate: fraction of parse results with valid=False."""
    if not parse_results:
        return 0.0
    return sum(1 for r in parse_results if not r.get("valid", True)) / len(parse_results)


def stability_accuracy_spearman(
    stability_per_item: list[float], accuracy_per_item: list[float]
) -> tuple[float, float]:
    """
    Spearman correlation between stability and accuracy across items.
    Returns (rho, p_value).
    """
    if len(stability_per_item) != len(accuracy_per_item) or len(stability_per_item) < 2:
        return (float("nan"), 1.0)
    rho, p = spearmanr(stability_per_item, accuracy_per_item, nan_policy="omit")
    return (float(rho), float(p))
