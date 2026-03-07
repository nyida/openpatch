# Claims→Evidence Checklist (TMLR draft)

Each technical claim in the paper is tied to a code anchor and/or artifact. Evidence types: **code** (file path + function/symbol), **artifact** (generated file path), **bib** (citation key).

---

## File map (paths only)

### OpenPatch
- **Pipeline entry, branching:** `src/lib/pipeline/run.ts` (`executeRun`), `src/lib/pipeline/baseline.ts` (`runBaseline`), `src/lib/pipeline/improved.ts` (`runImproved`), `src/lib/pipeline/generate.ts`, `src/lib/pipeline/types.ts`, `src/lib/pipeline/router.ts`
- **Verifiers:** `src/lib/verifiers/index.ts`, `src/lib/verifiers/calculator.ts`, `src/lib/verifiers/citation.ts`, `src/lib/verifiers/claims.ts`, `src/lib/verifiers/contradiction.ts`, `src/lib/verifiers/safety.ts`
- **Judge:** `src/lib/pipeline/judge.ts` (`runJudge`)
- **Reliability:** `src/lib/pipeline/reliability.ts` (`buildReliabilityReport`)
- **Persistence / trace:** `src/lib/run-log.ts` (`appendRun`, `getRunsLogPath`), `src/lib/seed.ts` (`seed32`, `stableKeyTemperature`, `runId`), Prisma schema `prisma/schema.prisma`
- **Eval surfaces (in-app):** `src/app/api/run/route.ts`, `src/app/api/eval/run-one/route.ts`, `src/app/api/evals/run/route.ts`, `src/app/api/evaluation/run/route.ts`, `src/app/api/evaluation/score/route.ts`, `src/app/api/evaluation/analyze/route.ts`, `src/app/api/evaluation/results/route.ts`, `src/app/api/evaluation/figures/[name]/route.ts`
- **Eval surfaces (external):** `evals/run.py`, `evals/score.py`, `evals/analyze.py`; config `evals/configs/main.yaml`
- **Determinism:** `src/lib/seed.ts` (`runId`, `seed32`, `stableKeyTemperature`), `src/lib/run-log.ts` (`runId`)

### CORTEX
- **Inference:** `cortex/backend/inference.py`
- **Confidence features:** `cortex/backend/confidence.py` (`extract_confidence_features`, `features_to_dict`, `extract_per_response_features`, `confidence_score_from_features`)
- **Calibration:** `cortex/backend/calibration.py` (`apply_temperature_to_confidence`, `expected_calibration_error`, `brier_score`), `cortex/backend/calibration_train.py` (`train_temperature`)
- **Routing (inference):** `cortex/backend/routing.py` (`build_feature_vector`, `select_model_with_router`)
- **Router training:** `cortex/backend/router_train.py` (`train_router`, `_feature_vector_from_record`)
- **Experiment runner:** `cortex/backend/experiment_runner.py` (`run_experiment`, `_assign_splits`, `load_dataset`)
- **Evaluation:** `cortex/backend/evaluate.py` (`run_evaluate`, `_router_predict_proba`, `_get_ollama_version`)
- **run_all:** `cortex/scripts/run_all.py`
- **SQLite schema:** `cortex/backend/database.py` (`init_schema` — queries, responses, routing, experiment_records)
- **API:** `cortex/backend/main.py` (`/query`)

---

## Claims→Evidence Table

