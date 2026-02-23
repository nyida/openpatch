"""
Statistical tests: Friedman, pairwise Wilcoxon, Benjamini–Hochberg FDR.
Returns structured results dictionary.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.stats import friedmanchisquare, wilcoxon


def friedman_test(blocks: list[list[float]]) -> dict[str, Any]:
    """
    Friedman test across blocks (rows = blocks, columns = treatments/models).
    blocks[i] = list of values for block i (one per treatment).
    """
    if not blocks or not blocks[0]:
        return {"statistic": float("nan"), "p_value": 1.0, "valid": False}
    arr = np.array(blocks, dtype=float)
    if arr.shape[0] < 2 or arr.shape[1] < 2:
        return {"statistic": float("nan"), "p_value": 1.0, "valid": False}
    try:
        stat, p = friedmanchisquare(*arr.T)
        return {"statistic": float(stat), "p_value": float(p), "valid": True}
    except Exception:
        return {"statistic": float("nan"), "p_value": 1.0, "valid": False}


def wilcoxon_pairwise(
    group_a: list[float], group_b: list[float]
) -> dict[str, Any]:
    """Wilcoxon signed-rank for paired samples. Returns statistic and p-value."""
    if len(group_a) != len(group_b) or len(group_a) < 2:
        return {"statistic": float("nan"), "p_value": 1.0, "valid": False}
    try:
        stat, p = wilcoxon(group_a, group_b, alternative="two-sided")
        return {"statistic": float(stat), "p_value": float(p), "valid": True}
    except Exception:
        return {"statistic": float("nan"), "p_value": 1.0, "valid": False}


def benjamini_hochberg(p_values: list[float], alpha: float = 0.05) -> list[bool]:
    """
    Benjamini–Hochberg FDR correction. Returns list of True/False (reject null at level alpha).
    """
    if not p_values:
        return []
    n = len(p_values)
    order = np.argsort(p_values)
    p_sorted = np.array(p_values, dtype=float)[order]
    reject = np.zeros(n, dtype=bool)
    for i in range(n - 1, -1, -1):
        if p_sorted[i] <= (i + 1) / n * alpha:
            reject[order[i]] = True
            break
        if i < n - 1:
            reject[order[i]] = reject[order[i + 1]]
    return reject.tolist()


def run_all_statistics(
    model_metrics: dict[str, list[float]],
    alpha: float = 0.05,
) -> dict[str, Any]:
    """
    Friedman test across models; pairwise Wilcoxon; BH correction.
    model_metrics: { model_name: [value per base item] }, all same length.
    """
    models = list(model_metrics.keys())
    n_items = len(model_metrics[models[0]]) if models else 0
    blocks = [[model_metrics[m][i] for m in models] for i in range(n_items)]
    friedman = friedman_test(blocks)

    pairwise: list[dict[str, Any]] = []
    p_vals: list[float] = []
    for i in range(len(models)):
        for j in range(i + 1, len(models)):
            m1, m2 = models[i], models[j]
            w = wilcoxon_pairwise(model_metrics[m1], model_metrics[m2])
            pairwise.append({
                "model_a": m1,
                "model_b": m2,
                "wilcoxon_statistic": w["statistic"],
                "wilcoxon_p_value": w["p_value"],
            })
            p_vals.append(w["p_value"])

    rejected = benjamini_hochberg(p_vals, alpha)
    for k, rec in enumerate(pairwise):
        rec["reject_null_after_bh"] = rejected[k] if k < len(rejected) else False

    return {
        "friedman": friedman,
        "pairwise_wilcoxon_bh": pairwise,
        "alpha": alpha,
    }
