import type { Metadata } from 'next';
import Link from 'next/link';
import { ResearchSection } from './ResearchSection';
import { ResearchHeader } from './ResearchHeader';
import { PageMotion } from '@/components/PageMotion';

export const metadata: Metadata = {
  title: 'Research & Methodology | OpenPatch',
  description: 'OpenPatch: verification-first pipeline for reliable LLM outputs. Multi-model orchestration, programmatic verification (arithmetic, citation, contradiction, safety), judge selection, reliability reporting. Optional CORTEX: calibrated confidence and learned routing. GSM8K-scale evaluation.',
};

export default function ResearchPage() {
  return (
    <PageMotion className="research-page relative">
      <div className="max-w-3xl mx-auto relative">
        <ResearchHeader />

        <article className="research-article space-y-14">
          <ResearchSection id="abstract">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">Abstract</h2>
            <p className="text-slate-700 leading-[1.75]">
              We describe the design and implementation of OpenPatch, a verification-first system
              that improves the correctness and auditability of language-model-generated answers.
              The main pipeline: (1) optionally classifies the query by task type, (2) augments
              context via retrieval over user-supplied documents or URLs (or optional web search),
              (3) generates multiple candidate answers in parallel, (4) runs a verification layer
              over each candidate (arithmetic, citation, contradiction, and safety), (5) uses a
              judge model to select one answer with access to verifier evidence, and (6) produces
              a structured reliability report. Every run is persisted as a full trace. The app
              supports three modes: <strong>Standard</strong> (full pipeline), <strong>Improved</strong> (multi-candidate
              with majority-vote or heuristic selection, no verifiers/judge), and <strong>CORTEX</strong> (optional
              extension: multi-model inference, calibrated confidence, and learned routing). We
              maintain an in-app evaluation suite and an external Python harness for reproducible
              baseline-vs-improved benchmarks with bootstrap analysis. Publication-scale evaluation
              uses the full GSM8K test set (1319 examples). This document provides a detailed
              account of each component and our design choices.
            </p>
          </ResearchSection>

          <ResearchSection id="introduction">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              Single large language models (LLMs) are prone to arithmetic errors, unsupported
              factual claims, and internal contradictions. Simply scaling models or sampling more
              does not remove these failure modes. Our approach is to treat the problem as
              <em> verification-aware generation</em>: we generate multiple candidate answers, run
              deterministic and model-based checks on each, and then select and optionally refine an
              answer using a judge that sees both the candidates and the verification outcomes.
            </p>
            <p className="text-slate-700 leading-[1.75]">
              The system is designed for transparency: every run produces a reliability report
              (retrieval usage, claims-supported percentage, arithmetic verification, contradiction
              detection, overall confidence) and a full trace (input, retrieval chunks, candidates,
              verifier results, judge decision) stored in a database. This supports both
              end-user trust and continuous evaluation across model and prompt changes.
            </p>
          </ResearchSection>

          <ResearchSection id="pipeline">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              2. Pipeline Architecture
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The UI offers three pipeline choices. <strong>Standard</strong> runs the full pipeline
              (steps below). <strong>Improved</strong> skips verifiers and judge: it generates
              <em>N</em> candidates and selects by majority vote on parsed answers (eval mode) or
              by a heuristic (format + safety) in chat mode. <strong>CORTEX</strong> uses a
              separate Python backend: multi-model inference (e.g. Ollama), calibrated confidence
              (temperature-scaled heuristic), and learned routing (model with highest predicted
              correctness); see §10. For the external evaluation harness, we call the eval API
              with <strong>baseline</strong> (single LLM call, deterministic seed) or
              <strong> improved</strong> (multi-candidate then vote). Below we describe the full
              (Standard) pipeline. Given a user query and optional attachments or URLs:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-[1.75] mb-4">
              <li>
                <strong>Task classification (optional)</strong> — When enabled (see §3), an LLM
                classifies the query into one of: factual_with_sources, math_logic, code_assistance,
                general_writing, or unknown. Currently this is stored for analytics and evals; it
                can inform future prompt or verifier weighting.
              </li>
              <li>
                <strong>Retrieval (optional)</strong> — If the user provided documents or URLs, we
                chunk and embed them, embed the query, and retrieve the top-<em>k</em> chunks by
                cosine similarity. If no documents or URLs are given and web search is enabled
                (Tavily), we augment context with search results. Retrieved or search context is
                passed to generation and (when from docs/URLs) used later for citation verification.
              </li>
              <li>
                <strong>Multi-candidate generation</strong> — We call <em>N</em> (e.g. 2–5) model
                configurations in parallel with the same prompt (system + conversation history +
                user turn + context). Each produces one candidate answer.
              </li>
              <li>
                <strong>Verification</strong> — For each candidate we run: (a) calculator verifier,
                (b) contradiction verifier, (c) safety verifier, and (d) when retrieval was used,
                claim extraction plus citation verifier. Results are stored per candidate.
              </li>
              <li>
                <strong>Judge</strong> — A judge model receives the user request, retrieved context
                (if any), full candidate texts, and the verification summary for each candidate. It
                outputs a chosen candidate ID, rubric scores, a rationale, and an optional
                final-answer edit.
              </li>
              <li>
                <strong>Reliability report &amp; response</strong> — We aggregate the chosen
                candidate&apos;s verifications into a structured reliability report (see §8) and
                return the final answer plus the report. The full run (input, chunks, candidates,
                verifications, judge decision) is persisted as a trace.
              </li>
            </ol>
            <p className="text-slate-700 leading-[1.75]">
              Full pipeline: Query + optional docs/URLs (or web search) → Optional classify task →
              Retrieve / web context → top-k chunks → Generate N candidates in parallel → For each
              candidate: calculator, contradiction, safety, [citation if RAG] → Judge(candidates +
              verifications) → chosen + rationale → Reliability report + persist trace.
            </p>
          </ResearchSection>

          <ResearchSection id="routing">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              3. Task Classification
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              Task classification is <strong>optional</strong> and is <strong>disabled by
              default</strong> (via <code className="research-code">SKIP_ROUTER</code>; when
              unset, the router is skipped and the run is stored with task type
              <code className="research-code">unknown</code>). When enabled (
              <code className="research-code">SKIP_ROUTER=false</code>), we use a single LLM call
              to map the user input (and a flag indicating whether attachments or URLs were
              provided) into a discrete task type. The labels are:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 leading-[1.75] mb-4">
              <li>
                <strong>factual_with_sources</strong> — Questions that benefit from citations or
                facts drawn from provided documents.
              </li>
              <li>
                <strong>math_logic</strong> — Arithmetic, equations, calculations, logic puzzles.
              </li>
              <li>
                <strong>code_assistance</strong> — Programming, code snippets, debugging,
                implementation.
              </li>
              <li>
                <strong>general_writing</strong> — Creative or stylistic writing, summarization
                without strict factual claims.
              </li>
              <li>
                <strong>unknown</strong> — Unclear or mixed.
              </li>
            </ul>
            <p className="text-slate-700 leading-[1.75]">
              The classifier is instructed to reply with only the label. We normalize the output
              (trim, lowercase, replace spaces with underscores) and fall back to
              <code className="research-code">unknown</code> (or
              <code className="research-code">factual_with_sources</code> when attachments exist
              and parsing fails). Task type is stored on the run for analytics and for the
              evaluation harness, which can assert expected task types or confidence levels per
              case.
            </p>
          </ResearchSection>

          <ResearchSection id="retrieval">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              4. Retrieval &amp; RAG
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              When the user supplies one or more documents (uploaded files) or URLs, we:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-[1.75] mb-4">
              <li>Fetch and parse URL content or read uploaded file content (with type and size limits).</li>
              <li>Chunk documents using a configurable chunk size and overlap (semantic boundaries preferred where applicable).</li>
              <li>Embed the user query and all document chunks with the same embedding model.</li>
              <li>Compute cosine similarity between the query embedding and each chunk; sort by score and take the top <em>k</em> (e.g. 10).</li>
            </ol>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The top-<em>k</em> chunks are then (1) injected into the prompt as &quot;Relevant
              context&quot; for all candidate generators, and (2) stored on the run for the
              citation verifier. The citation verifier later checks that factual claims in the
              chosen answer are supported by these chunks (§6).
            </p>
            <p className="text-slate-700 leading-[1.75]">
              Retrieval from user docs/URLs is optional; if none are given, the pipeline runs
              without RAG and without citation verification. When <code className="research-code">TAVILY_ENABLED</code> is
              set and no documents or URLs are supplied, we optionally augment context with web
              search results (Tavily API). That context is passed to generation but does not
              trigger citation verification (which applies only to retrieved document chunks).
            </p>
          </ResearchSection>

          <ResearchSection id="generation">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              5. Multi-Candidate Generation
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We generate <em>N</em> candidate answers in parallel using <em>N</em> different model
              configurations (e.g. different models or temperatures). Each configuration receives the
              same input: a fixed system prompt (accuracy, citing sources when used, showing work
              for math, expressing uncertainty when appropriate), the conversation history (for
              multi-turn), and the current user message plus any retrieved context. No
              cross-candidate information is used at generation time.
            </p>
            <p className="text-slate-700 leading-[1.75]">
              By using multiple models or settings we increase the chance that at least one
              candidate is correct or well-calibrated; the verification layer then filters
              obviously wrong arithmetic or unsupported claims, and the judge selects among the
              remaining candidates using both content and verifier outcomes. Parallelism keeps
              latency close to a single slow model call rather than <em>N</em> sequential calls.
            </p>
          </ResearchSection>

          <ResearchSection id="verification">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              6. Verification Layer
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              Each candidate is passed through four verification steps. All results are stored and
              later used by the judge and the reliability report.
            </p>

            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              6.1 Calculator (arithmetic)
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We use a deterministic, rule-based pass over the candidate text to find arithmetic
              expressions of the form <em>expr = value</em> (e.g. &quot;15 + 27 = 42&quot;). We
              restrict to expressions that are safe to evaluate (numbers and operators only). Each
              expression is recomputed with a math engine (e.g. mathjs); if the stated value matches
              the computed value within numerical tolerance, the finding is marked as matching.
              The verifier passes only if there are no arithmetic findings or all findings match.
              This catches a large class of LLM arithmetic errors without any additional model calls.
            </p>

            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              6.2 Citation (when RAG is used)
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We first extract atomic factual claims from the candidate using an LLM (one claim per
              line; no opinions or instructions). For each claim we then determine whether it is
              supported by the retrieved chunks. Support is computed using (1) string overlap
              (normalized, word-level) and (2) embedding similarity (cosine between claim embedding
              and each chunk embedding). A claim is &quot;supported&quot; if it has sufficient
              overlap or similarity to at least one chunk. The citation verifier passes if every
              extracted claim is supported (or if there are no claims). The reliability report
              includes the percentage of claims supported.
            </p>

            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              6.3 Contradiction
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We ask an LLM a single yes/no question: &quot;Does the following text contain any
              internal contradictions?&quot; with the candidate text. If the model responds in the
              affirmative, the verifier fails. This is a lightweight check for self-consistency
              (e.g. stating X and later stating the opposite).
            </p>

            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              6.4 Safety
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              For sensitive user queries (e.g. containing tokens related to passwords, weapons,
              illegal content), we require that the answer exhibits refusal indicators (e.g.
              &quot;I cannot&quot;, &quot;against my guidelines&quot;). This is implemented as a
              keyword/heuristic check: if the query is flagged as sensitive and the answer does not
              contain refusal phrases, the safety verifier fails. This does not replace full
              content-moderation systems but adds a minimal guardrail aligned with expected refusal
              behavior.
            </p>
          </ResearchSection>

          <ResearchSection id="judge">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              7. Judge &amp; Selection
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The judge is a single LLM call that receives:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 leading-[1.75] mb-4">
              <li>The user request</li>
              <li>Retrieved context (if any)</li>
              <li>Each candidate&apos;s text (truncated to a fixed length) and its verification
                summary (type, pass/fail, notes)</li>
            </ul>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The judge is instructed to score candidates on correctness, completeness,
              instruction-following, and uncertainty calibration, and to prefer candidates with
              verified claims and no contradictions. It returns structured JSON: chosen candidate
              ID, per-candidate rubric scores, a short rationale, an optional
              <code className="research-code">finalAnswerEdit</code> (minor correction to the
              chosen answer), and uncertainty notes. We parse this JSON with fallbacks: if parsing
              fails or the chosen ID is invalid, we default to the first candidate and record the
              parse error in the rationale. The chosen candidate&apos;s text (or the edited version
              if provided) becomes the final answer; its verifications are used to build the
              reliability report.
            </p>
          </ResearchSection>

          <ResearchSection id="reliability">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              8. Reliability Report
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The reliability report is a structured summary shown to the user and stored on the
              run. It includes:
            </p>
            <dl className="space-y-2 text-slate-700 leading-[1.75] mb-4">
              <dt className="font-semibold text-slate-800">Retrieval used</dt>
              <dd className="ml-4">Whether RAG was used (documents or URLs).</dd>
              <dt className="font-semibold text-slate-800">Claims supported %</dt>
              <dd className="ml-4">When RAG was used, the fraction of extracted claims that were supported by retrieved chunks (only present when citation verification ran).</dd>
              <dt className="font-semibold text-slate-800">Arithmetic verified</dt>
              <dd className="ml-4">Whether the calculator verifier passed for the chosen candidate.</dd>
              <dt className="font-semibold text-slate-800">Contradictions detected</dt>
              <dd className="ml-4">Whether the contradiction verifier failed for the chosen candidate.</dd>
              <dt className="font-semibold text-slate-800">Overall confidence</dt>
              <dd className="ml-4">A ternary label: high, medium, or low. We set <strong>low</strong> if there are contradictions or (with RAG) claims-supported is below 50%; <strong>high</strong> if there are no contradictions and (when applicable) claims-supported ≥ 80% and arithmetic verified; otherwise <strong>medium</strong>.</dd>
            </dl>
            <p className="text-slate-700 leading-[1.75]">
              A short natural-language explanation is also produced by concatenating the above
              facts, so users can quickly see why a given confidence level was assigned.
            </p>
          </ResearchSection>

          <ResearchSection id="eval">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              9. Evaluation
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We use two complementary evaluation setups.
            </p>
            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              9.1 In-app evaluation suite
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              A fixed set of evaluation cases is grouped into suites (e.g. &quot;OpenPatch Default
              Suite&quot;, 39 cases). Each case has an input prompt, an optional attachment
              reference, a task type, and optional expected properties (e.g. minimum confidence
              level, retrieval required, minimum claims-supported percentage). When we run a suite,
              we execute the full pipeline for each case and compare the run&apos;s reliability
              report and outputs against the expected properties. A case passes if all specified
              expectations are met. Runs are tagged with a version (e.g. from
              <code className="research-code">VERSION_TAG</code>) so we can compare pass rates and
              metrics across versions for regression tracking.
            </p>
            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              9.2 External benchmark harness (baseline vs improved)
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              A Python-based harness (<code className="research-code">evals/</code>) runs
              baseline and improved modes against benchmark datasets. Each dataset item has a
              prompt and ground-truth answer (strict <code className="research-code">ANSWER:
              &lt;value&gt;</code> format). The harness POSTs each item to
              <code className="research-code">/api/eval/run-one</code> once for baseline and once
              for improved; the server runs <code className="research-code">runBaseline</code> or
              <code className="research-code">runImproved</code> and appends a deterministic run
              record to a log. A scoring step computes accuracy (normalized match to ground truth),
              invalid-format rate, and latency; an analysis step produces bootstrap confidence
              intervals and summary tables. Run IDs are deterministic (
              <code className="research-code">runId(prompt, mode, stableContext)</code>); no
              time-based entropy is used. Dry-run mode uses a fake LLM keyed by ground truth for
              testing without live models.
            </p>
            <h3 className="font-serif text-lg font-semibold text-slate-800 mt-6 mb-2">
              9.3 Publication-scale evaluation (GSM8K)
            </h3>
            <p className="text-slate-700 leading-[1.75] mb-4">
              For publication (e.g. TMLR), results must use <strong>full-scale</strong> evaluation.
              The standard is the full GSM8K test set (1319 examples). Small datasets (e.g. 200
              items) are for debugging and sanity checks only. Required artifacts: for OpenPatch,
              <code className="research-code">evals/results/metrics.csv</code> and
              <code className="research-code">evals/results/bootstrap_results.json</code>; for
              CORTEX, <code className="research-code">cortex/experiments/&lt;run_id&gt;/metrics.json</code> with
              <strong>n_test ≈ 1319</strong>. Execution order: (1) fetch dataset (
              <code className="research-code">python3 scripts/fetch_gsm8k.py</code>), (2) run
              OpenPatch eval with <code className="research-code">evals/configs/large_scale.yaml</code> (Next.js
              running), (3) run CORTEX with <code className="research-code">cd cortex &amp;&amp; python3
              scripts/run_all.py ../evals/datasets/gsm8k.json</code>. See
              <code className="research-code">docs/TMLR_SUBMISSION_READINESS.md</code> in the repo.
            </p>
            <p className="text-slate-700 leading-[1.75]">
              Together, the in-app suite and the external harness support regression detection
              and reproducible comparison of baseline vs improved (and CORTEX when used).
            </p>
          </ResearchSection>

          <ResearchSection id="cortex">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              10. CORTEX (Optional Extension)
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              CORTEX is an <strong>optional extension</strong> in the same repository. It provides
              calibrated confidence estimation and learned model routing. It runs as a separate
              Python FastAPI backend; when the user selects CORTEX in the pipeline toggle, the app
              proxies queries to that backend instead of the main OpenPatch pipeline.
            </p>
            <p className="text-slate-700 leading-[1.75] mb-4">
              <strong>Inference:</strong> The same prompt is sent to multiple models (e.g. llama3,
              mistral, phi, gemma via Ollama). <strong>Confidence:</strong> A heuristic score is
              computed from ensemble features (response length, token entropy, self-consistency
              across models) and per-response features (e.g. refusal detection). We calibrate this
              <em> heuristic</em> via logit-space temperature scaling—we do <strong>not</strong> calibrate
              token logprobs or model likelihoods. Temperature is fit on a validation split to
              minimize ECE. <strong>Routing:</strong> When a learned router artifact exists, a
              lightweight classifier predicts P(correct) per model response using a shared feature
              builder (same at training and inference); the model with highest predicted
              correctness is selected. When the router is used, the confidence and reliability
              shown to the user are <strong>per-model</strong> (selected model&apos;s P(correct));
              the calibrated global heuristic is exposed as an optional
              <code className="research-code">ensemble_confidence</code> field.
            </p>
            <p className="text-slate-700 leading-[1.75]">
              The experiment runner collects per-(prompt, model) records with a deterministic
              60/20/20 train/val/test split. Evaluation reports baseline accuracy (first model per
              prompt), routed accuracy (argmax P(correct)), and oracle accuracy (max correct over
              models per prompt). Bootstrap is over prompts. Full details and reproduction
              commands are in <code className="research-code">cortex/README.md</code> and
              <code className="research-code">docs/TMLR_SUBMISSION_READINESS.md</code>.
            </p>
          </ResearchSection>

          <ResearchSection id="references">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              References &amp; Further Reading
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The design draws on established ideas: multi-model ensembles and voting, RAG and
              retrieval-augmented generation, claim extraction and citation checking, and
              rubric-based LLM-as-judge evaluation. Calibration (CORTEX) uses temperature scaling
              on a heuristic confidence score (Guo et al.), not on token logprobs. We do not claim
              novelty in these components; our contribution is an integrated pipeline with full
              traceability, a user-facing reliability report, and an optional calibration/routing
              extension.
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 leading-[1.75]">
              <li>Retrieval-augmented generation (Lewis et al.) and dense retrieval for open-domain QA.</li>
              <li>Programmatic verification of arithmetic and symbolic math in LLM outputs.</li>
              <li>LLM-as-judge for candidate selection (e.g. Zheng et al.).</li>
              <li>Temperature scaling for confidence calibration (Guo et al.); we apply it to a heuristic score.</li>
            </ul>
          </ResearchSection>
        </article>

        <footer className="mt-20 pt-8 border-t border-slate-200 text-sm text-slate-500 space-y-2">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-slate-600">OpenPatch</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">v1</span>
          </p>
          <p>
            For implementation details and trace inspection, see{' '}
            <Link href="/runs" className="text-[var(--accent-muted)] hover:text-[var(--accent)] font-medium">
              Runs
            </Link>
            , the in-app{' '}
            <Link href="/evals" className="text-[var(--accent-muted)] hover:text-[var(--accent)] font-medium">
              Eval suite
            </Link>
            , and the <code className="text-slate-600 bg-slate-100 px-1">evals/</code> and CORTEX harnesses in the repository. For publication-scale evaluation (GSM8K, n ≈ 1319), see <code className="text-slate-600 bg-slate-100 px-1">docs/TMLR_SUBMISSION_READINESS.md</code>.
          </p>
        </footer>
      </div>
    </PageMotion>
  );
}
