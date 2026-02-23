---
title: 'OpenPatch: A verification-first pipeline and evaluation harness for reliable language model outputs'
tags:
  - JavaScript
  - TypeScript
  - natural language processing
  - large language models
  - verification
  - evaluation
  - Next.js
  - reproducibility
authors:
  - name: Author Name
    orcid: 0000-0000-0000-0000
    affiliation: "1"
affiliations:
  - name: Institution, Country
    index: 1
date: 23 February 2025
bibliography: paper.bib
---

# Summary

Large language models (LLMs) are increasingly used for question-answering and assistance, but single-model outputs are prone to arithmetic errors, unsupported factual claims, and internal contradictions. OpenPatch is an open-source system that improves correctness and calibratability by orchestrating multiple candidate answers, running a verification layer (arithmetic, citation support, contradiction detection, safety), and using an LLM judge to select a single answer with access to verifier evidence. Every run produces a structured reliability report and a full trace stored for audit and analysis. The software supports three modes: a full pipeline (multi-candidate → verify → judge), a baseline (single LLM call with deterministic seeding), and an improved mode (multi-candidate with majority-vote or heuristic selection). It includes an in-app evaluation suite with property-based expectations and version-tagged regression tracking, and an external Python harness for reproducible baseline-vs-improved benchmarks with ground-truth accuracy and bootstrap confidence intervals. OpenPatch is implemented as a Next.js application with a TypeScript backend, PostgreSQL persistence via Prisma, and optional retrieval over user-supplied documents or web search (Tavily). It is designed for researchers and practitioners who need transparent, auditable, and continuously evaluable LLM-based systems.

# Statement of need

Researchers and practitioners deploying LLMs for factual or reasoning tasks need software that (1) reduces errors by combining multiple candidates and verification, (2) exposes reliability signals (e.g., claims supported by retrieval, arithmetic checked, contradictions flagged), and (3) supports reproducible evaluation and regression tracking. Existing tooling often focuses on single-model APIs or proprietary pipelines without open traceability or a standardized evaluation harness. OpenPatch addresses this gap by providing a single, open codebase that implements a verification-first architecture: optional task classification; retrieval over user documents or optional web search; parallel multi-candidate generation; programmatic verifiers (calculator, citation, contradiction, safety); an LLM judge that selects using verifier evidence; and a reliability report plus full trace persistence. The target audience includes NLP and ML researchers studying LLM reliability, practitioners building assistive or QA systems, and anyone needing to compare baseline vs. multi-candidate strategies under reproducible conditions. The software integrates with local model servers (e.g., Ollama) by default, avoiding mandatory API keys, and exposes both a web UI and REST APIs so that the same pipeline can drive interactive use and batch evaluation. A companion methodology paper describes the design in more detail; OpenPatch itself is the reference implementation and the vehicle for reproducible benchmarks.

# State of the field

Several strands of related work exist. Frameworks such as LangChain and LlamaIndex provide orchestration and RAG patterns but do not bundle a fixed verification layer (calculator, citation, contradiction, safety) with a judge and a single reliability report. Evaluation platforms (e.g., HELM, Open LLM Leaderboard, or library-specific eval tools) focus on benchmarking models on tasks and metrics rather than shipping a full pipeline that both generates and verifies answers with trace storage. Research on LLM-as-a-judge [@zheng2023judging] and on claim-level citation [@gao2023pal] informs our judge and citation verifier design, but we are not aware of an open, integrated system that combines multi-candidate generation, multiple verifiers, a judge, reliability reporting, and a reproducible baseline-vs-improved evaluation harness in one repository.

OpenPatch was built as a standalone application rather than as a contribution to an existing framework for several reasons. First, we wanted a single deployable stack (web app, database, eval scripts) with a clear pipeline contract and deterministic run IDs for reproducibility. Second, the verification layer and reliability report are first-class design goals; they are not optional plugins but core to the architecture. Third, the external Python harness (run → score → analyze with bootstrap CIs) is tailored to our baseline and improved modes and to our API; reusing a generic eval framework would have required substantial adaptation. OpenPatch thus occupies a niche: an open, verification-first pipeline with full traceability and a ready-to-use evaluation harness for comparing single-call vs. multi-candidate strategies.