| # | Claim | Evidence (artifact path) | Code anchor |
|---|--------|---------------------------|-------------|
| 1 | OpenPatch has a single pipeline entry that branches by mode (full / baseline / improved). | — | `src/lib/pipeline/run.ts` :: `executeRun`, branching on `input.improvedMode` |
| 2 | Full pipeline runs retrieval, multi-candidate generation, verifiers, judge, and reliability report. | — | `src/lib/pipeline/run.ts` (retrieve, generateCandidates, verify*, runJudge, buildReliabilityReport) |
| 3 | Baseline mode is a single LLM call with deterministic seed. | — | `src/lib/pipeline/baseline.ts` :: `runBaseline`; `src/lib/seed.ts` :: `seed32`, `stableKeyTemperature` |
| 4 | Improved mode uses N candidates and majority vote (eval) or heuristic (chat). | — | `src/lib/pipeline/improved.ts` :: `runImproved` |
| 5 | Verifiers are programmatic: calculator, citation, contradiction, safety. | — | `src/lib/verifiers/calculator.ts`, `citation.ts`, `contradiction.ts`, `safety.ts`; `src/lib/verifiers/index.ts` |
| 6 | Judge is an LLM that selects a candidate using verification summaries. | — | `src/lib/pipeline/judge.ts` :: `runJudge` |
| 7 | Reliability report aggregates verifier outcomes and retrieval/citation. | — | `src/lib/pipeline/reliability.ts` :: `buildReliabilityReport` |
| 8 | Run ID is deterministic: runId(prompt, mode, stableContext); no time-based entropy. | — | `src/lib/seed.ts` :: `runId`; `src/lib/run-log.ts` :: `runId` |
| 9 | External harness runs baseline and improved via POST /api/eval/run-one; logs to runs.jsonl. | `app_runs/logs/runs.jsonl` | `src/app/api/eval/run-one/route.ts`; `evals/run.py`; `src/lib/run-log.ts` :: `appendRun` |
| 10 | Harness score and analyze produce metrics and bootstrap CIs. | `evals/results/metrics.csv`, `evals/results/` | `evals/score.py`, `evals/analyze.py` |
| 11 | CORTEX uses multi-model inference and ensemble confidence features. | — | `cortex/backend/inference.py`; `cortex/backend/confidence.py` :: `extract_confidence_features`, `features_to_dict` |
| 12 | Calibration is applied to a heuristic confidence score via logit-space temperature scaling; not token logprobs. | — | `cortex/backend/calibration.py` (module docstring, `apply_temperature_to_confidence`); bib: Guo et al. |
| 13 | Temperature is fit on validation split (minimize ECE/NLL). | `cortex/models/calibration.json` | `cortex/backend/calibration_train.py` :: `train_temperature` |
| 14 | Router uses a single shared feature builder at training and inference (isomorphic). | `cortex/models/router_metadata.json` (feature_order, n_features) | `cortex/backend/routing.py` :: `build_feature_vector`; `cortex/backend/router_train.py` :: `_feature_vector_from_record` (calls `build_feature_vector`) |
| 15 | When router is used, confidence and reliability are per-model; ensemble_confidence is optional. | — | `cortex/backend/main.py` (router_used branch: confidence = selected_confidence, alternatives[i].confidence = per_model_probs[i], ensemble_confidence optional) |
| 16 | Experiment runner assigns deterministic 60/20/20 split per prompt; split rule documented. | — | `cortex/backend/experiment_runner.py` :: `_assign_splits`, `SPLIT_RULE` |
| 17 | Evaluation computes baseline, routed, and oracle accuracy; bootstrap unit is prompt. | `cortex/experiments/<run_id>/metrics.json` | `cortex/backend/evaluate.py` :: `run_evaluate` (oracle_correct, bootstrap over prompt indices) |
| 18 | metrics.json contains baseline_accuracy, routed_accuracy, oracle_accuracy, routing_lift, routing_lift_ci_95, ece_*, brier_*, temperature, bootstrap_seed, n_bootstrap, split_seed, split_rule, models, ollama_version. | `cortex/experiments/<run_id>/metrics.json` | `cortex/backend/evaluate.py` (metrics dict and write) |
| 19 | Reliability diagrams (before/after calibration) are written. | `cortex/experiments/<run_id>/reliability_before.json`, `reliability_after.json`, `reliability_diagram_*.png` | `cortex/backend/evaluate.py` (reliability_before/after, PNGs) |
| 20 | run_all.py runs experiment → calibration_train → router_train → evaluate and writes metrics. | `cortex/experiments/<dataset>_run/metrics.json` | `cortex/scripts/run_all.py` :: `main` |

---

## Artifact reproduction

**OpenPatch evaluation (from repo root):**
```bash
python -m evals.run --config evals/configs/main.yaml
python -m evals.score --config evals/configs/main.yaml
python -m evals.analyze --config evals/configs/main.yaml
```
Working directory: repository root. Logs: `app_runs/logs/runs.jsonl`; results: `evals/results/`.

**CORTEX run_all (from repo root):**
```bash
cd cortex && python scripts/run_all.py datasets/sample.json
```
Working directory for the Python process: `cortex/`. Produces `cortex/experiments/<dataset_stem>_run/metrics.json`, `reliability_*.json`, `reliability_diagram_*.png`; optional second arg: DB path.

---

## TMLR submission: full GSM8K required (n_test ≈ 1319)

**Current results are not submission-ready.** CORTEX had `n_test=2`; OpenPatch had n=1. TMLR requires **full GSM8K (1319 examples)** as primary evidence. The 200-example config (qa_200) is for **debugging and sanity only**—not sufficient for the paper. See **docs/TMLR_SUBMISSION_READINESS.md** for the exact order:

1. **Fetch GSM8K:** `python3 scripts/fetch_gsm8k.py` → `evals/datasets/gsm8k.json` (~1319 items).
2. **OpenPatch:** Next.js running → `python3 -m evals.run --config evals/configs/large_scale.yaml`, then `score` and `analyze`.
3. **CORTEX:** `cd cortex && python3 scripts/run_all.py ../evals/datasets/gsm8k.json` → `cortex/experiments/gsm8k_run/metrics.json`.
4. **Required artifacts:** `evals/results/metrics.csv`, `evals/results/bootstrap_results.json`, and CORTEX `metrics.json` with **n_test ≈ 1319**. Fill the paper table from these.

## If no CORTEX experiment outputs exist (sanity check only)

For a quick sanity check (not for submission): from repo root, `cd cortex && python scripts/run_all.py datasets/sample.json`. Then open `cortex/experiments/sample_run/metrics.json` and substitute in `paper/tmlr_openpatch_cortex.tex`: `\CORTEXbaseline`, `\CORTEXrouted`, etc., from the JSON. These numbers remain n_test=2 and are not scientifically valid for TMLR.
