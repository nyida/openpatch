import type { Metadata } from 'next';
import Link from 'next/link';
import { ResearchSection } from './ResearchSection';
import { ResearchHeader } from './ResearchHeader';

export const metadata: Metadata = {
  title: 'Research & Methodology | OpenPatch',
  description: 'Technical and research foundations (Open: A Verification-First Architecture for Reliable Language Model Outputs). Multi-model orchestration, verification, and reliability reporting.',
};

export default function ResearchPage() {
  return (
    <div className="research-page relative">
      <div className="max-w-3xl mx-auto relative pl-6 sm:pl-8">
        <div className="research-accent-bar" aria-hidden />
        <ResearchHeader />

        <article className="research-article space-y-14">
          <ResearchSection id="abstract">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">Abstract</h2>
            <p className="text-slate-700 leading-[1.75]">
              We describe the design and implementation of OpenPatch, a system that improves
              the correctness and calibratability of language-model-generated answers by (1) routing
              user queries by task type, (2) optionally augmenting context via retrieval over
              user-supplied documents or URLs, (3) generating multiple candidate answers from
              distinct model configurations in parallel, (4) running a verification layer over each
              candidate (arithmetic, citation support, internal consistency, and safety), (5) using a
              judge model to select a single answer with access to verifier evidence, and (6)
              producing a structured reliability report. Every run is persisted as a full trace for
              audit and analysis. We also maintain a fixed evaluation suite and version-tagged runs
              for regression tracking. This document provides a detailed account of each component
              and the rationale behind our design choices.
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
              The pipeline is strictly sequential after a single routing step. Given a user query
              and optional attachments or URLs:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-[1.75] mb-4">
              <li>
                <strong>Task classification</strong> — An LLM classifies the query into one of:
                factual_with_sources, math_logic, code_assistance, general_writing, or unknown. This
                can inform future prompt or verifier weighting; currently it is stored for analytics
                and evals.
              </li>
              <li>
                <strong>Retrieval (optional)</strong> — If the user provided documents or URLs,
                we chunk and embed them, embed the query, and retrieve the top-<em>k</em> chunks by
                cosine similarity. These chunks are passed as context to generation and used later
                for citation verification.
              </li>
              <li>
                <strong>Multi-candidate generation</strong> — We call two (or more) model
                configurations in parallel with the same prompt (system + conversation history +
                user turn + retrieved context). Each produces one candidate answer.
              </li>
              <li>
                <strong>Verification</strong> — For each candidate we run: (a) calculator
                verifier, (b) contradiction verifier, (c) safety verifier, and (d) when retrieval
                was used, claim extraction plus citation verifier. Results are stored per candidate.
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
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 font-mono text-sm text-slate-700 overflow-x-auto">
              <pre className="whitespace-pre">{`Query + optional docs/URLs
    → Classify task
    → Retrieve (if docs/URLs) → top-k chunks
    → Generate N candidates in parallel
    → For each candidate: calculator, contradiction, safety, [citation if RAG]
    → Judge(candidates + verifications) → chosen + rationale
    → Reliability report + persist trace`}</pre>
            </div>
          </ResearchSection>

          <ResearchSection id="routing">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              3. Task Classification
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We use a single LLM call to map the user input (and a flag indicating whether
              attachments or URLs were provided) into a discrete task type. The labels are:
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
              and parsing fails). Task type is stored on the run for analytics and for the evaluation
              harness, which can assert expected task types or confidence levels per case.
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
            <p className="text-slate-700 leading-[1.75]">
              The top-<em>k</em> chunks are then (1) injected into the prompt as &quot;Relevant
              context&quot; for all candidate generators, and (2) stored on the run for the
              citation verifier. The citation verifier later checks that factual claims in the
              chosen answer are supported by these chunks (§6). Retrieval is optional; if no
              documents or URLs are given, the pipeline runs without RAG and without citation
              verification.
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
              9. Evaluation Harness
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              We maintain a fixed set of evaluation cases grouped into suites. Each case has an
              input prompt, an optional attachment reference, a task type, and optional expected
              properties (e.g. minimum confidence level, retrieval required, minimum claims-supported
              percentage). When we run a suite, we execute the full pipeline for each case and
              compare the run&apos;s reliability report and outputs against the expected properties.
              A case passes if all specified expectations are met (e.g. overall confidence at least
              &quot;medium&quot;, or retrieval used when required). Runs are tagged with a version
              (e.g. from an environment variable) so we can compare pass rates and metrics across
              versions for regression tracking.
            </p>
            <p className="text-slate-700 leading-[1.75]">
              This allows us to detect regressions when we change prompts, models, or verifier logic,
              and to compare different configurations on the same test set in a reproducible way.
            </p>
          </ResearchSection>

          <ResearchSection id="references">
            <h2 className="font-serif text-2xl font-semibold text-slate-900 mb-4">
              References &amp; Further Reading
            </h2>
            <p className="text-slate-700 leading-[1.75] mb-4">
              The design draws on established ideas: multi-model ensembles and voting, RAG and
              retrieval-augmented generation, claim extraction and entailment/NLI for citation
              checking, and rubric-based LLM-as-judge evaluation. We do not claim novelty in these
              components; our contribution is an integrated pipeline with full traceability and a
              user-facing reliability report.
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 leading-[1.75]">
              <li>Retrieval-augmented generation (Lewis et al.) and dense retrieval for open-domain QA.</li>
              <li>Programmatic verification of arithmetic and symbolic math in LLM outputs.</li>
              <li>Using LLMs as judges for summarization and long-form generation (e.g. LLM-as-a-Judge).</li>
              <li>Uncertainty calibration and refusal behavior in aligned language models.</li>
            </ul>
          </ResearchSection>
        </article>

        <footer className="mt-20 pt-8 border-t border-slate-200 text-sm text-slate-500 space-y-2">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-slate-600">OpenPatch</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">v1</span>
            <a href="/paper.pdf" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 font-medium" title="Open: A Verification-First Architecture for Reliable Language Model Outputs">
              Paper: <em>Open</em> (PDF)
            </a>
          </p>
          <p>
            For implementation details and trace inspection, see{' '}
            <Link href="/runs" className="text-teal-600 hover:text-teal-700 font-medium">
              Runs
            </Link>
            {' '}and the{' '}
            <Link href="/evals" className="text-teal-600 hover:text-teal-700 font-medium">
              Eval harness
            </Link>.
          </p>
        </footer>
      </div>
    </div>
  );
}
