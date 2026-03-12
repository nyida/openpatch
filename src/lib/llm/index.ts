import * as openai from './openai';
import * as openrouter from './openrouter';
import * as ollama from './ollama';
import { logger } from '@/lib/logger';

/** True when Ollama is configured (local or remote). USE_OLLAMA forces Ollama. In dev, prefer Ollama by default. */
export function isOllamaConfigured(): boolean {
  if (process.env.USE_OLLAMA === 'true' || process.env.USE_OLLAMA === '1') return true;
  if (process.env.USE_OLLAMA === 'false' || process.env.USE_OLLAMA === '0') return false;
  if (process.env.OLLAMA_BASE_URL?.trim()) return true;
  const urls = process.env.OLLAMA_URLS?.trim();
  if (urls && urls.split(',').some((u) => u.trim().length > 0)) return true;
  // In development, prefer Ollama (localhost) to avoid OpenRouter connection issues
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

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

/** Cloud model for OpenRouter (one key, many models). */
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
/** Cloud model for OpenAI. */
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export interface LLMAdapter {
  complete(messages: { role: string; content: string }[], options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<string>;
}

function getCloudLLM(): 'openrouter' | 'openai' | null {
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  return null;
}

export const defaultLLM: LLMAdapter = {
  async complete(messages, options) {
    if (isOllamaConfigured()) {
      return ollama.complete(messages, {
        model: options?.model ?? process.env.OLLAMA_MODEL ?? 'llama3.2',
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });
    }
    const cloud = getCloudLLM();
    if (cloud === 'openrouter') {
      return openrouter.complete(messages, {
        model: OPENROUTER_MODEL,
        maxTokens: options?.maxTokens ?? 576,
        temperature: options?.temperature ?? 0.3,
      });
    }
    if (cloud === 'openai') {
      return openai.complete(messages, {
        model: OPENAI_MODEL,
        maxTokens: options?.maxTokens ?? 576,
        temperature: options?.temperature ?? 0.3,
      });
    }
    throw new Error(
      'No LLM configured. Set OLLAMA_BASE_URL (local), or OPENROUTER_API_KEY / OPENAI_API_KEY (production).'
    );
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
  if (opts?.dryRunEval) {
    return ollama.complete(messages, { ...opts, model: 'llama3.2' });
  }
  if (isOllamaConfigured()) {
    const model = resolveModel(modelKey);
    logger.info('LLM complete (Ollama)', { model, messageCount: messages.length, baseUrl: opts?.baseUrl ? '(custom)' : undefined });
    return ollama.complete(messages, { model, ...opts });
  }
  const cloud = getCloudLLM();
  if (cloud === 'openrouter') {
    logger.info('LLM complete (OpenRouter)', { model: OPENROUTER_MODEL, messageCount: messages.length });
    return openrouter.complete(messages, {
      model: OPENROUTER_MODEL,
      maxTokens: opts?.maxTokens ?? 576,
      temperature: opts?.temperature ?? 0.3,
    });
  }
  if (cloud === 'openai') {
    logger.info('LLM complete (OpenAI)', { model: OPENAI_MODEL, messageCount: messages.length });
    return openai.complete(messages, {
      model: OPENAI_MODEL,
      maxTokens: opts?.maxTokens ?? 576,
      temperature: opts?.temperature ?? 0.3,
    });
  }
  throw new Error(
    'No LLM configured. Set OLLAMA_BASE_URL (local), or OPENROUTER_API_KEY / OPENAI_API_KEY (production).'
  );
}

export async function embed(texts: string[], model?: string): Promise<number[][]> {
  if (isOllamaConfigured()) {
    return ollama.embed(texts, model);
  }
  const cloud = getCloudLLM();
  if (cloud === 'openrouter') {
    return openrouter.embed(texts);
  }
  if (cloud === 'openai') {
    return openai.embed(texts);
  }
  throw new Error(
    'No embed model. Set OLLAMA_BASE_URL, or OPENROUTER_API_KEY / OPENAI_API_KEY.'
  );
}

export { openai, openrouter, ollama };
