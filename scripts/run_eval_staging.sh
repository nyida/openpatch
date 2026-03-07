#!/usr/bin/env bash
# Staging gate: limit=50, then score and analyze. Run from repo root. Next.js app + real model must be up.
set -e
cd "$(dirname "$0")/.."
CONFIG=evals/configs/large_scale.yaml
python3 -m evals.run --config "$CONFIG" --limit 50
python3 -m evals.score --config "$CONFIG"
python3 -m evals.analyze --config "$CONFIG"
echo "Staging done. Check evals/results/. Then run: ./scripts/run_eval_submission.sh"
