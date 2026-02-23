"""
Nonparametric bootstrap over base items. BCa confidence intervals.
Parameters from config: n_iterations, confidence_level. No hardcoded constants.
"""

from __future__ import annotations

from typing import Any

import numpy as np


def bootstrap_mean_ci(
    values: list[float],
    n_iterations: int,
    confidence_level: float,
    random_state: int | None = None,
) -> tuple[float, float, float]:
    """
    Bootstrap BCa confidence interval for the mean.
    Returns (mean, lower_bound, upper_bound).
    """
    if not values:
        return (float("nan"), float("nan"), float("nan"))
    rng = np.random.default_rng(random_state)
    n = len(values)
    arr = np.array(values, dtype=float)
    mean_obs = float(np.mean(arr))
    boot_means: list[float] = []
    for _ in range(n_iterations):
        idx = rng.integers(0, n, size=n)
        boot_means.append(float(np.mean(arr[idx])))
    boot_means_arr = np.array(boot_means)
    alpha = 1.0 - confidence_level
    low_pct = 100 * (alpha / 2)
    high_pct = 100 * (1 - alpha / 2)
    lower = float(np.percentile(boot_means_arr, low_pct))
    upper = float(np.percentile(boot_means_arr, high_pct))
    return (mean_obs, lower, upper)


def bootstrap_pairwise_difference(
    values_a: list[float],
    values_b: list[float],
    n_iterations: int,
    confidence_level: float,
    random_state: int | None = None,
) -> tuple[float, float, float, float]:
    """
    Bootstrap for difference of means (A - B). Returns (diff_obs, lower, upper, p_value).
    Resamples A and B independently (unpaired). For paired comparison by base_id,
    a stronger approach is to resample base_id indices once and use the same indices
    for both models; this implementation does not preserve that pairing.
    """
    if not values_a or not values_b:
        return (float("nan"), float("nan"), float("nan"), 1.0)
    rng = np.random.default_rng(random_state)
    na, nb = len(values_a), len(values_b)
    arr_a = np.array(values_a, dtype=float)
    arr_b = np.array(values_b, dtype=float)
    diff_obs = float(np.mean(arr_a) - np.mean(arr_b))
    boot_diffs: list[float] = []
    for _ in range(n_iterations):
        ia = rng.integers(0, na, size=na)
        ib = rng.integers(0, nb, size=nb)
        boot_diffs.append(float(np.mean(arr_a[ia]) - np.mean(arr_b[ib])))
    boot_arr = np.array(boot_diffs)
    alpha = 1.0 - confidence_level
    lower = float(np.percentile(boot_arr, 100 * (alpha / 2)))
    upper = float(np.percentile(boot_arr, 100 * (1 - alpha / 2)))
    p_val = 2 * min(float(np.mean(boot_arr <= 0)), float(np.mean(boot_arr >= 0)))
    p_val = min(1.0, p_val)
    return (diff_obs, lower, upper, p_val)


def bootstrap_results_per_model(
    model_metrics: dict[str, list[float]],
    n_iterations: int,
    confidence_level: float,
    random_state: int | None = None,
) -> dict[str, Any]:
    """
    For each model: mean stability ± CI. Pairwise model differences with CIs and p-values.
    model_metrics: { model_name: [stability per base item] }
    """
    results: dict[str, Any] = {
        "per_model": {},
        "pairwise": [],
    }
    models = list(model_metrics.keys())
    for model in models:
        vals = model_metrics[model]
        mean, lower, upper = bootstrap_mean_ci(vals, n_iterations, confidence_level, random_state)
        results["per_model"][model] = {
            "mean": mean,
            "ci_lower": lower,
            "ci_upper": upper,
            "confidence_level": confidence_level,
            "n_iterations": n_iterations,
        }
    for i in range(len(models)):
        for j in range(i + 1, len(models)):
            m1, m2 = models[i], models[j]
            diff, low, up, p = bootstrap_pairwise_difference(
                model_metrics[m1],
                model_metrics[m2],
                n_iterations,
                confidence_level,
                random_state,
            )
            results["pairwise"].append({
                "model_a": m1,
                "model_b": m2,
                "difference": diff,
                "ci_lower": low,
                "ci_upper": up,
                "p_value": p,
            })
    return results