# Software design

OpenPatch is organized around a single pipeline entry point (`src/lib/pipeline/run.ts`) that branches by mode. When the caller does not request baseline or improved mode, the full pipeline runs: optional task classification (LLM, disabled by default via `SKIP_ROUTER`); retrieval (chunk documents, embed query and chunks, top-k by cosine similarity) or optional web search (Tavily) when no documents are provided; parallel multi-candidate generation (N model configurations, same prompt); per-candidate verification (calculator, contradiction, safety, and when RAG was used, claim extraction plus citation); judge (LLM selects one candidate using verification summaries); and aggregation of the chosen candidate’s verifications into a reliability report (retrieval used, claims supported %, arithmetic verified, contradictions, overall confidence). All runs are persisted (Run, RetrievalChunk, Candidate, Verification, JudgeDecision) for inspection and analysis. When baseline or improved mode is requested (e.g., from the UI or from `POST /api/eval/run-one`), the pipeline instead calls `runBaseline` (single LLM call, deterministic seed) or `runImproved` (N candidates, then majority vote on parsed answers in eval mode or a heuristic in chat mode); these paths avoid the full verification stack and judge to support fast, reproducible benchmarks.

The codebase follows common JavaScript/TypeScript conventions: Next.js 14 App Router for routes and UI, Prisma for schema and persistence, and a clear separation between pipeline logic (`src/lib/pipeline/`), verifiers (`src/lib/verifiers/`), retrieval (`src/lib/retrieval/`), and run logging (`src/lib/run-log.ts`, `src/lib/seed.ts`) for the external harness. Configuration is environment-based (`.env`); the eval harness uses a YAML config (`evals/configs/main.yaml`) for datasets, log paths, and bootstrap settings. Determinism is enforced via canonical seeding (`seed32`, `stableKeyTemperature`) and run IDs (`runId(prompt, mode, stableContext)`), so that repeated runs with the same inputs produce the same results for baseline and improved modes. The design prioritizes local execution (Ollama) and optional cloud APIs (OpenAI, OpenRouter) so that reviewers and users can run the software without mandatory paid services. Reviewers can verify correctness by running the automated test suite (`npm run test`) and, for the evaluation pipeline, by running the external harness in dry-run mode (see README), which uses a fake LLM keyed by ground truth and requires no live model server.

# Research impact statement

OpenPatch provides immediate value as a reference implementation of a verification-first LLM pipeline and as a reproducible evaluation harness. The in-app suite (39 seeded cases across factual, math, code, and general-writing tasks) and the external Python harness (config-driven run/score/analyze with baseline vs. improved comparison, bootstrap confidence intervals, and summary tables) enable researchers to replicate and extend comparisons of single-call vs. multi-candidate strategies. The repository includes deterministic run IDs, seeded generation, and a dry-run mode (fake LLM keyed by ground truth) so that the evaluation pipeline can be tested without live model calls. We expect the software to support (1) methodological work on LLM verification and reliability reporting, (2) empirical studies comparing baseline and improved modes on custom datasets, and (3) adoption by practitioners who need auditable, evaluable assistants. A companion methods paper is planned or in preparation; OpenPatch is the artifact that will be cited for the implementation and for reproducing the evaluation setup.

# AI usage disclosure

The authors used generative AI tools for selected tasks during development and documentation. AI was used for: drafting and editing portions of documentation and of this manuscript; suggesting code structure and refactors in non-critical paths; and copy-editing. All AI-assisted text and code was reviewed, edited, and validated by the human authors. Core design decisions (pipeline architecture, verification layer, reliability report schema, evaluation harness design, run ID and seeding strategy) were made by the human authors. No AI was used for conversational interactions with JOSS editors or reviewers.

# Acknowledgements

We thank the open-source communities behind Next.js, Prisma, Ollama, and the tools used in the verification and evaluation pipeline.

# References
