#!/bin/bash
# TMLR submission pipeline: full GSM8K (1319 examples) only. qa_200 is for debugging/sanity only.
# Run from repo root. Requires: Next.js for step 2, Ollama for step 3.
set -e
cd "$(dirname "$0")/.."
echo "=== Step 1 — Fetch GSM8K (1319 test items) ==="
python3 scripts/fetch_gsm8k.py || { echo "Install: pip install datasets"; exit 1; }
echo ""
echo "=== Step 2 — OpenPatch eval (Next.js must be running: npm run dev) ==="
read -p "Press Enter when Next.js is running on :3000, or Ctrl+C to skip..."
python3 -m evals.run --config evals/configs/large_scale.yaml
python3 -m evals.score --config evals/configs/large_scale.yaml
python3 -m evals.analyze --config evals/configs/large_scale.yaml
echo "Required artifacts: evals/results/metrics.csv, evals/results/bootstrap_results.json"
echo ""
echo "=== Step 3 — CORTEX (Ollama + models: llama3, mistral, phi, gemma) ==="
read -p "Press Enter to run CORTEX run_all, or Ctrl+C to skip..."
cd cortex && python3 scripts/run_all.py ../evals/datasets/gsm8k.json
echo "Required: cortex/experiments/gsm8k_run/metrics.json with n_test ≈ 1319"
echo ""
echo "Done. Fill paper from evals/results/ and cortex/experiments/gsm8k_run/metrics.json"
