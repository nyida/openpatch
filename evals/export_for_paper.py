"""
Export eval artifacts to LaTeX for the manuscript. Generates paper/results_table.tex and
paper/results_delta.tex from evals/results so the paper cannot drift from results.
Hard gate: if run_metadata.json has is_submission_run != true, writes \\errmessage{...} so the
paper refuses to compile (prevents accidental inclusion of non-submission results).
Usage: python -m evals.export_for_paper [--results-dir evals/results] [--paper-dir paper]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ERRMESSAGE_TEX = r"""% Non-submission run: paper must not compile. See evals/README.md.
\errmessage{EVAL GATE: Results are not from a submission run. Run evals with limit=500 (or submission_n), GSM8K, real model (dry_run=false), modes=[baseline, improved, standard], num_candidates=3. Then run score and analyze, then export_for_paper.}
"""


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}\\%"


def _fmt_ci(lo: float, hi: float) -> str:
    return f"[{lo*100:.1f}, {hi*100:.1f}]"


def _fmt_num(x: float) -> str:
    return f"{x:.4f}" if x is not None else "---"


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def load_summary_by_mode(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    return rows


def write_results_table(paper_dir: Path, summary_rows: list[dict], bootstrap: dict | None, run_meta: dict | None) -> None:
    """Write paper/results_table.tex: per-mode accuracy, invalid rate, ECE, Brier, n."""
    n_used_all = (run_meta or {}).get("n_used_all")
    path = paper_dir / "results_table.tex"
    path.parent.mkdir(parents=True, exist_ok=True)

    if not summary_rows:
        path.write_text(ERRMESSAGE_TEX, encoding="utf-8")
        return

    # Build rows from summary_by_mode; use bootstrap for CIs when available
    acc_ci = {}
    if bootstrap:
        for key in ("baseline_accuracy", "improved_accuracy", "standard_accuracy"):
            if key in bootstrap and isinstance(bootstrap[key], dict):
                acc_ci[key.replace("_accuracy", "")] = bootstrap[key]

    lines = [
        "% Auto-generated from evals/results. Do not edit by hand.",
        "\\begin{table}[ht]",
        "\\centering",
    ]
    n_str = str(n_used_all) if n_used_all is not None else "n"
    lines.append(f"\\caption{{Per-mode accuracy, invalid-format rate, calibration (ECE, Brier), and sample size. ${n_str}$ GSM8K items.}}")
    lines.append("\\label{tab:results}")
    lines.append("\\begin{tabular}{lccccc}")
    lines.append("\\hline")
    lines.append("\\textbf{Mode} & \\textbf{Accuracy (95\\% CI)} & \\textbf{Invalid} & \\textbf{ECE} & \\textbf{Brier} & \\textbf{$n$} \\\\")
    lines.append("\\hline")

    for row in summary_rows:
        mode = row.get("mode", "?")
        acc = row.get("accuracy", "")
        inv = row.get("invalid_rate", "")
        ece = row.get("ece", "")
        brier = row.get("brier", "")
        n = row.get("n", "")
        try:
            acc_f = float(acc)
            acc_str = _fmt_pct(acc_f)
        except (TypeError, ValueError):
            acc_str = "---"
        ci = acc_ci.get(mode, {})
        if ci and "ci_lower" in ci and "ci_upper" in ci:
            acc_str += " " + _fmt_ci(float(ci["ci_lower"]), float(ci["ci_upper"]))
        try:
            inv_f = float(inv)
            inv_str = _fmt_pct(inv_f)
        except (TypeError, ValueError):
            inv_str = "---"
        ece_str = _fmt_num(float(ece)) if ece != "" and ece is not None else "---"
        brier_str = _fmt_num(float(brier)) if brier != "" and brier is not None else "---"
        lines.append(f"{mode} & {acc_str} & {inv_str} & {ece_str} & {brier_str} & {n} \\\\")

    lines.append("\\hline")
    lines.append("\\end{tabular}")
    lines.append("\\end{table}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_results_delta(paper_dir: Path, bootstrap: dict | None) -> None:
    """Write paper/results_delta.tex: paired differences and sign-test p-values."""
    path = paper_dir / "results_delta.tex"
    path.parent.mkdir(parents=True, exist_ok=True)

    if not bootstrap:
        path.write_text(ERRMESSAGE_TEX, encoding="utf-8")
        return

    pd = bootstrap.get("paired_difference", {})
    sign_p = bootstrap.get("sign_test_p")
    n_paired = bootstrap.get("n_paired", 0)

    pd_std = bootstrap.get("paired_difference_baseline_vs_standard", {})
    sign_p_std = bootstrap.get("sign_test_p_baseline_vs_standard")
    n_paired_std = bootstrap.get("n_paired_baseline_standard", 0)

    lines = [
        "% Auto-generated from evals/results. Do not edit by hand.",
        "\\begin{table}[ht]",
        "\\centering",
        "\\caption{Paired accuracy difference (improved or standard minus baseline) with 95\\% bootstrap CI and sign-test $p$-value.}",
        "\\label{tab:delta}",
        "\\begin{tabular}{lccc}",
        "\\hline",
        "Comparison & Difference (95\\% CI) & $n$ & Sign test $p$ \\\\",
        "\\hline",
    ]

    def row(comp: str, diff: dict, n: int, p) -> str:
        mean = diff.get("mean")
        lo = diff.get("ci_lower")
        hi = diff.get("ci_upper")
        if mean is not None and lo is not None and hi is not None:
            diff_str = f"{mean:+.4f} {_fmt_ci(lo, hi)}"
        else:
            diff_str = "---"
        p_str = f"{p:.4f}" if p is not None and isinstance(p, (int, float)) else "---"
        return f"{comp} & {diff_str} & {n} & {p_str} \\\\"

    lines.append(row("Baseline vs. improved", pd, n_paired, sign_p))
    if pd_std and n_paired_std is not None:
        lines.append(row("Baseline vs. standard", pd_std, n_paired_std, sign_p_std))
    lines.append("\\hline")
    lines.append("\\end{tabular}")
    lines.append("\\end{table}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export eval artifacts to paper/results_table.tex and results_delta.tex")
    parser.add_argument("--results-dir", default="evals/results", help="Path to eval results directory")
    parser.add_argument("--paper-dir", default="paper", help="Path to paper output directory")
    args = parser.parse_args()

    results_dir = ROOT / args.results_dir
    paper_dir = ROOT / args.paper_dir
    paper_dir.mkdir(parents=True, exist_ok=True)

    run_meta = load_json(results_dir / "run_metadata.json")

    # Hard gate: paper must not compile with non-submission results
    if not run_meta or run_meta.get("is_submission_run") is not True:
        (paper_dir / "results_table.tex").write_text(ERRMESSAGE_TEX, encoding="utf-8")
        (paper_dir / "results_delta.tex").write_text(ERRMESSAGE_TEX, encoding="utf-8")
        print("Wrote", paper_dir / "results_table.tex", "and", paper_dir / "results_delta.tex", "(\\errmessage gate: not a submission run)")
        print("Run a submission run (limit=500, GSM8K, dry_run=false, modes=[baseline,improved,standard], num_candidates=3) then re-run this script.", file=sys.stderr)
        sys.exit(1)

    bootstrap = load_json(results_dir / "bootstrap_results.json")
    summary_rows = load_summary_by_mode(results_dir / "summary_by_mode.csv")

    write_results_table(paper_dir, summary_rows, bootstrap, run_meta)
    write_results_delta(paper_dir, bootstrap)

    print("Wrote", paper_dir / "results_table.tex", "and", paper_dir / "results_delta.tex")


if __name__ == "__main__":
    main()
