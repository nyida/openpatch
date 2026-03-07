/**
 * Ollama local LLM client. Default LLM for the app—no API key or credits required.
 * Runs against local Ollama (e.g. llama3.2, qwen2.5, mistral).
 * Works with Tavily/search in the pipeline for up-to-date context.
 */
import OpenAI from 'openai';
import { seed32 } from '@/lib/seed';
import { logger } from '@/lib/logger';

const DEFAULT_BASE = 'http://localhost:11434/v1';
const DEFAULT_MODEL = 'llama3.2';
const FALLBACK_MODEL = 'llama3.1'; // try if default not found
const DEFAULT_EMBED_MODEL = 'nomic-embed-text';
const COMPLETION_TIMEOUT_MS = 120_000; // 2 min for long 1024-token runs

export function getBaseUrl(override?: string): string {
  const url = override ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE;
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function getClient(baseUrlOverride?: string): OpenAI {
  const base = getBaseUrl(baseUrlOverride);
  return new OpenAI({
    apiKey: 'ollama',
    baseURL: base,
    timeout: COMPLETION_TIMEOUT_MS,
  });
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Deterministic seed (integer). String is passed to canonical seed32(). */
  seed?: number | string;
  /** Use this Ollama instance (for parallel multi-instance setup). */
  baseUrl?: string;
  /** Request-scoped: when set, return deterministic fake (no Ollama). Do not use process.env. */
  dryRunEval?: { ground_truth: string; candidateIndex: number; baseSeed: string };
}

function isModelNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('404') || msg.includes('not found');
}

function toSeedNumber(seed: number | string | undefined): number | undefined {
  if (seed === undefined) return undefined;
  if (typeof seed === 'number') return Math.floor(seed) % 0x7fffffff;
  return seed32(String(seed));
}

export async function complete(
  messages: { role: string; content: string }[],
  options: CompletionOptions = {}
): Promise<string> {
  if (options.dryRunEval) {
    const { ground_truth, candidateIndex, baseSeed } = options.dryRunEval;
    if (candidateIndex === 0) return `ANSWER: ${ground_truth}`;
    if (candidateIndex === 1) {
      const wrongVal = seed32(`${baseSeed}|cand:1`) % 2 === 0 ? '0' : 'wrong';
      return `ANSWER: ${wrongVal}`;
    }
    return `ANSWER: ${ground_truth}`;
  }

  const client = getClient(options.baseUrl);
  let model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  const seedNum = toSeedNumber(options.seed);
  const opts: Record<string, unknown> = {
    messages: messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.3,
  };
  if (seedNum !== undefined) (opts as { seed?: number }).seed = seedNum;

  try {
    const resp = await client.chat.completions.create({ model, stream: false, ...opts } as never);
    const choice = (resp as { choices?: { message?: { content?: string } }[] }).choices?.[0];
    if (!choice?.message?.content) throw new Error('Empty completion from Ollama');
    logger.debug('Ollama complete', { model, messageCount: messages.length });
    return choice.message.content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
    const fallbackModel = process.env.OLLAMA_MODEL ?? (model === DEFAULT_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL);
    if (isModelNotFoundError(err) && fallbackModel && fallbackModel !== model) {
      logger.warn(`Ollama model ${model} not found, trying ${fallbackModel}`);
      try {
        const resp = await client.chat.completions.create({ ...opts, model: fallbackModel, stream: false } as never);
        const choice = (resp as { choices?: { message?: { content?: string } }[] }).choices?.[0];
        if (!choice?.message?.content) throw new Error('Empty completion from Ollama');
        return choice.message.content;
      } catch (fallbackErr) {
        if (isModelNotFoundError(fallbackErr)) {
          throw new Error(`Ollama model '${model}' not found. Run: ollama pull ${model}`);
        }
        throw fallbackErr;
      }
    }
    if (isModelNotFoundError(err)) {
      throw new Error(
        `Ollama model '${model}' not found. Run: ollama pull ${model}`
      );
    }
    const isTimeout =
      err instanceof Error &&
      ('name' in err ? (err as { name?: string }).name === 'APIConnectionTimeoutError' : false) ||
      msg.includes('timed out') ||
      msg.includes('timeout');
    if (isTimeout) {
      throw new Error(
        `Ollama request timed out (${COMPLETION_TIMEOUT_MS / 1000}s). Try a smaller prompt or increase timeout.`
      );
    }
    throw err;
  }
}

const EMBED_TIMEOUT_MS = 60_000;

/**
 * Ollama /api/embed: use "input" (string or string[]) for batch. One request for all texts = fast.
 */
export async function embed(texts: string[], model?: string, baseUrlOverride?: string): Promise<number[][]> {
  const embedModel = model ?? process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_EMBED_MODEL;
  const base = getBaseUrl(baseUrlOverride).replace(/\/v1\/?$/, '');
  const input = texts.map((t) => t.slice(0, 8000));
  if (input.length === 0) return [];

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    // API uses "input" (string or string[]). Some older Ollama use "prompt" for single string.
    const body: { model: string; input?: string | string[]; prompt?: string } = { model: embedModel };
    if (input.length === 1) {
      body.input = input[0];
      body.prompt = input[0];
    } else {
      body.input = input;
    }
    const res = await fetch(`${base}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(to);
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 404 || errText.includes('not found')) {
        throw new Error(`Ollama embedding model '${embedModel}' not found. Run: ollama pull ${embedModel}`);
      }
      throw new Error(`Ollama embed failed: ${res.status} ${errText}`);
    }
    const data = (await res.json()) as { embedding?: number[]; embeddings?: number[][] };
    const vectors = data.embeddings ?? (data.embedding ? [data.embedding] : []);
    if (vectors.length !== input.length) {
      throw new Error(`Ollama embed returned ${vectors.length} vectors for ${input.length} inputs`);
    }
    return vectors;
  } catch (err) {
    clearTimeout(to);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('Failed to fetch') || msg.includes('abort')) {
      throw new Error('Ollama is not running or timed out. Start it with: ollama serve');
    }
    throw err;
  }
}

export function isConfigured(): boolean {
  const useOllama = process.env.USE_OLLAMA;
  return (
    useOllama === 'true' ||
    useOllama === '1' ||
    Boolean(process.env.OLLAMA_BASE_URL)
  );
}
