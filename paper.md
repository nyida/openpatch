# TMLR Submission — Full Format for Overleaf

This document gives the **entire TMLR (Transactions on Machine Learning Research) submission in Overleaf-ready LaTeX**. Use it to create a new Overleaf project or to update an existing TMLR template.

---

## TMLR Checklist (from [Author Guidelines](https://jmlr.org/tmlr/author-guide.html))

- **Format:** PDF from the **TMLR LaTeX stylefile and template** (`tmlr.sty`, `tmlr.bst`). No changes to font, dimensions, or layout.
- **Double blind:** Submission must be **anonymized** (no author names, no identifying links). The main file below uses `\author{}`; the style shows “Anonymous authors” and “Paper under double-blind review.”
- **Broader impact:** If the work carries significant risk of harm, include a Statement of Broader Impact. This submission includes an optional short broader-impact paragraph.
- **Supplementary material:** Allowed (PDF or ZIP, up to 100MB); must be anonymized. Encouraged for code/data to support reproducibility.
- **Copyright & licensing:** Submissions are under **CC BY 4.0**; authors retain copyright. Preprints (e.g. arXiv) are allowed; do not link a non-anonymous preprint to the double-blind submission.

---

## Files to Use in Overleaf

1. **Main file:** Replace the template’s `main.tex` with the LaTeX below (or use the repo file `paper.tex`).
2. **Bibliography:** Add `paper.bib` (same directory as `main.tex`). In the project, the bib file must be named `paper.bib` so that `\bibliography{paper}` finds it.
3. **TMLR style:** Use the official [TMLR template on Overleaf](https://www.overleaf.com/latex/templates/tmlr-journal-submission/fcjxjtfqrsqb) so that `tmlr.sty` and `tmlr.bst` are already in the project. If starting from scratch, download `tmlr.sty` and `tmlr.bst` from [JmlrOrg/tmlr-style-file](https://github.com/JmlrOrg/tmlr-style-file).
4. **Result tables:** Copy `paper/results_table.tex` and `paper/results_delta.tex` into the **same directory as `main.tex`** (so `\input{results_table.tex}` and `\input{results_delta.tex}` work). If you have not run the eval pipeline yet, you can paste the table contents from the `paper/` folder in this repo.

**Recommended:** Create a new Overleaf project from “TMLR Journal Submission,” then replace `main.tex` with the content below, add `paper.bib`, and add `results_table.tex` and `results_delta.tex` in the project root.

---

## Complete LaTeX Source (copy into Overleaf as `main.tex`)

```latex
% =============================================================================
% OpenPatch — TMLR submission (Transactions on Machine Learning Research)
% Full format for Overleaf. Use with official TMLR template: tmlr.sty, tmlr.bst.
% Double-blind: no author names; use [accepted] or [preprint] for camera-ready.
% =============================================================================
\documentclass[10pt]{article}

% TMLR style: default = anonymized submission; [accepted] = camera-ready; [preprint] = arXiv
\usepackage{tmlr}
\usepackage{hyperref}
\usepackage{url}
\usepackage{amsmath,amssymb}
\usepackage{booktabs}

% For submission leave empty; for camera-ready uncomment and add \openreview{...} if needed
% \usepackage[accepted]{tmlr}
% \def\openreview{https://openreview.net/forum?id=XXXXX}

\title{OpenPatch: A Verification-First Pipeline and Evaluation Harness for Reliable Language Model Outputs}

% Double-blind: omit author names (TMLR style shows "Anonymous authors")
\author{}

\begin{document}
\maketitle

\begin{abstract}
Large language models (LLMs) are widely used for question-answering and assistance, but single-model outputs remain prone to arithmetic errors, unsupported claims, and poor confidence calibration. We present OpenPatch, an open-source system that improves both correctness and calibration by orchestrating multiple candidate answers, a verification layer (arithmetic, citation, contradiction, safety), and an LLM judge that selects one answer using verifier evidence. The system supports three execution modes: \textbf{baseline} (single LLM call with deterministic seeding, no confidence model), \textbf{improved} (multi-candidate self-consistency with majority vote and agreement-rate confidence), and \textbf{standard} (full pipeline with verifiers, judge, and rule-based confidence). We evaluate on 500 GSM8K items with paired comparisons and bootstrap confidence intervals. Adding a confidence signal (agreement rate in improved mode) yields a large calibration improvement over the no-confidence baseline (ECE 0.96 $\to$ 0.55; Brier 0.96 $\to$ 0.42) and a small, borderline-significant accuracy gain (+1.6\% [95\% CI 0.2\%, 3.0\%], sign test $p = 0.057$), with no accuracy collapse. OpenPatch provides a reproducible evaluation harness (run $\to$ score $\to$ analyze $\to$ export-for-paper) with submission gating so that manuscript tables are generated only from full submission runs. The software is implemented as a Next.js application with a TypeScript backend, PostgreSQL via Prisma, and optional retrieval; it is intended for researchers and practitioners who need transparent, auditable, and evaluable LLM-based systems.
\end{abstract}

% -----------------------------------------------------------------------------
\section{Introduction}
% -----------------------------------------------------------------------------
Large language models are increasingly deployed for factual and reasoning tasks, but single-model outputs suffer from (1) \textbf{errors}---arithmetic mistakes, unsupported factual claims, and internal contradictions---and (2) \textbf{poor calibration}---confidence scores that do not reflect actual likelihood of correctness \citep{guo2017calibration}. Practitioners and researchers need software that reduces errors, exposes reliability signals, and supports reproducible evaluation under controlled conditions.

OpenPatch addresses this gap with a \textbf{verification-first} architecture: multiple candidate answers are generated, programmatic verifiers (calculator, citation support, contradiction detection, safety checks) run on each candidate, and an LLM judge selects one answer with access to verifier evidence. Every run produces a structured reliability report and a full trace for audit. The system is designed for \textbf{reproducibility}: deterministic run IDs, canonical seeding, and an external Python harness that runs baseline, improved, and standard modes on configurable datasets and produces accuracy, invalid-format rate, and calibration metrics (ECE, Brier) with bootstrap confidence intervals and paired statistical tests.

\textbf{Contributions.}
\begin{enumerate}
\item \textbf{Three execution modes with explicit confidence semantics.} Baseline is a single LLM call with no confidence model (constant confidence for evaluation purposes). Improved uses self-consistency (multiple samples, majority vote on parsed answers) and defines confidence as the fraction of candidates agreeing with the chosen answer (agreement rate). Standard runs the full pipeline (verifiers, judge) and maps verification outcomes to a discrete confidence level. This design allows controlled comparison of ``no confidence'' versus ``agreement-based confidence'' versus ``verification-based confidence.''
\item \textbf{Bounded, reproducible evaluation.} We provide a config-driven harness (run $\to$ score $\to$ analyze) and a \textbf{submission gate}: the manuscript's result tables are generated only when a full submission run has been completed (500 GSM8K items, three modes, three candidates per mode, real model). Otherwise, the exported \LaTeX{} tables cause the paper build to fail, preventing accidental use of staging or dry-run results.
\item \textbf{Empirical results on GSM8K.} We report per-mode accuracy with 95\% bootstrap CIs, invalid-format rate, calibration (ECE, Brier), and paired accuracy differences with sign tests. The main finding is that adding a simple confidence signal (agreement rate in improved mode) substantially improves calibration over the baseline and yields a small accuracy gain without collapse---a combination that is methodologically valuable for reliability-focused deployment.
\end{enumerate}

\textbf{Paper roadmap.} \S\ref{sec:need} states the need for such software. \S\ref{sec:related} reviews related work. \S\ref{sec:method} describes the pipeline and the three modes. \S\ref{sec:experiments} details the experimental setup. \S\ref{sec:results} presents results and interpretation. \S\ref{sec:discussion} discusses limitations and novelty. \S\ref{sec:conclusion} concludes. Software design, impact, and acknowledgements follow.

% -----------------------------------------------------------------------------
\section{Statement of Need}
\label{sec:need}
% -----------------------------------------------------------------------------
Researchers and practitioners deploying LLMs for factual or reasoning tasks need software that (1) reduces errors by combining multiple candidates with verification, (2) exposes reliability signals---such as whether claims are supported by retrieval, arithmetic is checked, or contradictions are flagged---and (3) supports reproducible evaluation and regression tracking. Existing tooling often centers on single-model APIs or proprietary pipelines without open traceability or a standardized evaluation harness. OpenPatch addresses this gap with a single, open codebase implementing a verification-first architecture: optional task classification; retrieval over user documents or optional web search (Tavily); parallel multi-candidate generation; programmatic verifiers (calculator, citation, contradiction, safety); an LLM judge that selects using verifier evidence; and a reliability report with full trace persistence. The target audience includes NLP and ML researchers studying LLM reliability, practitioners building assistive or QA systems, and anyone comparing baseline versus multi-candidate strategies under reproducible conditions. The software integrates with local model servers (e.g., Ollama) by default and exposes a web UI and REST APIs so that the same pipeline supports both interactive use and batch evaluation.

% -----------------------------------------------------------------------------
\section{Related Work}
\label{sec:related}
% -----------------------------------------------------------------------------
\textbf{Orchestration and RAG.} Frameworks such as LangChain and LlamaIndex provide orchestration and retrieval-augmented generation (RAG) patterns \citep{lewis2020rag} but do not bundle a fixed verification layer (calculator, citation, contradiction, safety) with a judge and a single reliability report. Evaluation platforms (e.g., HELM, Open LLM Leaderboard) focus on benchmarking models on tasks and metrics rather than shipping a full pipeline that generates and verifies answers with trace storage.

\textbf{LLM-as-judge and verification.} Research on LLM-as-a-judge \citep{zheng2023judging} and on program-aided and claim-level verification \citep{gao2023pal} informs our judge and citation verifier design. Work on self-consistency \citep{wang2023selfconsistency} and chain-of-thought reasoning \citep{wei2022cot} motivates multi-candidate generation and structured outputs. We are not aware of an open, integrated system that combines multi-candidate generation, multiple verifiers, a judge, reliability reporting, and a reproducible baseline-vs-improved evaluation harness with explicit confidence semantics in one repository.

\textbf{Calibration.} Calibration of neural network confidence is well studied \citep{guo2017calibration}. OpenPatch does not propose a new calibration algorithm; improved mode uses \textbf{agreement rate} (fraction of candidates agreeing with the chosen answer) as a confidence proxy, and standard mode uses rule-based confidence from verification outcomes. Our contribution is the pipeline and evaluation design that allow comparison of ``no confidence'' versus ``agreement-based'' versus ``verification-based'' confidence on a fixed benchmark.

OpenPatch was built as a standalone application for three reasons: (1) a single deployable stack (web app, database, eval scripts) with clear pipeline contract and deterministic run IDs; (2) verification and reliability as first-class design goals; (3) an external harness tailored to our API and modes. The repository provides deterministic run IDs, seeded generation, and dry-run mode for pipeline verification; the manuscript's results come only from real-model submission runs.

% -----------------------------------------------------------------------------
\section{Method}
\label{sec:method}
% -----------------------------------------------------------------------------

\subsection{Pipeline Overview}
OpenPatch is built around a single pipeline entry point (\texttt{src/lib/pipeline/run.ts}) that branches by mode. Core logic lives under \texttt{src/lib/} (pipeline, verifiers, retrieval, run logging); the web layer is in \texttt{src/app/}. When the caller does not request baseline or improved mode, the \textbf{full pipeline} runs: (1) optional task classification (LLM, disabled by default); (2) retrieval or optional web search (Tavily); (3) parallel multi-candidate generation (same prompt, $N$ configurations); (4) per-candidate verification (calculator, contradiction, safety, and when RAG was used, claim extraction plus citation); (5) judge (LLM selects one candidate using verification summaries); (6) aggregation of the chosen candidate's verifications into a reliability report (retrieval used, claims supported \%, arithmetic verified, contradictions, overall confidence). All runs are persisted for inspection and analysis.

\subsection{Three Execution Modes}
\textbf{Baseline.} A single LLM call with deterministic seeding (\texttt{seed32}, \texttt{stableKeyTemperature}). No verifiers, no judge. For the evaluation harness, \textbf{confidence is set to a constant} (1) so that every prediction is treated as ``fully confident.'' This is intentional: baseline represents a single-sample, no-confidence-model setting. With low accuracy, constant confidence yields very poor calibration (ECE and Brier near 1), which serves as a reference for the value of adding any confidence signal.

\textbf{Improved.} $N$ candidates (default 3) are generated with the same prompt and temperature; in eval mode, selection is by \textbf{majority vote} on parsed answers (self-consistency \citep{wang2023selfconsistency}), with tie-break by latency then index. \textbf{Confidence is defined as the agreement rate:} the fraction of candidates that agree with the chosen answer (\textit{maxVotes}/$n$), e.g.\ 1/3, 2/3, or 1. This gives a varying confidence signal that can be evaluated for calibration (ECE, Brier) without requiring token-level logits or a learned calibrator.

\textbf{Standard.} The full pipeline runs: $N$ candidates, per-candidate verification (arithmetic, safety, etc.), and an LLM judge that selects one candidate. The chosen candidate's verifications are aggregated into a reliability report; \textbf{confidence is mapped from the report} to a discrete value (e.g.\ high $\to$ 1, medium $\to$ 0.5, low $\to$ 0). Thus standard provides a verification-based, rule-defined confidence rather than an agreement-based one.

\subsection{Verifiers and Judge}
Verifiers are programmatic and deterministic: calculator (expression evaluation), citation (claim extraction and support from retrieval), contradiction (self-contradiction detection), and safety (content checks). The judge is an LLM that receives verification summaries and selects a candidate; its output is parsed for chosen index and rationale. Determinism is enforced via canonical seeding and run IDs $\mathit{runId}(\mathit{prompt}, \mathit{mode}, \mathit{stableContext})$ with required $\mathit{stableContext}$ (e.g.\ \texttt{dataset\_id:item\_id} for eval). The external harness logs each run with \texttt{run\_id}, mode, inputs, outputs (final answer, candidates, confidence), and latency.

% -----------------------------------------------------------------------------
\section{Experiments}
\label{sec:experiments}
% -----------------------------------------------------------------------------

\subsection{Dataset and Protocol}
We use the GSM8K dataset \citep{cobbe2021training} (grade-school math word problems). The evaluation uses a \textbf{bounded} sample: 500 items drawn with a fixed seed (42) from the dataset, so that results are reproducible and comparable across runs. Each item is evaluated in three modes (baseline, improved, standard) with three candidates per mode for improved and standard. The same 500 items are used for all modes, enabling \textbf{paired} accuracy and calibration comparisons.

\subsection{Metrics}
\begin{itemize}
\item \textbf{Accuracy:} Fraction of items where the system's final answer matches the ground truth (after parsing the \texttt{ANSWER:} line).
\item \textbf{Invalid-format rate:} Fraction of items where the chosen output could not be parsed (missing or malformed \texttt{ANSWER:}).
\item \textbf{Calibration:} For each mode, we compute \textbf{Expected Calibration Error (ECE)} and \textbf{Brier score} \citep{guo2017calibration} using the scalar confidence logged per run. Baseline has constant confidence (1); improved has agreement rate; standard has the discrete confidence from the reliability report.
\item \textbf{Paired accuracy difference:} For each item we have baseline correct/incorrect and improved (or standard) correct/incorrect. We report the mean difference (improved minus baseline, or standard minus baseline) with 95\% bootstrap confidence intervals and a sign test $p$-value.
\end{itemize}

\subsection{Harness and Submission Gate}
The external harness is config-driven (\texttt{evals/configs/large\_scale.yaml}). Steps: (1) \textbf{Run:} for each dataset item, POST to the Next.js API with \texttt{mode: baseline}, \texttt{improved}, or \texttt{standard}; (2) \textbf{Score:} read run logs, compute per-mode accuracy, invalid rate, latency, and confidence, write \texttt{metrics.csv} and per-mode ECE/Brier in the summary; (3) \textbf{Analyze:} bootstrap over items for accuracy CIs, paired differences, sign test, and write \texttt{bootstrap\_results.json} and tables; (4) \textbf{Export for paper:} write \texttt{paper/results\_table.tex} and \texttt{paper/results\_delta.tex}.

The \textbf{submission gate} ensures the manuscript cannot be built with placeholder or staging results. A run is a \textit{submission run} only when: dataset is GSM8K, \texttt{n\_used\_all} = 500, modes include baseline, improved, and standard, \texttt{num\_candidates} = 3, and \texttt{dry\_run} is false. Only then does \texttt{export\_for\_paper} write valid \LaTeX{} tables; otherwise it writes \texttt{\textbackslash errmessage\{...\}} so the paper build fails. Provenance (seed, limit, dataset paths) is stored in \texttt{evals/results/run\_metadata.json}.

% -----------------------------------------------------------------------------
\section{Results}
\label{sec:results}
% -----------------------------------------------------------------------------
Empirical results are generated from the evaluation pipeline and included in the manuscript so that tables cannot drift from artifacts. After running the evaluation (run $\to$ score $\to$ analyze with a real model), \texttt{python -m evals.export\_for\_paper} produces \texttt{paper/results\_table.tex} and \texttt{paper/results\_delta.tex}. Include them in your build as follows (place the two \texttt{.tex} files in the same directory as this main file, or adjust paths).

% Add results_table.tex and results_delta.tex to your project (from paper/ folder, or run evals and export_for_paper).
\input{results_table.tex}
\input{results_delta.tex}

\textbf{Table \ref{tab:results} (per-mode summary).} On 500 GSM8K items, baseline accuracy is 4.0\% [95\% CI 2.4\%, 5.8\%] with invalid-format rate 0.4\%. Improved accuracy is 5.6\% [3.8\%, 7.6\%] with invalid rate 0.2\%; standard accuracy is 5.5\% [3.6\%, 7.4\%] with invalid rate 0.2\%. Calibration: baseline ECE 0.96, Brier 0.96 (by construction---constant confidence 1 with low accuracy); improved ECE 0.55, Brier 0.42; standard ECE 0.88, Brier 0.84. The large calibration improvement from baseline to improved reflects the addition of a \textbf{non-constant confidence signal} (agreement rate) rather than the correction of an existing calibrator; baseline has no confidence model. Improved also achieves the best ECE and Brier among the three modes.

\textbf{Table \ref{tab:delta} (paired differences).} Baseline vs.\ improved: mean accuracy difference +1.6\% [95\% CI 0.2\%, 3.0\%], $n = 500$, sign test $p = 0.0574$ (borderline significance). Baseline vs.\ standard: +1.4\% [0\%, 3.0\%], $n = 500$, sign test $p = 0.1185$. The 95\% CIs for the improvement over baseline exclude or touch zero in a direction consistent with a small gain; there is no accuracy collapse when moving to multi-candidate or full-pipeline modes.

\textbf{Interpretation.} (1) Adding agreement-rate confidence (improved) substantially improves calibration over the no-confidence baseline and yields a small, borderline-significant accuracy gain. (2) Standard (verification + judge + rule-based confidence) improves accuracy similarly but remains less calibrated than improved on this benchmark, likely due to the coarse discrete confidence levels and the judge/verifier not always aligning with ground-truth correctness on GSM8K. (3) The combination---better calibration and no accuracy collapse---is methodologically valuable for reliability-oriented deployment; the contribution lies in the pipeline and evaluation design rather than in a new calibration algorithm.

% -----------------------------------------------------------------------------
\section{Discussion}
\label{sec:discussion}
% -----------------------------------------------------------------------------
\textbf{Limitations.} Absolute accuracy on GSM8K in this setup is low (4--6\%), reflecting the use of a single local model (e.g.\ Ollama) and a fixed prompt format; the focus of the evaluation is relative comparison and calibration, not state-of-the-art accuracy. Results are on one dataset (GSM8K) and one seed; broader generalization would require multiple datasets and seeds. Baseline is intentionally uncalibrated (constant confidence); the comparison is therefore ``adding a confidence signal'' versus ``no signal,'' not ``new calibrator vs.\ old calibrator.''

\textbf{Novelty.} OpenPatch does not introduce a new calibration algorithm (e.g.\ temperature scaling or Platt scaling). Improved mode uses \textbf{agreement rate} as confidence---a known idea in the self-consistency literature. The novelty is the \textbf{integrated pipeline} and \textbf{reproducible evaluation harness} with explicit confidence semantics for each mode, submission gating, and paired analysis with bootstrap CIs and calibration metrics. The paper demonstrates that adding a simple confidence signal (agreement rate) in a multi-candidate setting improves both calibration and accuracy over a single-sample, no-confidence baseline under controlled conditions.

% -----------------------------------------------------------------------------
\section{Conclusion}
\label{sec:conclusion}
% -----------------------------------------------------------------------------
OpenPatch provides an open, verification-first LLM pipeline and a reproducible evaluation harness for comparing baseline, improved, and standard modes with accuracy, invalid-format rate, and calibration (ECE, Brier). On 500 GSM8K items, adding agreement-rate confidence (improved mode) yields a large calibration improvement over the no-confidence baseline and a small accuracy gain without collapse. The software is intended for researchers and practitioners who need transparent, auditable, and evaluable LLM-based systems; the submission gate and export-for-paper workflow ensure that manuscript tables are generated only from full submission runs. Installation and verification instructions are in the README; reviewers can run the test suite and the harness in dry-run mode without a live model.

% -----------------------------------------------------------------------------
\section{Software Design}
% -----------------------------------------------------------------------------
The codebase follows common JavaScript/TypeScript conventions: Next.js 14 App Router, Prisma for schema and persistence, and clear separation between pipeline logic (\texttt{src/lib/pipeline/}), verifiers (\texttt{src/lib/verifiers/}), retrieval (\texttt{src/lib/retrieval/}), and run logging (\texttt{src/lib/run-log.ts}, \texttt{src/lib/seed.ts}). Configuration is environment-based (\texttt{.env}); the eval harness uses YAML config for datasets, log paths, and bootstrap settings. The design prioritizes local execution (Ollama) and optional cloud APIs (OpenAI, OpenRouter). Reviewers can verify correctness by (1) running \texttt{npm run test} (claim extraction, citation scoring, calculator verification, reliability report) and (2) running the external harness in dry-run mode (fake LLM keyed by ground truth, no live model required).

% -----------------------------------------------------------------------------
\section{Research Impact Statement}
% -----------------------------------------------------------------------------
OpenPatch provides immediate value as a reference implementation of a verification-first LLM pipeline and as a reproducible evaluation harness. The in-app suite (39 seeded cases) and the external Python harness (run/score/analyze with bootstrap CIs and calibration) enable researchers to replicate and extend comparisons of single-call vs.\ multi-candidate strategies. We expect the software to support (1) methodological work on LLM verification and reliability reporting, (2) empirical studies comparing modes on custom datasets, and (3) adoption by practitioners who need auditable, evaluable assistants.

% -----------------------------------------------------------------------------
\section*{Broader Impact (Optional)}
% -----------------------------------------------------------------------------
This work presents tooling for more reliable and auditable LLM outputs. Potential positive impact includes safer deployment of LLM-based assistants and clearer reliability signals for users. We are not aware of significant direct risks of harm from the software itself; mitigations (verification, logging, reproducibility) are aimed at reducing misuse and improving transparency.

% -----------------------------------------------------------------------------
\section*{AI Usage Disclosure}
% -----------------------------------------------------------------------------
Generative AI tools were used for selected aspects of this submission. \textbf{Tool use:} AI-assisted editing and drafting was used for portions of the documentation and of this manuscript; AI was also used for suggesting code structure and refactors in non-critical paths and for copy-editing. \textbf{Nature and scope:} Assistance was limited to drafting, editing, and suggestions; no AI was used to make design or scientific decisions. \textbf{Confirmation of review:} All AI-assisted text and code were reviewed, edited, and validated by the human author. Core design decisions---including pipeline architecture, verification layer, reliability report schema, evaluation harness design, and run ID and seeding strategy---were made by the human author.

% -----------------------------------------------------------------------------
\section*{Implementation Notes}
% -----------------------------------------------------------------------------
CORTEX (confidence-optimized routing and calibration) is an optional extension in this repository and is not covered by this paper; it provides a separate Python backend and experiment pipeline for calibration and learned routing.

% -----------------------------------------------------------------------------
\section*{Acknowledgements}
% -----------------------------------------------------------------------------
We thank the open-source communities behind Next.js, Prisma, Ollama, and the tools used in the verification and evaluation pipeline.

% -----------------------------------------------------------------------------
% References (use natbib + tmlr.bst; bibliography file = paper.bib → \bibliography{paper})
% -----------------------------------------------------------------------------
\bibliographystyle{tmlr}
\bibliography{paper}

\end{document}
```

---

## After Acceptance (Camera-Ready)

- In the main file, switch to the accepted style and add your OpenReview link:
  - `\usepackage[accepted]{tmlr}`
  - `\def\openreview{https://openreview.net/forum?id=YOUR_PAPER_ID}`
- Add author names and affiliations in `\author{...}` and use `\and` between authors if needed.
- Optionally use `\usepackage[preprint]{tmlr}` for an arXiv version (de-anonymized, no “Reviewed on OpenReview” line).

---

## Repo Files

| File | Purpose |
|------|--------|
| `paper.tex` | Same LaTeX as above; use as `main.tex` in Overleaf. |
| `paper.bib` | Bibliography; must be named `paper.bib` for `\bibliography{paper}`. |
| `paper/results_table.tex` | Per-mode results table (generated by `evals/export_for_paper` or committed). |
| `paper/results_delta.tex` | Paired-difference table (generated or committed). |

Submit to TMLR via **OpenReview**: [https://openreview.net/group?id=TMLR](https://openreview.net/group?id=TMLR).