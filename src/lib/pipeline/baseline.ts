import { completeWithModel } from '@/lib/llm';
import { seed32, stableKeyTemperature } from '@/lib/seed';
import type { RunCandidate } from '@/lib/run-log';
import { parseAnswer } from '@/lib/parse-answer';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const DEFAULT_TEMP = 0.3;
const DEFAULT_MAX_TOKENS = parseInt(process.env.TURBO_MAX_TOKENS ?? '576', 10) || 576;

export interface BaselineInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Required for deterministic seeding. Used with temperature in canonical seed. */
  baseSeed: string;
  /** If true, we parse ANSWER: from output for eval. */
  evalMode?: boolean;
  /** For deterministic fake completion when dry_run requested (evalMode only). Passed by API, not process.env. */
  ground_truth?: string;
  /** Request-scoped: when true and ground_truth set, use fake completion instead of Ollama. */
  dryRun?: boolean;
}

export interface BaselineResult {
  final_answer: string;
  candidates: RunCandidate[];
  metadata: {
    latencyMs: number;
    seed?: number;
    parsed_answer?: string;
  };
}

export async function runBaseline(input: BaselineInput): Promise<BaselineResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const temperature = input.temperature ?? DEFAULT_TEMP;
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
  const seed = seed32(`${input.baseSeed}|${stableKeyTemperature(temperature)}|baseline`);
  const systemPrompt = input.systemPrompt ?? 'You are a helpful assistant. Answer clearly and concisely.';
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: input.prompt },
  ];
  const start = Date.now();
  const dryRunEval =
    input.dryRun && input.evalMode && input.ground_truth != null
      ? { ground_truth: input.ground_truth, candidateIndex: 0, baseSeed: input.baseSeed }
      : undefined;
  const raw = await completeWithModel(model, messages, {
    temperature,
    maxTokens,
    seed,
    dryRunEval,
  });
  const latencyMs = Date.now() - start;
  const parsed = input.evalMode ? parseAnswer(raw) : undefined;
  const final_answer = input.evalMode && parsed !== undefined ? parsed : raw;
  const candidates: RunCandidate[] = [
    {
      model,
      raw,
      parsed: parsed ?? undefined,
      latencyMs,
      sample_index: 0,
      seed,
      temperature,
      maxTokens,
    },
  ];
  return {
    final_answer,
    candidates,
    metadata: {
      latencyMs,
      seed,
      parsed_answer: parsed,
    },
  };
}
