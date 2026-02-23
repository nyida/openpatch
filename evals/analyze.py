"""
Analyze: per-mode bootstrap CI, paired diff CI, Wilcoxon or sign test, effect size, tables and figures.
Usage: python -m evals.analyze --config evals/configs/main.yaml
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_config(path: Path) -> dict:
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def _bootstrap_ci(values: list[float], iterations: int, confidence: float) -> tuple[float, float, float]:
    n = len(values)
    if n == 0:
        return 0.0, 0.0, 0.0
    mean = sum(values) / n
    rng = random.Random(42)
    boot = []
    for _ in range(iterations):
        idx = [rng.randint(0, n - 1) for _ in range(n)]
        boot.append(sum(values[i] for i in idx) / n)
    boot.sort()
    alpha = 1 - confidence
    lo = boot[int(alpha / 2 * iterations)]
    hi = boot[int((1 - alpha / 2) * iterations)]
    return mean, lo, hi


def _sign_test_p(diffs: list[float]) -> float:
    """Binomial sign test: P(X >= n_plus) under H0 p=0.5."""
    n_plus = sum(1 for d in diffs if d > 0)
    n_minus = sum(1 for d in diffs if d < 0)
    n = n_plus + n_minus
    if n == 0:
        return 1.0
    p = 0.5
    # Two-tailed: 2 * min(P(X >= n_plus), P(X <= n_plus))
    prob_ge = sum(
        math.comb(n, k) * (p**k) * ((1 - p) ** (n - k))
        for k in range(n_plus, n + 1)
    )
    prob_le = sum(
        math.comb(n, k) * (p**k) * ((1 - p) ** (n - k))
        for k in range(0, n_plus + 1)
    )
    return 2 * min(prob_ge, prob_le)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze metrics: bootstrap, Wilcoxon/sign test, figures")
    parser.add_argument("--config", required=True, help="Path to config YAML")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (Path.cwd() / config_path).resolve()
        if not config_path.exists():
            config_path = ROOT / args.config
    config = _load_config(config_path) if config_path.exists() else {}
    results_dir = Path.cwd() / "evals" / "results"
    if not (results_dir / "metrics.csv").exists():
        results_dir = ROOT / "evals" / "results"
    bootstrap_iter = config.get("bootstrap", {}).get("iterations", 1000)
    confidence = config.get("bootstrap", {}).get("confidence_level", 0.95)

    metrics_path = results_dir / "metrics.csv"
    if not metrics_path.exists():
        print("Run evals.score first to generate metrics.csv")
        return

    rows = []
    with open(metrics_path, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)

    by_key = {}
    for r in rows:
        key = (r.get("dataset_id", ""), r.get("item_id", ""))
        mode = r.get("mode", "")
        if key not in by_key:
            by_key[key] = {}
        by_key[key][mode] = {
            "correct": int(r.get("correct", 0)),
            "invalid_format": int(r.get("invalid_format", 0)),
            "latency_ms": float(r.get("latency_ms", 0)),
        }

    paired = []
    for key, modes in by_key.items():
        base = modes.get("baseline")
        imp = modes.get("improved")
        if base and imp:
            paired.append({
                "dataset_id": key[0],
                "item_id": key[1],
                "baseline_correct": base["correct"],
                "improved_correct": imp["correct"],
                "diff_correct": imp["correct"] - base["correct"],
                "baseline_invalid": base["invalid_format"],
                "improved_invalid": imp["invalid_format"],
            })

    if not paired:
        print("No paired baseline vs improved rows found.")
        return

    n_paired = len(paired)
    base_vals = [p["baseline_correct"] for p in paired]
    imp_vals = [p["improved_correct"] for p in paired]
    diffs = [p["diff_correct"] for p in paired]

    random.seed(42)
    base_mean, base_lo, base_hi = _bootstrap_ci(base_vals, bootstrap_iter, confidence)
    imp_mean, imp_lo, imp_hi = _bootstrap_ci(imp_vals, bootstrap_iter, confidence)
    diff_mean, diff_lo, diff_hi = _bootstrap_ci(diffs, bootstrap_iter, confidence)

    n_improved = sum(1 for d in diffs if d > 0)
    n_worsened = sum(1 for d in diffs if d < 0)
    frac_improved = n_improved / n_paired if n_paired else 0
    frac_worsened = n_worsened / n_paired if n_paired else 0

    try:
        from scipy import stats
        wilcoxon_stat, wilcoxon_p = stats.wilcoxon(base_vals, imp_vals)
        wilcoxon_result = {"statistic": float(wilcoxon_stat), "p_value": float(wilcoxon_p)}
        sign_test_p_val = None
    except Exception:
        wilcoxon_result = {"note": "scipy not available"}
        sign_test_p_val = _sign_test_p(diffs)

    tables_dir = results_dir / "tables"
    figures_dir = results_dir / "figures"
    tables_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    pairwise_path = tables_dir / "pairwise_comparison.csv"
    with open(pairwise_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["dataset_id", "item_id", "baseline_correct", "improved_correct", "diff_correct", "baseline_invalid", "improved_invalid"],
        )
        w.writeheader()
        w.writerows(paired)

    summary_path = tables_dir / "summary_table.csv"
    with open(summary_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "baseline_accuracy_mean", "baseline_ci_low", "baseline_ci_high",
            "improved_accuracy_mean", "improved_ci_low", "improved_ci_high",
            "paired_diff_mean", "paired_diff_ci_low", "paired_diff_ci_high",
            "n_paired", "wilcoxon_p", "sign_test_p", "frac_improved", "frac_worsened",
        ])
        w.writerow([
            round(base_mean, 4), round(base_lo, 4), round(base_hi, 4),
            round(imp_mean, 4), round(imp_lo, 4), round(imp_hi, 4),
            round(diff_mean, 4), round(diff_lo, 4), round(diff_hi, 4),
            n_paired,
            round(wilcoxon_result.get("p_value", ""), 4) if isinstance(wilcoxon_result.get("p_value"), (int, float)) else "",
            round(sign_test_p_val, 4) if sign_test_p_val is not None else "",
            round(frac_improved, 4), round(frac_worsened, 4),
        ])

    bootstrap_path = results_dir / "bootstrap_results.json"
    with open(bootstrap_path, "w", encoding="utf-8") as f:
        json.dump({
            "baseline_accuracy": {"mean": base_mean, "ci_lower": base_lo, "ci_upper": base_hi},
            "improved_accuracy": {"mean": imp_mean, "ci_lower": imp_lo, "ci_upper": imp_hi},
            "paired_difference": {"mean": diff_mean, "ci_lower": diff_lo, "ci_upper": diff_hi},
            "n_paired": n_paired,
            "wilcoxon": wilcoxon_result,
            "sign_test_p": sign_test_p_val,
            "frac_improved": frac_improved,
            "frac_worsened": frac_worsened,
        }, f, indent=2)

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots()
        ax.bar(["baseline", "improved"], [base_mean, imp_mean], color=["#64748b", "#10b981"])
        ax.set_ylabel("Accuracy")
        ax.set_ylim(0, 1.05)
        fig.savefig(figures_dir / "accuracy_comparison.png", dpi=150, bbox_inches="tight")
        plt.close()
    except Exception:
        pass

    print(f"Wrote {pairwise_path}, {summary_path}, {bootstrap_path}")
    print(f"Paired diff: {diff_mean:.4f} [{diff_lo:.4f}, {diff_hi:.4f}]; n_paired={n_paired}")


if __name__ == "__main__":
    main()
