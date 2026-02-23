import { completeWithModel } from '@/lib/llm';
import { seed32, stableKeyTemperature } from '@/lib/seed';
import type { RunCandidate } from '@/lib/run-log';
import { parseAnswer, hasAnswerFormat } from '@/lib/parse-answer';
import { verifySafety } from '@/lib/verifiers';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const DEFAULT_TEMP = 0.3;
const DEFAULT_MAX_TOKENS = 1024;
const N_CANDIDATES = Math.min(5, Math.max(2, parseInt(process.env.IMPROVED_N_CANDIDATES ?? '3', 10)));

export interface ImprovedInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  nCandidates?: number;
  /** Required for deterministic seeding (no time-based fallback). */
  baseSeed: string;
  evalMode?: boolean;
  /** For deterministic fake completion when dry_run requested (evalMode only). Passed by API, not process.env. */
  ground_truth?: string;
  /** Request-scoped: when true and ground_truth set, use fake completion instead of Ollama. */
  dryRun?: boolean;
}

export interface ImprovedResult {
  final_answer: string;
  candidates: RunCandidate[];
  metadata: {
    latencyMs: number;
    judge?: { chosen_index: number; rationale?: string; vote_counts?: Record<string, number> };
    verification?: { format_ok: boolean; refusal_ok: boolean; consistency?: string };
  };
}

/** EvalMode: majority vote on parsed answers; tie-break by latency then index. */
function selectBestEvalMode(candidates: RunCandidate[]): {
  chosen_index: number;
  rationale: string;
  vote_counts: Record<string, number>;
} {
  const parsed = candidates.map((c) => c.parsed ?? parseAnswer(c.raw)).filter((v): v is string => v != null && v !== '');
  if (parsed.length === 0) {
    return {
      chosen_index: 0,
      rationale: 'no parsable answers',
      vote_counts: {},
    };
  }
  const counts: Record<string, number> = {};
  for (const p of parsed) counts[p] = (counts[p] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] ?? 0;
  const tied = sorted.filter(([, c]) => c === maxCount).map(([v]) => v);
  const vote_counts: Record<string, number> = {};
  for (const [v, c] of sorted) vote_counts[v] = c;

  const candidatesWithParsed = candidates
    .map((c, i) => ({ i, parsed: c.parsed ?? parseAnswer(c.raw), latencyMs: c.latencyMs }))
    .filter((x) => x.parsed != null && tied.includes(x.parsed));
  candidatesWithParsed.sort((a, b) => a.latencyMs - b.latencyMs || a.i - b.i);
  const chosen = candidatesWithParsed[0];
  const chosen_index = chosen ? chosen.i : 0;
  const majorityVal = tied[0];
  return {
    chosen_index,
    rationale: majorityVal != null ? `majority vote: ${majorityVal}` : 'no parsable answers',
    vote_counts,
  };
}

/** Chat mode: heuristic (format + safety), include consistency in rationale if available. */
function selectBestChatMode(
  prompt: string,
  candidates: RunCandidate[],
  consistency?: string
): { chosen_index: number; rationale: string } {
  const withScores = candidates.map((c, i) => ({
    i,
    formatOk: hasAnswerFormat(c.raw),
    safetyOk: verifySafety(prompt, c.raw).pass,
  }));
  const valid = withScores.filter((x) => x.formatOk && x.safetyOk);
  if (valid.length > 0) {
    return {
      chosen_index: valid[0].i,
      rationale: consistency != null ? `Format and safety pass; consistency: ${consistency}` : 'Format and safety pass',
    };
  }
  const formatOnly = withScores.filter((x) => x.formatOk);
  if (formatOnly.length > 0) {
    return { chosen_index: formatOnly[0].i, rationale: 'Best format-compliant' };
  }
  const safeOnly = withScores.filter((x) => x.safetyOk);
  if (safeOnly.length > 0) {
    return { chosen_index: safeOnly[0].i, rationale: 'Best safety-compliant' };
  }
  return { chosen_index: 0, rationale: 'Fallback first candidate' };
}

export async function runImproved(input: ImprovedInput): Promise<ImprovedResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const temperature = input.temperature ?? DEFAULT_TEMP;
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
  const n = input.nCandidates ?? N_CANDIDATES;
  const systemPrompt =
    input.systemPrompt ??
    (input.evalMode
      ? 'You are a helpful assistant. Reply with a single line in the form: ANSWER: <value>'
      : 'You are a helpful assistant. Answer clearly and concisely.');
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: input.prompt },
  ];
  const start = Date.now();
  const candidates: RunCandidate[] = [];
  for (let i = 0; i < n; i++) {
    const seed = seed32(`${input.baseSeed}|${stableKeyTemperature(temperature)}|cand:${i}`);
    const t0 = Date.now();
    const dryRunEval =
      input.dryRun && input.evalMode && input.ground_truth != null
        ? { ground_truth: input.ground_truth, candidateIndex: i, baseSeed: input.baseSeed }
        : undefined;
    const raw = await completeWithModel(model, messages, {
      temperature,
      maxTokens,
      seed,
      dryRunEval,
    });
    const latencyMs = Date.now() - t0;
    const parsed = input.evalMode ? parseAnswer(raw) : undefined;
    candidates.push({
      model,
      raw,
      parsed,
      latencyMs,
      sample_index: i,
      seed,
      temperature,
      maxTokens,
    });
  }

  const parsedList = candidates.map((c) => c.parsed ?? parseAnswer(c.raw)).filter((v): v is string => v != null && v !== '');
  let consistency: string | undefined;
  if (parsedList.length >= 2) {
    const counts: Record<string, number> = {};
    for (const p of parsedList) {
      const key = p.trim().toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) consistency = sorted[0][0];
  }

  let chosen_index: number;
  let rationale: string;
  let vote_counts: Record<string, number> | undefined;

  if (input.evalMode) {
    const res = selectBestEvalMode(candidates);
    chosen_index = res.chosen_index;
    rationale = res.rationale;
    vote_counts = res.vote_counts;
  } else {
    const res = selectBestChatMode(input.prompt, candidates, consistency);
    chosen_index = res.chosen_index;
    rationale = res.rationale;
  }

  const chosen = candidates[chosen_index];
  const final_answer = input.evalMode && chosen.parsed !== undefined ? chosen.parsed : chosen.raw;
  const latencyMs = Date.now() - start;

  const refusal_ok = candidates.every((c) => verifySafety(input.prompt, c.raw).pass);
  const format_ok = input.evalMode
    ? hasAnswerFormat(chosen.raw) && chosen.parsed !== undefined
    : candidates.every((c) => hasAnswerFormat(c.raw));

  return {
    final_answer,
    candidates,
    metadata: {
      latencyMs,
      judge: { chosen_index, rationale, ...(vote_counts && { vote_counts }) },
      verification: { format_ok, refusal_ok, consistency },
    },
  };
}
