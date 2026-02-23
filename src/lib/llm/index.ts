import * as openai from './openai';
import * as openrouter from './openrouter';
import * as ollama from './ollama';
import { logger } from '@/lib/logger';

// Parse OLLAMA_URLS for parallel multi-instance: "http://localhost:11434/v1,http://localhost:11435/v1,..."
export function getOllamaUrls(): string[] {
  const raw = process.env.OLLAMA_URLS;
  if (!raw?.trim()) return [];
  return raw.split(',').map((u) => {
    const url = u.trim();
    if (!url) return '';
    return url.endsWith('/v1') || url.endsWith('/v1/') ? url.replace(/\/+$/, '') : `${url.replace(/\/+$/, '')}/v1`;
  }).filter(Boolean);
}

// Smallest/fastest Ollama tags so each candidate finishes in ~10–30s instead of minutes.
const OLLAMA_MODEL_MAP: Record<string, string> = {
  'llama3.2': 'llama3.2:1b',
  'llama3.1': 'llama3.1',
  qwen: 'qwen2.5:0.5b',
  mistral: 'mistral',
  phi: 'phi3:mini',
  gemma2: 'gemma2:2b',
  'gpt-4o-mini': 'llama3.2:1b',
  gpt4: 'llama3.2:1b',
  claude: 'qwen2.5:0.5b',
  gemini: 'gemma2:2b',
  llama: 'llama3.2:1b',
  codellama: 'codellama',
};

export interface LLMAdapter {
  complete(messages: { role: string; content: string }[], options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<string>;
}

export const defaultLLM: LLMAdapter = {
  async complete(messages, options) {
    return ollama.complete(messages, {
      model: options?.model ?? process.env.OLLAMA_MODEL ?? 'llama3.2',
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });
  },
};

/** Model key to Ollama model name. */
function resolveModel(modelKey: string): string {
  const envModel = process.env.OLLAMA_MODEL ?? 'llama3.2';
  return OLLAMA_MODEL_MAP[modelKey] ?? envModel;
}

export async function completeWithModel(
  modelKey: string,
  messages: { role: string; content: string }[],
  opts?: {
    maxTokens?: number;
    temperature?: number;
    baseUrl?: string;
    seed?: number | string;
    dryRunEval?: { ground_truth: string; candidateIndex: number; baseSeed: string };
  }
): Promise<string> {
  const model = resolveModel(modelKey);
  logger.info('LLM complete (Ollama)', { model, messageCount: messages.length, baseUrl: opts?.baseUrl ? '(custom)' : undefined });
  return ollama.complete(messages, { model, ...opts });
}

export async function embed(texts: string[], model?: string): Promise<number[][]> {
  return ollama.embed(texts, model);
}

export { openai, openrouter, ollama };
