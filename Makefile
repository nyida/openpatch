# Eval harness: staging gate then submission. Ensure Next.js app is running and a real model is available.
CONFIG := evals/configs/large_scale.yaml
PYTHON := python3
VENV_PYTHON := .venv-evals/bin/python

.PHONY: eval-staging eval-submission fetch-gsm8k

# Download GSM8K to evals/datasets/gsm8k.json (requires: pip install datasets). Run once before eval-staging.
fetch-gsm8k:
	$(VENV_PYTHON) -c "import datasets" 2>/dev/null || (.venv-evals/bin/pip install datasets -q && true)
	$(VENV_PYTHON) scripts/fetch_gsm8k.py
	@echo "Done. evals/datasets/gsm8k.json ready. Run: make eval-staging"

# Staging: limit=50, then score and analyze. Run this first to validate before the full run.
eval-staging:
	$(PYTHON) -m evals.run --config $(CONFIG) --limit 50
	$(PYTHON) -m evals.score --config $(CONFIG)
	$(PYTHON) -m evals.analyze --config $(CONFIG)
	@echo "Staging done. Check evals/results/. Then run: make eval-submission"

# Submission: limit=500 (from config), score, analyze, export for paper. Requires is_submission_run to become true.
eval-submission:
	$(PYTHON) -m evals.run --config $(CONFIG)
	$(PYTHON) -m evals.score --config $(CONFIG)
	$(PYTHON) -m evals.analyze --config $(CONFIG)
	$(PYTHON) -m evals.export_for_paper
	@echo "Submission run done. paper/results_table.tex and results_delta.tex updated. Compile the paper."
