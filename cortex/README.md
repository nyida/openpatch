# CORTEX: Confidence-Optimized Routing and Trust Evaluation for eXplainable Language Models

CORTEX measures, predicts, and improves the reliability of language model outputs by estimating correctness probability and dynamically selecting optimal inference strategies. It runs alongside the existing OpenPatch UI as a third pipeline mode.

## Layers

1. **User Interface** — Existing Next.js app; CORTEX mode shows Answer, Confidence %, Reliability (High/Medium/Low), and alternative model outputs.
2. **Inference Engine** — Multi-model Ollama: same prompt to llama3, mistral, phi, gemma.
3. **Reliability Estimation** — Confidence from response length, token entropy, self-consistency (agreement across models).
4. **Routing** — Select best model by confidence (or train a lightweight classifier on experiment data).
5. **Experiment & Logging** — SQLite DB (queries, responses, routing); experiment runner over datasets; ECE, Brier, reliability diagrams.

## Quick start

### Backend (Python FastAPI)

```bash
cd cortex
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
# Optional: set OLLAMA_BASE_URL, CORTEX_MODELS (comma-separated)
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

The Next.js app (root) proxies CORTEX to `http://localhost:8000` by default. Set `CORTEX_API_URL` in `.env` if the backend runs elsewhere.

1. Run Ollama with models: `ollama pull llama3 mistral phi gemma`
2. Start CORTEX backend (port 8000)
3. Start Next.js: `npm run dev`
4. On the home page, choose **CORTEX** in the pipeline toggle and run a query.

### Experiment runner

```bash
cd cortex
source .venv/bin/activate
# Create a small dataset (JSON array with prompt, ground_truth)
python -m backend.experiment_runner
# Or with a dataset path (optional):
# python -c "
# from backend.experiment_runner import run_experiment, load_dataset
# run_experiment('cortex/datasets/sample.json', output_dir='cortex/experiments')
# "
```

Dataset format: JSON array of `{"prompt": "...", "ground_truth": "..."}` or `{"question": "...", "answer": "..."}`.

## Database

SQLite by default: `cortex/data/cortex.db`. Set `CORTEX_DB_PATH` to override. Tables: `queries`, `responses`, `routing`, and `experiment_records` (per-prompt, per-model rows with `raw_confidence`, `feature_json`, `correct`, `dataset_name`, `split` for calibration and router training).

## Calibration & Learned Routing

Confidence is calibrated via temperature scaling (fit on validation split to minimize ECE). The router is a lightweight classifier (LogisticRegression) trained on experiment records to predict P(correct) per model; at inference the model with highest predicted correctness is selected. Training is offline; live `/query` only loads artifacts.

**One command to reproduce metrics and plots** (from repo root, with Ollama and models available):

```bash
cd cortex
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/run_all.py datasets/sample.json
```

This (1) runs the experiment (collects records with train/val/test split), (2) trains temperature scaling and writes `models/calibration.json`, (3) trains the router and writes `models/router.pkl` and `models/router_metadata.json`, (4) evaluates on the test split and writes to `experiments/<dataset>_run/metrics.json`, `reliability_before.json`, `reliability_after.json`, and PNGs `reliability_diagram_before.png`, `reliability_diagram_after.png`.

**Step-by-step** (same env):

```bash
# 1) Collect per-(prompt, model) records (train/val/test split)
python -m backend.experiment_runner datasets/sample.json

# 2) Fit temperature scaling on val split
python -m backend.calibration_train

# 3) Train router on train split
python -m backend.router_train

# 4) Evaluate on test split (baseline vs routed accuracy, ECE/Brier before/after, bootstrap 95% CI, plots)
python -m backend.evaluate
```

Outputs: `cortex/models/calibration.json`, `cortex/models/router.pkl`, `cortex/models/router_metadata.json`, and `cortex/experiments/<run_id>/metrics.json`, `reliability_before.json`, `reliability_after.json`, `reliability_diagram_before.png`, `reliability_diagram_after.png`. All steps use a fixed random seed (42) for reproducibility.

## Metrics

- **Accuracy** — Fraction correct (when ground truth available).
- **Expected Calibration Error (ECE)** — Guo et al. 2017.
- **Brier score** — Mean squared error of confidence vs correctness.
- **Reliability diagram** — Bins (confidence, accuracy, count) for plotting.
- **Routing improvement** — Routed accuracy minus baseline (first-model) accuracy.

## References

- Guo et al., 2017 — On Calibration of Modern Neural Networks (arXiv:1706.04599)
- Lakshminarayanan et al., 2017 — Simple and Scalable Predictive Uncertainty Estimation (arXiv:1612.01474)
- Jiang et al., 2021 — How Can We Know What Language Models Know (arXiv:1911.12543)
- Niculescu-Mizil and Caruana, 2005 — Reliability diagrams
