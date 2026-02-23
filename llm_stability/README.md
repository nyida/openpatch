# LLM Stability Experiment

Research-grade, reproducible framework for measuring **LLM stability under paraphrased prompts** using locally deployed models (Ollama). Deterministic logging, combinatorial metrics, bootstrap CIs, and publication-quality tables/figures.

## Requirements

- Python 3.11 (3.9+ may work)
- Ollama running locally (for `run_experiment.py`)
- Config and prompts in YAML/JSON; no hardcoded model names in source

## Setup

```bash
cd llm_stability
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Usage

1. **Run experiment** (calls Ollama for each model × base × paraphrase × temperature × sample):

   ```bash
   python run_experiment.py --config configs/main.yaml
   ```

2. **Score responses** (parse outputs, compute stability/accuracy, bootstrap):

   ```bash
   python score_responses.py --config configs/main.yaml
   ```

3. **Analyze** (Friedman, Wilcoxon, BH; tables and figures):

   ```bash
   python analyze.py --config configs/main.yaml
   ```

## Testing without Ollama

Generate a synthetic response log and run scoring + analysis:

```bash
python scripts/generate_synthetic_log.py
python score_responses.py --config configs/main.yaml
python analyze.py --config configs/main.yaml
```

Output: `results/metrics.csv`, `results/bootstrap_results.json`, `results/figures/`, `results/tables/`.

## Deterministic verification

With Ollama running and a model that supports `seed`:

```bash
python tests/test_deterministic.py
```

Reruns 5 deterministic calls and asserts byte-identical output.

## Directory layout

- `configs/main.yaml` — models, decoding, bootstrap, paths
- `prompts/prompts.json` — base items with paraphrases and ground truth
- `logs/responses.jsonl` — one JSON object per line (experiment log)
- `results/` — metrics.csv, bootstrap_results.json, figures/, tables/
- `src/` — ollama_client, prompt_loader, runner, parser, metrics, bootstrap, statistics, utils

## Reproducibility

- **Seed:** Uses **SHA256 only** (never Python’s `hash()`). Seed string is
  `f"{model}{base_id}{variant_id}_{temperature}_{sample_index}"`; then
  `seed = int(sha256(s).hexdigest()[:8], 16) % 2**31`. Crash-recovery key
  `(model, base_id, variant_id, temperature, seed)` matches this.
- **Log:** Each record includes `sample_index` (0 .. n_samples-1). When grouping
  responses, lists are ordered by `sample_index` (fallback: sort by `seed`) so
  “list of length n_samples” is canonically ordered by sample index.
- Config snapshot is written to `results/config_snapshot.json` by `analyze.py`.
- **Paraphrases:** Validated so all paraphrases of a base share the same
  `ground_truth` (label-invariant); instability is attributed to wording
  sensitivity, not meaning drift in the prompt set.

## Metrics

- **deterministic_stability:** Raw string equality across variant pairs × samples
  (surface-form agreement).
- **parsed_stability:** Same combinatorial definition but on **parsed labels**
  (decision-level agreement; e.g. "ANSWER: B" and "ANSWER: B." both count as "B").
- **js_stability:** JSD on **raw response strings** (surface-form volatility).
- **js_stability_parsed:** JSD on **parsed labels** (decision-level distribution
  stability). Prefer this for interpretation; keep raw JSD as auxiliary.

## Bootstrap

Pairwise model differences use **unpaired** bootstrap (A and B resampled
independently). A stricter option would be to resample over base_id once and
use the same indices for both models (paired bootstrap).
