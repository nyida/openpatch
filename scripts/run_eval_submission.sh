#!/usr/bin/env bash
# Submission run: limit=500 (from config), score, analyze, export for paper. Run from repo root.
set -e
cd "$(dirname "$0")/.."
CONFIG=evals/configs/large_scale.yaml
python3 -m evals.run --config "$CONFIG"
python3 -m evals.score --config "$CONFIG"
python3 -m evals.analyze --config "$CONFIG"
python3 -m evals.export_for_paper
echo "Submission run done. paper/results_table.tex and results_delta.tex updated. Compile the paper."
