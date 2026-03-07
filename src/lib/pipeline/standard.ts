/**
 * Standard (full) pipeline for eval: N candidates from one model, verifiers, then LLM judge.
 * No DB run; used by /api/eval/run-one when mode=standard.
 */
import { completeWithModel } from '@/lib/llm';
import { defaultLLM } from '@/lib/llm';
import { seed32, stableKeyTemperature } from '@/lib/seed';
import type { RunCandidate } from '@/lib/run-log';
import { parseAnswer, hasAnswerFormat } from '@/lib/parse-answer';
import { verifyArithmetic, verifySafety } from '@/lib/verifiers';
import { buildReliabilityReport } from './reliability';
import { runJudge } from './judge';
import type { CandidateData, VerificationResult } from './types';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const DEFAULT_TEMP = 0.3;
const DEFAULT_MAX_TOKENS = 1024;
const N_CANDIDATES = Math.min(5, Math.max(2, parseInt(process.env.CANDIDATE_COUNT ?? process.env.IMPROVED_N_CANDIDATES ?? '3', 10)));

export interface StandardInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  nCandidates?: number;
  baseSeed: string;
  evalMode?: boolean;
  ground_truth?: string;
  dryRun?: boolean;
}

export interface StandardResult {
  final_answer: string;
  parsed_answer?: string;
  candidates: RunCandidate[];
  metadata: {
    latencyMs: number;
    judge: { chosen_index: number; rationale?: string };
    verification: { format_ok: boolean; refusal_ok: boolean };
    /** Scalar for calibration (from reliability overallConfidence). */
    confidence: number;
  };
}

export async function runStandard(input: StandardInput): Promise<StandardResult> {
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
    const dryRunEval =
      input.dryRun && input.evalMode && input.ground_truth != null
        ? { ground_truth: input.ground_truth, candidateIndex: i, baseSeed: input.baseSeed }
        : undefined;
    const t0 = Date.now();
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

  const promptHash = `std-${input.baseSeed.slice(0, 12)}`;
  const candidatesWithVerifications: { id: string; data: CandidateData; verifications: VerificationResult[] }[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const calcResult = verifyArithmetic(c.raw);
    const safetyResult = verifySafety(input.prompt, c.raw);
    const verifications: VerificationResult[] = [calcResult, safetyResult];
    candidatesWithVerifications.push({
      id: String(i),
      data: {
        modelName: c.model,
        promptHash,
        outputText: c.raw,
        tokenCounts: undefined,
        latencyMs: c.latencyMs,
      },
      verifications,
    });
  }

  const judgeOutput = await runJudge(
    input.prompt,
    [],
    candidatesWithVerifications,
    defaultLLM
  );
  const chosenIndex = Math.max(0, candidatesWithVerifications.findIndex((c) => c.id === judgeOutput.chosenCandidateId));
  const chosen = candidates[chosenIndex];
  const chosenVerifications = candidatesWithVerifications[chosenIndex]?.verifications ?? [];
  let final_answer = chosen?.raw ?? '';
  if (judgeOutput.finalAnswerEdit) final_answer = judgeOutput.finalAnswerEdit;
  const parsed_answer = input.evalMode && chosen ? (chosen.parsed ?? parseAnswer(chosen.raw)) : undefined;

  const reliability = buildReliabilityReport(false, chosenVerifications);
  const confidence =
    reliability.overallConfidence === 'high' ? 1 : reliability.overallConfidence === 'medium' ? 0.5 : 0;

  const format_ok = input.evalMode && chosen ? hasAnswerFormat(chosen.raw) && chosen.parsed != null : true;
  const refusal_ok = candidates.every((c) => verifySafety(input.prompt, c.raw).pass);
  const latencyMs = Date.now() - start;

  return {
    final_answer,
    parsed_answer,
    candidates,
    metadata: {
      latencyMs,
      judge: { chosen_index: chosenIndex, rationale: judgeOutput.rationale },
      verification: { format_ok, refusal_ok },
      confidence,
    },
  };
}
