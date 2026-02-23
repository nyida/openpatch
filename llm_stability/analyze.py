"""
Analysis: load metrics, run statistics, produce publication-quality tables and figures.
Usage: python analyze.py --config configs/main.yaml
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from src.statistics import run_all_statistics
from src.utils import ensure_dir, load_yaml, write_json_snapshot

_root = Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))


def _load_metrics_csv(path: Path) -> list[dict]:
    """Load metrics.csv; return list of row dicts."""
    rows = []
    if not path.exists():
        return rows
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows


def _load_bootstrap(path: Path) -> dict:
    """Load bootstrap_results.json."""
    import json
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def run_analysis(config_path: str) -> None:
    """Generate tables and figures; run Friedman/Wilcoxon/BH; save config snapshot."""
    config = load_yaml(config_path)
    config_dir = Path(config_path).resolve().parent.parent
    results_path = config_dir / config["output"]["results_path"]
    figures_path = results_path / config["output"].get("figures_subdir", "figures")
    tables_path = results_path / config["output"].get("tables_subdir", "tables")
    ensure_dir(figures_path)
    ensure_dir(tables_path)

    metrics_path = results_path / "metrics.csv"
    bootstrap_path = results_path / "bootstrap_results.json"
    metrics_rows = _load_metrics_csv(metrics_path)
    bootstrap = _load_bootstrap(bootstrap_path)

    # Config snapshot for reproducibility
    config_file = config_dir / config_path if not Path(config_path).is_absolute() else Path(config_path)
    if config_file.exists():
        with open(config_file, "r", encoding="utf-8") as f:
            config_snapshot = {"config_path": str(config_file), "content": f.read()}
        write_json_snapshot({"config": config_snapshot}, results_path / "config_snapshot.json")

    if not metrics_rows:
        print("No metrics found. Run score_responses.py first.")
        return

    # Aggregate per model: mean stability, accuracy, invalid_rate (from CSV rows)
    from collections import defaultdict
    per_model: dict[str, dict] = defaultdict(lambda: {"stability": [], "accuracy": [], "invalid_rate": []})
    for r in metrics_rows:
        m = r.get("model", "")
        per_model[m]["stability"].append(float(r.get("deterministic_stability", 0)))
        per_model[m]["accuracy"].append(float(r.get("accuracy", 0)))
        per_model[m]["invalid_rate"].append(float(r.get("invalid_rate", 0)))

    # Table 1: Mean stability ± CI, Accuracy, Invalid rate
    per_model_res = bootstrap.get("per_model", {})
    table1_rows = []
    for model in sorted(per_model.keys()):
        res = per_model_res.get(model, {})
        mean_s = res.get("mean", 0)
        lo = res.get("ci_lower", 0)
        hi = res.get("ci_upper", 0)
        acc_vals = per_model[model]["accuracy"]
        inv_vals = per_model[model]["invalid_rate"]
        mean_acc = sum(acc_vals) / len(acc_vals) if acc_vals else 0
        mean_inv = sum(inv_vals) / len(inv_vals) if inv_vals else 0
        table1_rows.append({
            "model": model,
            "mean_stability": round(mean_s, 4),
            "ci_lower": round(lo, 4),
            "ci_upper": round(hi, 4),
            "accuracy": round(mean_acc, 4),
            "invalid_rate": round(mean_inv, 4),
        })

    table1_path = tables_path / "summary_table.csv"
    with open(table1_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["model", "mean_stability", "ci_lower", "ci_upper", "accuracy", "invalid_rate"])
        w.writeheader()
        w.writerows(table1_rows)

    # Pairwise comparison table
    pairwise = bootstrap.get("pairwise", [])
    table2_path = tables_path / "pairwise_comparison.csv"
    with open(table2_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["model_a", "model_b", "difference", "ci_lower", "ci_upper", "p_value"],
        )
        w.writeheader()
        for p in pairwise:
            w.writerow({
                "model_a": p["model_a"],
                "model_b": p["model_b"],
                "difference": round(p["difference"], 4),
                "ci_lower": round(p["ci_lower"], 4),
                "ci_upper": round(p["ci_upper"], 4),
                "p_value": round(p["p_value"], 4),
            })

    # Statistics: Friedman, Wilcoxon, BH (per base_id, mean over temps)
    base_ids = sorted(set(r["base_id"] for r in metrics_rows))
    models = sorted(per_model.keys())
    by_model_base: dict[str, list[float]] = {m: [] for m in models}
    for base_id in base_ids:
        for m in models:
            vals = [float(r["deterministic_stability"]) for r in metrics_rows if r["model"] == m and r["base_id"] == base_id]
            by_model_base[m].append(sum(vals) / len(vals) if vals else 0.0)
    blocks = [[by_model_base[m][i] for m in models] for i in range(len(base_ids))]
    stats_res = run_all_statistics(by_model_base, alpha=0.05)
    stats_path = results_path / "statistics.json"
    write_json_snapshot(stats_res, stats_path)

    # Figures (matplotlib only)
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    # 1. Bar plot with CI
    fig, ax = plt.subplots(figsize=(6, 4))
    models_ord = [r["model"] for r in table1_rows]
    means = [r["mean_stability"] for r in table1_rows]
    los = [r["ci_lower"] for r in table1_rows]
    his = [r["ci_upper"] for r in table1_rows]
    x = np.arange(len(models_ord))
    bars = ax.bar(x, means, yerr=[np.array(means) - np.array(los), np.array(his) - np.array(means)], capsize=5)
    ax.set_xticks(x)
    ax.set_xticklabels(models_ord)
    ax.set_ylabel("Mean stability")
    ax.set_title("Mean stability with 95% CI")
    fig.tight_layout()
    for ext in ["pdf", "png"]:
        fig.savefig(figures_path / f"bar_stability_ci.{ext}", dpi=150)
    plt.close(fig)

    # 2. Item-level stability boxplots
    fig, ax = plt.subplots(figsize=(6, 4))
    data = [per_model[m]["stability"] for m in models_ord]
    ax.boxplot(data, tick_labels=models_ord)
    ax.set_ylabel("Deterministic stability")
    ax.set_title("Item-level stability by model")
    fig.tight_layout()
    for ext in ["pdf", "png"]:
        fig.savefig(figures_path / f"boxplot_stability.{ext}", dpi=150)
    plt.close(fig)

    # 3. Stability vs accuracy scatter (one point per model, mean stability vs mean accuracy)
    fig, ax = plt.subplots(figsize=(5, 5))
    stab_means = [sum(per_model[m]["stability"]) / len(per_model[m]["stability"]) for m in models_ord]
    acc_means = [sum(per_model[m]["accuracy"]) / len(per_model[m]["accuracy"]) for m in models_ord]
    ax.scatter(stab_means, acc_means)
    for i, m in enumerate(models_ord):
        ax.annotate(m, (stab_means[i], acc_means[i]), fontsize=9)
    ax.set_xlabel("Mean stability")
    ax.set_ylabel("Mean accuracy")
    ax.set_title("Stability vs accuracy (per model)")
    fig.tight_layout()
    for ext in ["pdf", "png"]:
        fig.savefig(figures_path / f"scatter_stability_accuracy.{ext}", dpi=150)
    plt.close(fig)

    print("Analysis complete.")
    print(f"  Tables: {tables_path}")
    print(f"  Figures: {figures_path}")
    print(f"  Statistics: {stats_path}")
    print("\nSummary table:")
    for r in table1_rows:
        print(f"  {r['model']}: stability={r['mean_stability']:.4f} [{r['ci_lower']:.4f}, {r['ci_upper']:.4f}], accuracy={r['accuracy']:.4f}, invalid_rate={r['invalid_rate']:.4f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze metrics and produce tables/figures")
    parser.add_argument("--config", required=True, help="Path to config YAML (e.g. configs/main.yaml)")
    args = parser.parse_args()
    run_analysis(args.config)


if __name__ == "__main__":
    main()
