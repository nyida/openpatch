# TMLR Submission Readiness: Empirical Scale

The current result files were produced with **n=1 (OpenPatch)** or **n_test=2 (CORTEX)**. Those sample sizes are **not** sufficient for a credible TMLR submission. Reviewers will reject on empirical grounds.

## Definitive recommendation: run full GSM8K (1319 examples)

**Do not use qa_200 as primary evidence.** The 200-example configuration is useful only for **debugging and sanity validation**. It is **insufficient** as primary evidence for a TMLR paper.

### Why full GSM8K

- **Statistical power and reviewer expectations.** Typical TMLR empirical scales:
  - Small experiments: **500+ examples** minimum
  - Standard experiments: **1000–5000** examples
  - Strong experiments: multiple datasets totaling several thousand examples

- **GSM8K full test split (1319 examples)** meets the **standard** threshold.  
- **qa_200 does not.** Using qa_200 as primary evidence would weaken the submission substantially.

---

## Correct execution order (must be followed exactly)

From **repository root**:

### Step 1 — Fetch dataset

```bash
python3 scripts/fetch_gsm8k.py
```

Requires: `pip install datasets` (or `python3 -m pip install datasets`). Writes **evals/datasets/gsm8k.json** (~1319 items). Uses `.cache/huggingface` in the repo. First run may take 2–5 minutes.

### Step 2 — Run OpenPatch evaluation

**Next.js must already be running** (e.g. `npm run dev`).

```bash
python3 -m evals.run --config evals/configs/large_scale.yaml
python3 -m evals.score --config evals/configs/large_scale.yaml
python3 -m evals.analyze --config evals/configs/large_scale.yaml
```

Working directory: repository root.

### Step 3 — Run CORTEX evaluation

```bash
cd cortex
python3 scripts/run_all.py ../evals/datasets/gsm8k.json
```

Working directory for the script: **cortex/** (so `backend` and `datasets` resolve).

This produces **scientifically valid metrics** for the paper.

---

## Required output artifacts (must exist)

These files must be **populated** after the run:

| Source | Required files |
|--------|----------------|
| **OpenPatch** | `evals/results/metrics.csv` |
| | `evals/results/bootstrap_results.json` |
| **CORTEX** | `cortex/experiments/<run_id>/metrics.json` (e.g. `gsm8k_run`) |

### Critical required property

In **cortex/experiments/<run_id>/metrics.json**:

- **`n_test` ≈ 1319**

Not 200, not 2, not 1. If `n_test` is not ~1319, the run is not submission-standard.

---

## What reviewers expect in the paper

Replace placeholder numbers with a table with **n = 1319** (or the actual test count from GSM8K), e.g.:

| Method           | Accuracy | ECE ↓ | Brier ↓ | n    |
|------------------|----------|-------|---------|------|
| Baseline         | …        | …     | …       | 1319 |
| Majority vote    | …        | …     | …       | 1319 |
| OpenPatch (full) | …        | …     | …       | 1319 |
| CORTEX routing   | …        | …     | …       | 1319 |

Plus **confidence intervals** (e.g. bootstrap 95% CI).

---

## qa_200: debugging and sanity only

**evals/configs/large_scale_qa200.yaml** and **evals/datasets/qa_200.json** (200 items) may be used for:

- Debugging the pipeline
- Sanity checks (e.g. CORTEX venv, Ollama, Next.js wiring)

They are **not** sufficient as primary evidence for TMLR. Do **not** report n=200 as the main empirical result.

---

## Summary

| Step | Command (from repo root) |
|------|---------------------------|
| 1. Fetch GSM8K | `python3 scripts/fetch_gsm8k.py` |
| 2. OpenPatch eval | Next.js running → `python3 -m evals.run --config evals/configs/large_scale.yaml` then `score` and `analyze` |
| 3. CORTEX | `cd cortex && python3 scripts/run_all.py ../evals/datasets/gsm8k.json` |
| 4. Paper | Fill table and CIs from `evals/results/` and `cortex/experiments/gsm8k_run/metrics.json`; ensure **n_test ≈ 1319** |

**Without full GSM8K scale (n_test ≈ 1319), the paper will be rejected regardless of writing quality.**

---

## Final readiness threshold

The repository and documentation are aligned with TMLR’s reproducibility and methodological transparency expectations. No further infrastructure changes are required.

**Submission-enabling condition:** Once full GSM8K empirical results exist and are inserted into the manuscript, the project is **fully submission-ready** for TMLR with no remaining structural or policy blockers.

That means:

1. **Execute** the three-step pipeline (fetch → OpenPatch eval → CORTEX) with full GSM8K.
2. **Confirm** these artifacts exist and are populated: `evals/results/metrics.csv`, `evals/results/bootstrap_results.json`, `cortex/experiments/<run_id>/metrics.json` (with n_test ≈ 1319).
3. **Insert** the resulting numbers (accuracy, ECE, Brier, routing lift, CIs, n) into the paper’s result tables and any placeholder macros.

Reviewers will check: empirical scale (GSM8K full test set), correctness and reproducibility of the evaluation pipeline, statistical significance of reported improvements, and methodological clarity of the reliability and routing approach. The repository supports all four; only the actual execution and insertion of results remain.
