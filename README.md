# OpenPatch

A full-stack app that delivers higher correctness than any single LLM by orchestrating multiple models, verifying claims, and continuously evaluating regressions.

## Features

- **Pipeline modes**: Full pipeline (multi-candidate → verify → judge), **Standard** (single LLM call), **Improved** (multi-candidate with majority-vote or heuristic selection), or **CORTEX** (confidence-optimized routing: multi-model inference, confidence estimation, reliability indicator, alternative model outputs) for chat and eval.
- **Multi-candidate generation**: 2–5 candidate answers from different model configs (full pipeline or improved mode).
- **Verification**: Citation (RAG), calculator, contradiction, and safety verifiers (full pipeline only).
- **Judge**: Rubric-based selection with verifier evidence (full pipeline only).
- **Reliability report**: Retrieval usage, claims supported %, arithmetic verified, contradictions, overall confidence.
- **Trace storage**: Every run stores input, retrieval chunks, candidates, verifier results, judge decision.
- **Eval harness**: In-app suite (property-based, version-tagged) and external Python harness (baseline vs improved, ground-truth accuracy, bootstrap CIs).

## Tech stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind
- **Backend**: Next.js route handlers (API routes)
- **DB**: PostgreSQL via Prisma
- **Queue**: In-process (designed to swap to Redis later)
- **Auth**: Supabase (email/password sign-up/sign-in; Google/GitHub OAuth via Supabase Dashboard)
- **Storage**: Local disk for uploads; interface ready for S3

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL

### Commands

