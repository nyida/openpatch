# External evaluation harness

Config-driven run → score → analyze with baseline, improved, and standard modes. Produces `evals/results/` (metrics, bootstrap CIs, calibration) and `paper/results_table.tex` / `paper/results_delta.tex` via `export_for_paper.py`.

## Staging gate (mandatory)

Run a **short** eval first to validate end-to-end correctness before the full submission run.

1. **limit=50, real model**
   - Start the Next.js app and ensure a real LLM is available (e.g. Ollama).
   - One command: `make eval-staging` or `./scripts/run_eval_staging.sh`
   - Or step by step: `python -m evals.run --config evals/configs/large_scale.yaml --limit 50`, then `evals.score`, then `evals.analyze`.
   - Confirm: `evals/results/metrics.csv` has 50×modes rows, `bootstrap_results.json` has accuracy CIs and (if standard mode ran) calibration and sign-test fields.
   - This prevents wasted compute on a broken pipeline.

2. **limit=500, real model (submission dataset)**
   - One command: `make eval-submission` or `./scripts/run_eval_submission.sh`
   - Or same run/score/analyze commands without `--limit`; then `python -m evals.export_for_paper`.
   - Produces the artifacts required for the manuscript: `run_metadata.json` (n_used_all=500, is_submission_run=true), `metrics.csv`, `bootstrap_results.json`, and `paper/results_table.tex`, `paper/results_delta.tex`.

## Dry-run quarantine

**Dry-run** (`EVAL_DRY_RUN=1` or `dry_run: true` in config) uses a fake LLM keyed by ground truth. It is acceptable **only** for:

- CI/CD regression tests
- Demonstrating determinism
- Verifying logging, metadata, and table generation (e.g. that `export_for_paper.py` runs and writes valid `.tex`)

Dry-run results **must not** appear in the main Results section of the manuscript, and **must not** be used as “placeholder results.” Reviewers will treat that as methodological contamination. The paper’s empirical claims must come from a **real-model** run (staging with limit=50, then submission with limit=500).

## Submission run gate

`run_metadata.json` includes `is_submission_run: true` only when all of the following hold: `dry_run` is false, dataset is GSM8K, `n_used_all` equals the config’s `submission_n` (default 500), `modes` include baseline, improved, and standard, and `num_candidates == 3`. **Export-for-paper hard gate:** if `is_submission_run` is not true, the script writes `paper/results_table.tex` and `paper/results_delta.tex` with LaTeX `\errmessage{...}` so the paper **refuses to compile**. This prevents accidental inclusion of small or dry-run results in a submission repo. Only a full submission run (limit=500, GSM8K, real model, three modes, three candidates) produces tables that compile.

## Export for paper

After a **submission** run (run → score → analyze with `is_submission_run: true`):

```bash
python -m evals.export_for_paper --results-dir evals/results --paper-dir paper
```

This writes `paper/results_table.tex` (per-mode accuracy, invalid rate, ECE, Brier, n) and `paper/results_delta.tex` (paired differences and sign-test p-values). The manuscript must include these via `\input{paper/results_table.tex}` and `\input{paper/results_delta.tex}` so that the paper cannot drift from the artifacts. Do not replace them with static placeholders.

## Configs

- `evals/configs/main.yaml` — general harness config (datasets, runs_log, results_dir, bootstrap).
- `evals/configs/large_scale.yaml` — bounded TMLR run: limit=500, seed=42, modes=[baseline, improved, standard], num_candidates=3. Model and `CANDIDATE_COUNT` are set via environment when running the Next.js app.

## Provenance

`evals/results/run_metadata.json` (written after each run) records: started_at, finished_at, seed, limit, modes, num_candidates, per-dataset (name, path, n_total, n_used, skipped, optional sha256), n_total_all, n_used_all, skipped_all, optional config_sha256. Use it to answer reviewer questions about sample size, datasets, and determinism.
