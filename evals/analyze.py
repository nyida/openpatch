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
        conf = r.get("confidence", "")
        try:
            conf = float(conf) if conf != "" else None
        except (TypeError, ValueError):
            conf = None
        by_key[key][mode] = {
            "correct": int(r.get("correct", 0)),
            "invalid_format": int(r.get("invalid_format", 0)),
            "latency_ms": float(r.get("latency_ms", 0)),
            "confidence": conf,
        }

    # Per-mode ECE and Brier from rows
    def _ece_brier(rows_subset):
        conf_list = []
        correct_list = []
        for r in rows_subset:
            c = r.get("confidence", "")
            try:
                conf_list.append(float(c))
                correct_list.append(int(r.get("correct", 0)))
            except (TypeError, ValueError):
                pass
        if not conf_list or len(conf_list) != len(correct_list):
            return None, None
        brier = sum((p - y) ** 2 for p, y in zip(conf_list, correct_list)) / len(conf_list)
        n_bins = min(10, len(conf_list))
        sorted_idx = sorted(range(len(conf_list)), key=lambda i: conf_list[i])
        bin_size = len(sorted_idx) // n_bins
        ece = 0.0
        for b in range(n_bins):
            start = b * bin_size
            end = len(sorted_idx) if b == n_bins - 1 else (b + 1) * bin_size
            idx_bin = sorted_idx[start:end]
            if not idx_bin:
                continue
            acc_bin = sum(correct_list[i] for i in idx_bin) / len(idx_bin)
            conf_bin = sum(conf_list[i] for i in idx_bin) / len(idx_bin)
            ece += len(idx_bin) * abs(acc_bin - conf_bin)
        ece /= len(conf_list)
        return ece, brier

    modes_in_data = set()
    for modes in by_key.values():
        modes_in_data.update(modes.keys())
    calibration = {}
    for mode in sorted(modes_in_data):
        subset = [r for r in rows if r.get("mode") == mode]
        ece, brier = _ece_brier(subset)
        if ece is not None:
            calibration[mode] = {"ece": round(ece, 4), "brier": round(brier, 4)}

    paired = []
    paired_std = []
    for key, modes in by_key.items():
        base = modes.get("baseline")
        imp = modes.get("improved")
        std = modes.get("standard")
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
        if base and std:
            paired_std.append({
                "dataset_id": key[0],
                "item_id": key[1],
                "baseline_correct": base["correct"],
                "standard_correct": std["correct"],
                "diff_correct": std["correct"] - base["correct"],
                "baseline_invalid": base["invalid_format"],
                "standard_invalid": std["invalid_format"],
            })

    if not paired and not paired_std:
        print("No paired rows found (baseline vs improved or baseline vs standard).")
        return

    n_paired = len(paired)
    n_paired_std = len(paired_std)
    base_vals = [p["baseline_correct"] for p in paired]
    imp_vals = [p["improved_correct"] for p in paired]
    diffs = [p["diff_correct"] for p in paired]
    base_std_vals = [p["baseline_correct"] for p in paired_std]
    std_vals = [p["standard_correct"] for p in paired_std]
    diffs_std = [p["diff_correct"] for p in paired_std]

    random.seed(42)
    base_mean, base_lo, base_hi = _bootstrap_ci(base_vals, bootstrap_iter, confidence) if base_vals else (0.0, 0.0, 0.0)
    imp_mean, imp_lo, imp_hi = _bootstrap_ci(imp_vals, bootstrap_iter, confidence) if imp_vals else (0.0, 0.0, 0.0)
    diff_mean, diff_lo, diff_hi = _bootstrap_ci(diffs, bootstrap_iter, confidence) if diffs else (0.0, 0.0, 0.0)
    std_mean, std_lo, std_hi = (0.0, 0.0, 0.0)
    diff_std_mean, diff_std_lo, diff_std_hi = (0.0, 0.0, 0.0)
    if paired_std:
        std_mean, std_lo, std_hi = _bootstrap_ci(std_vals, bootstrap_iter, confidence)
        diff_std_mean, diff_std_lo, diff_std_hi = _bootstrap_ci(diffs_std, bootstrap_iter, confidence)

    n_improved = sum(1 for d in diffs if d > 0)
    n_worsened = sum(1 for d in diffs if d < 0)
    frac_improved = n_improved / n_paired if n_paired else 0
    frac_worsened = n_worsened / n_paired if n_paired else 0
    sign_test_p_std = _sign_test_p(diffs_std) if paired_std else None

    try:
        from scipy import stats
        wilcoxon_stat, wilcoxon_p = stats.wilcoxon(base_vals, imp_vals) if base_vals and imp_vals else (None, None)
        wilcoxon_result = {"statistic": float(wilcoxon_stat), "p_value": float(wilcoxon_p)} if wilcoxon_p is not None else {"note": "no paired data"}
        sign_test_p_val = None
    except Exception:
        wilcoxon_result = {"note": "scipy not available"}
        sign_test_p_val = _sign_test_p(diffs) if diffs else None

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

    if paired_std:
        pairwise_std_path = tables_dir / "pairwise_baseline_vs_standard.csv"
        with open(pairwise_std_path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(
                f,
                fieldnames=["dataset_id", "item_id", "baseline_correct", "standard_correct", "diff_correct", "baseline_invalid", "standard_invalid"],
            )
            w.writeheader()
            w.writerows(paired_std)

    summary_path = tables_dir / "summary_table.csv"
    header = [
        "baseline_accuracy_mean", "baseline_ci_low", "baseline_ci_high",
        "improved_accuracy_mean", "improved_ci_low", "improved_ci_high",
        "paired_diff_mean", "paired_diff_ci_low", "paired_diff_ci_high",
        "n_paired", "wilcoxon_p", "sign_test_p", "frac_improved", "frac_worsened",
    ]
    row_vals = [
        round(base_mean, 4), round(base_lo, 4), round(base_hi, 4),
        round(imp_mean, 4), round(imp_lo, 4), round(imp_hi, 4),
        round(diff_mean, 4), round(diff_lo, 4), round(diff_hi, 4),
        n_paired,
        round(wilcoxon_result.get("p_value", ""), 4) if isinstance(wilcoxon_result.get("p_value"), (int, float)) else "",
        round(sign_test_p_val, 4) if sign_test_p_val is not None else "",
        round(frac_improved, 4), round(frac_worsened, 4),
    ]
    if paired_std:
        header.extend(["standard_accuracy_mean", "standard_ci_low", "standard_ci_high", "paired_diff_baseline_standard_mean", "paired_diff_baseline_standard_ci_low", "paired_diff_baseline_standard_ci_high", "n_paired_standard", "sign_test_p_baseline_vs_standard"])
        row_vals.extend([
            round(std_mean, 4), round(std_lo, 4), round(std_hi, 4),
            round(diff_std_mean, 4), round(diff_std_lo, 4), round(diff_std_hi, 4),
            n_paired_std,
            round(sign_test_p_std, 4) if sign_test_p_std is not None else "",
        ])
    with open(summary_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerow(row_vals)

    bootstrap_obj = {
        "baseline_accuracy": {"mean": base_mean, "ci_lower": base_lo, "ci_upper": base_hi},
        "improved_accuracy": {"mean": imp_mean, "ci_lower": imp_lo, "ci_upper": imp_hi},
        "paired_difference": {"mean": diff_mean, "ci_lower": diff_lo, "ci_upper": diff_hi},
        "n_paired": n_paired,
        "wilcoxon": wilcoxon_result,
        "sign_test_p": sign_test_p_val,
        "frac_improved": frac_improved,
        "frac_worsened": frac_worsened,
        "calibration": calibration,
    }
    if paired_std:
        bootstrap_obj["standard_accuracy"] = {"mean": std_mean, "ci_lower": std_lo, "ci_upper": std_hi}
        bootstrap_obj["paired_difference_baseline_vs_standard"] = {"mean": diff_std_mean, "ci_lower": diff_std_lo, "ci_upper": diff_std_hi}
        bootstrap_obj["n_paired_baseline_standard"] = n_paired_std
        bootstrap_obj["sign_test_p_baseline_vs_standard"] = sign_test_p_std
    bootstrap_path = results_dir / "bootstrap_results.json"
    with open(bootstrap_path, "w", encoding="utf-8") as f:
        json.dump(bootstrap_obj, f, indent=2)

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
    if calibration:
        print("Calibration (ECE/Brier):", calibration)
    print(f"Paired diff (baseline vs improved): {diff_mean:.4f} [{diff_lo:.4f}, {diff_hi:.4f}]; n_paired={n_paired}")
    if paired_std:
        print(f"Paired diff (baseline vs standard): {diff_std_mean:.4f} [{diff_std_lo:.4f}, {diff_std_hi:.4f}]; n_paired={n_paired_std}; sign_test_p={sign_test_p_std}")


if __name__ == "__main__":
    main()