```bash
# Install dependencies
npm install

# Copy env and set variables
cp .env.example .env
# Edit .env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, VERSION_TAG

# Generate Prisma client and push schema (requires DATABASE_URL in .env)
npm run db:generate
npm run db:push

# Seed eval suite (39 cases)
npm run db:seed

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Note:** The Next.js build needs `DATABASE_URL` set (e.g. in `.env`) so Prisma can initialize. Use a real Postgres URL for dev; a placeholder is enough for `npm run build` only.

### LLM: 5 models, full answers, fast

**Default:** 5 candidates, 1024 tokens each (thorough answers), router/verifiers trimmed for speed. To get **full thorough responses + multiple models + extremely fast** in one go:

1. **Pull small/fast models** (so each completion finishes in ~20–40s):
2. **Run 5 Ollama instances in parallel** so all 5 candidates run at once instead of queuing:
3. **Set `OLLAMA_URLS`** in `.env` (see below).

Then total time ≈ slowest of the 5 completions (~30–60s) + judge (~5–10s) = **~40–70s** for 5 full answers.

**Single instance (simplest):** Pull all 5 models; they’ll queue on one Ollama.

```bash
ollama pull llama3.2:1b && ollama pull qwen2.5:0.5b && ollama pull mistral && ollama pull phi3:mini && ollama pull gemma2:2b
ollama pull nomic-embed-text   # optional, for RAG
```

**Five instances in parallel (faster):** Run 5 Ollama servers on ports 11434–11438, set `OLLAMA_URLS` in `.env`, and each of the 5 candidates runs on a different instance at the same time.

```bash
# In .env:
OLLAMA_URLS="http://localhost:11434/v1,http://localhost:11435/v1,http://localhost:11436/v1,http://localhost:11437/v1,http://localhost:11438/v1"
```

One-line start: run `./scripts/start-5-ollama.sh`. Or start extra instances (e.g. in separate terminals): `OLLAMA_HOST=0.0.0.0:11435 ollama serve`, then same for 11436, 11437, 11438. Load one model per instance (e.g. instance 2 runs `ollama run qwen2.5:3b` so it’s warm).

Web search (Tavily): set `TAVILY_ENABLED=true` and `TAVILY_API_KEY` when the user has no URLs/docs.

### Env vars

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Single Ollama API base (default `http://localhost:11434/v1`). Omit for production; use `OPENROUTER_API_KEY` or `OPENAI_API_KEY` instead. |
| `OLLAMA_URLS` | Comma-separated URLs for 5 parallel Ollama instances (e.g. ports 11434–11438). When set, each candidate uses a different URL. |
| `OLLAMA_MODEL` | Chat model name (default `llama3.2`). |
| `OLLAMA_EMBED_MODEL` | Embedding model (default `nomic-embed-text`). |
| `OPENROUTER_API_KEY` | For production (Vercel etc.): [OpenRouter](https://openrouter.ai) key. Used when `OLLAMA_BASE_URL`/`OLLAMA_URLS` not set. |
| `OPENAI_API_KEY` | Alternative for production: OpenAI key. Used when Ollama and OpenRouter not configured. |
| `CANDIDATE_COUNT` | Number of candidate answers per run (default 3, max 5). |
| `SKIP_ROUTER` | When unset or not `false`, task classification is skipped (task type stored as `unknown`). Set to `false` to enable router. |
| `IMPROVED_N_CANDIDATES` | Number of candidates in improved mode (default 3, min 2, max 5). |
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | 32+ char secret for encrypting stored API keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `VERSION_TAG` | Tag for regression comparison (e.g. `v1.0.0`) |
| `UPLOAD_DIR` | Local upload directory (default `./uploads`) |
| `MAX_UPLOAD_MB` | Max file size in MB (default 10) |
| `TAVILY_ENABLED` | Set to `true` to enable web search and images for visual explanations (default off for speed). |
| `TAVILY_API_KEY` | [Tavily](https://tavily.com) key when `TAVILY_ENABLED=true`. |

## Architecture (ASCII)

```
                    +------------------+
                    |   User (query,   |
                    |   docs, URLs)    |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |  POST /api/run   |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         v                   v                   v
  +-------------+   +----------------+   +----------------+
  |   ROUTER     |   |   RETRIEVE     |   |   GENERATE     |
  | (optional;   |   | (RAG or Tavily)|   | (2–5 candidates)|
  |  task type)  |   | (top-k chunks) |   |                |
  +-------------+   +----------------+   +----------------+
         |                   |                   |
         +-------------------+-------------------+
                             |
                             v
+------------------------------------------------------------------+
|   VERIFY (per candidate)                                         |
|   - Claim extraction -> Citation (vs retrieved context)          |
|   - Calculator (arithmetic)                                      |
|   - Contradiction (internal consistency)                         |
|   - Safety (refusal on disallowed content)                       |
+------------------------------------------------------------------+
                             |
                             v
                    +------------------+
                    |  JUDGE           |
                    |(rubric + evidence|
                    |  -> chosen +     |
                    |   reliability)   |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |  RESPOND         |
                    | (final answer +  |
                    |  reliability +   |
                    |  trace in DB)    |
                    +------------------+
```

## Evaluation and research

**In-app suite:** Suites and cases in the DB (seed: 39 cases). Each case has optional expected properties; runs are tagged with `VERSION_TAG`. UI: Evals page; API: `POST /api/evals/run`, `GET /api/evals/suites`, `GET /api/evals/results`.

**External harness:** Python scripts in `evals/`. Config: `evals/configs/main.yaml`. Run: `python -m evals.run --config evals/configs/main.yaml` (POSTs each dataset item to `POST /api/eval/run-one` with `mode: baseline`, `improved`, or `standard`). Score: `python -m evals.score --config ...` (accuracy, invalid-format, latency, confidence → `evals/results/`). Analyze: `python -m evals.analyze --config ...` (bootstrap CIs, calibration ECE/Brier, sign test, tables). **Staging gate:** run with `--limit 50` first to validate end-to-end, then run with limit=500 for submission. **Dry-run:** set `dry_run: true` or `EVAL_DRY_RUN=1` to use a fake LLM keyed by ground truth; dry-run is for CI/CD and pipeline verification only and must not be used for the manuscript's Results (see `evals/README.md`).


- **Run ID:** Deterministic; no time-based entropy. `runId(prompt, mode, stableContext)` with required `stableContext` (e.g. DB run UUID for chat, `dataset_id:item_id` for eval).
- **Seeding:** Canonical `seed32(input)` and `stableKeyTemperature(temp)`; baseline and improved candidate seeds include temperature in the seed input string.
- **Invalid format:** Parser-based: `invalid_format` is true when `parsed_answer` is missing or the chosen candidate’s raw output fails the strict ANSWER-line check (line-anchored `ANSWER : <value>`).
- **Improved selection (eval mode):** Majority vote on parsed answers (self-consistency); tie-break by latency then index; `final_answer` is the majority value. This improves accuracy on structured-answer tasks under format constraints; claims are scoped to that setting and do not imply general chatbot quality without further human eval or broader benchmarks.

### CORTEX mode (confidence-optimized routing)

**CORTEX** is a separate Python FastAPI backend that runs multi-model inference (Ollama: llama3, mistral, phi, gemma), logs per-(prompt, model) records for experiments, **calibrates confidence** via temperature scaling (fit on a validation split), and performs **learned routing** via a lightweight classifier trained offline to predict \(P(\text{correct})\) per model response. The UI shows **Confidence %**, **Reliability** (High/Medium/Low), and **alternative model outputs**.

- Start the CORTEX backend: `cd cortex && pip install -r requirements.txt && uvicorn backend.main:app --port 8000`
- Set `CORTEX_API_URL` in `.env` if the backend is not at `http://localhost:8000`
- On the home page, select **CORTEX** in the pipeline toggle and run a query

**Reproduce calibration + routing metrics + plots (one command):**

```bash
cd cortex
python scripts/run_all.py datasets/sample.json
```

See `cortex/README.md` for full details (splits, artifacts, ECE/Brier, reliability diagrams, bootstrap CI).

**TMLR submission (bounded empirical scale).** Use the bounded GSM8K workflow: (1) `python3 scripts/fetch_gsm8k.py` (if needed), (2) run with **limit=50** first (staging gate; see `evals/README.md`), then (3) run with **limit=500** using `evals/configs/large_scale.yaml` (Next.js + real model). Required artifacts: `evals/results/run_metadata.json` (n_used_all=500), `evals/results/metrics.csv`, `evals/results/bootstrap_results.json`. Then run `python -m evals.export_for_paper` to generate `paper/results_table.tex` and `paper/results_delta.tex`; the manuscript must include these via `\input{...}`. **Dry-run results must not appear in the paper** (pipeline sanity only). See `evals/README.md` for staging gate and dry-run quarantine.

## Key files

| Area | Path |
|------|------|
| Run pipeline | `src/lib/pipeline/run.ts` |
| Baseline (single call) | `src/lib/pipeline/baseline.ts` |
| Improved (multi-candidate select) | `src/lib/pipeline/improved.ts` |
| Router (task type) | `src/lib/pipeline/router.ts` |
| Multi-candidate gen | `src/lib/pipeline/generate.ts` |
| Judge | `src/lib/pipeline/judge.ts` |
| Reliability report | `src/lib/pipeline/reliability.ts` |
| Verifiers | `src/lib/verifiers/*.ts` (claims, citation, calculator, contradiction, safety) |
| Retrieval | `src/lib/retrieval/retrieve.ts`, `chunk.ts` |
| Run log (eval harness) | `src/lib/run-log.ts` |
| Seed / runId | `src/lib/seed.ts` |
| Eval runner (in-app) | `src/lib/evals/runner.ts` |
| API run | `src/app/api/run/route.ts` |
| API eval run-one | `src/app/api/eval/run-one/route.ts` |
| Trace viewer | `src/app/runs/[id]/page.tsx` |
| Eval UI | `src/app/evals/page.tsx` |
| DB schema | `prisma/schema.prisma` |
| Seed (39 cases) | `prisma/seed.ts` |
| External harness | `evals/run.py`, `evals/score.py`, `evals/analyze.py`, `evals/configs/main.yaml` |
| CORTEX API proxy | `src/app/api/cortex/query/route.ts` |
| CORTEX backend | `cortex/backend/main.py`, `inference.py`, `confidence.py`, `calibration.py`, `routing.py`, `experiment_runner.py` |

## Adding a new verifier

1. Implement in `src/lib/verifiers/`:
   - Input: candidate answer (and optionally user query, retrieved chunks).
   - Output: `VerificationResult` (`type`, `resultJson`, `pass`, `notes`).
2. Register in `src/lib/pipeline/run.ts`:
   - After generating candidates, for each candidate call your verifier and append to `verifications`.
   - Persist with `prisma.verification.create(...)`.
3. Optionally extend `buildReliabilityReport` in `src/lib/pipeline/reliability.ts` to include the new verifier in the explanation and confidence logic.

## Adding a new eval case

1. Add a row to the seed data in `prisma/seed.ts` (or insert via Prisma/DB):
   - `suiteId`: existing eval suite id
   - `inputText`: user question / prompt
   - `taskType`: one of `factual_with_sources`, `math_logic`, `code_assistance`, `general_writing`, `unknown`
   - `expectedPropertiesJson`: optional, e.g. `{ "minConfidence": "medium", "retrievalRequired": false }`
   - `attachmentsRef`: optional storage id if the case uses a fixture file
2. Re-run `npm run db:seed` if you extended `seed.ts`, or run a one-off script to insert the case.

## Tests

```bash
npm run test
```

Tests cover: claim extraction (mocked LLM), citation `claimsSupportedPercent`, calculator verification, reliability report aggregation.

## Security baseline

- API keys are not logged; stored keys encrypted at rest via `ENCRYPTION_KEY`.
- File uploads: type allowlist, size limit, sanitized storage path.
- Delete run: `DELETE /api/runs/[id]`.

## License

MIT.
