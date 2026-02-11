# OpenPatch

A full-stack app that delivers higher correctness than any single LLM by orchestrating multiple models, verifying claims, and continuously evaluating regressions.

## Features

- **Multi-candidate generation**: 2–4 candidate answers from different model configs
- **Verification**: Citation (RAG), calculator, contradiction, and safety verifiers
- **Judge**: Rubric-based selection with verifier evidence
- **Reliability report**: Retrieval usage, claims supported %, arithmetic verified, contradictions, overall confidence
- **Trace storage**: Every run stores input, retrieval chunks, candidates, verifier results, judge decision
- **Eval harness**: Fixed test suite, version comparison, regression tracking

## Tech stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind
- **Backend**: Next.js route handlers (API routes)
- **DB**: PostgreSQL via Prisma
- **Queue**: In-process (designed to swap to Redis later)
- **Auth**: Passwordless demo (magic-link style session by email)
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
# Edit .env: DATABASE_URL, OPENAI_API_KEY, ENCRYPTION_KEY, NEXTAUTH_SECRET, VERSION_TAG

# Generate Prisma client and push schema (requires DATABASE_URL in .env)
npm run db:generate
npm run db:push

# Seed eval suite (30+ cases)
npm run db:seed

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Note:** The Next.js build needs `DATABASE_URL` set (e.g. in `.env`) so Prisma can initialize. Use a real Postgres URL for dev; a placeholder is enough for `npm run build` only.

### Env vars

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | **Preferred.** One key for multiple models (OpenAI, Claude, etc.) via [OpenRouter](https://openrouter.ai). When set, used for all chat and embeddings. |
| `OPENAI_API_KEY` | OpenAI API key (used only when `OPENROUTER_API_KEY` is not set) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | 32+ char secret for encrypting stored API keys |
| `NEXTAUTH_SECRET` | Session secret |
| `NEXTAUTH_URL` | App URL (e.g. http://localhost:3000) |
| `VERSION_TAG` | Tag for regression comparison (e.g. `v1.0.0`) |
| `UPLOAD_DIR` | Local upload directory (default `./uploads`) |
| `MAX_UPLOAD_MB` | Max file size in MB (default 10) |

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
  | (task type)  |   | (RAG chunks)   |   | (2-4 candidates)|
  +-------------+   +----------------+   +----------------+
         |                   |                   |
         +-------------------+-------------------+
                             |
                             v
  +------------------------------------------------------------------+
  |  VERIFY (per candidate)                                          |
  |  - Claim extraction -> Citation (vs retrieved context)          |
  |  - Calculator (arithmetic)                                       |
  |  - Contradiction (internal consistency)                           |
  |  - Safety (refusal on disallowed content)                         |
  +------------------------------------------------------------------+
                             |
                             v
                    +------------------+
                    |  JUDGE           |
                    | (rubric + evidence|
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

## Key files

| Area | Path |
|------|------|
| Run pipeline | `src/lib/pipeline/run.ts` |
| Router (task type) | `src/lib/pipeline/router.ts` |
| Multi-candidate gen | `src/lib/pipeline/generate.ts` |
| Judge | `src/lib/pipeline/judge.ts` |
| Reliability report | `src/lib/pipeline/reliability.ts` |
| Verifiers | `src/lib/verifiers/*.ts` (claims, citation, calculator, contradiction, safety) |
| Retrieval | `src/lib/retrieval/retrieve.ts`, `chunk.ts` |
| Eval runner | `src/lib/evals/runner.ts` |
| API run | `src/app/api/run/route.ts` |
| Trace viewer | `src/app/runs/[id]/page.tsx` |
| Eval UI | `src/app/evals/page.tsx` |
| DB schema | `prisma/schema.prisma` |
| Seed (30+ cases) | `prisma/seed.ts` |

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
