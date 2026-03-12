/**
 * OpenRouter API client. OpenAI-compatible base URL + key.
 * Use OPENROUTER_API_KEY in .env to use multiple models (OpenAI, Anthropic, etc.) with one key.
 */
import OpenAI from 'openai';
import * as https from 'node:https';
import { logger } from '@/lib/logger';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_AGENT = new https.Agent({ keepAlive: true });

function getClient(): OpenAI | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: OPENROUTER_BASE,
    // Reduce transient "Connection error" / ECONNRESET failures.
    timeout: 30_000,
    maxRetries: 5,
    httpAgent: OPENROUTER_AGENT,
  });
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const OPENROUTER_ERR_MSG =
  'OpenRouter connection failed. Check your network and OPENROUTER_API_KEY at openrouter.ai/keys. For local dev without API keys, set USE_OLLAMA=true and run: ollama serve';

function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ENETUNREACH') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Connection error') ||
    msg.includes('NetworkError') ||
    msg.includes('socket hang up')
  );
}

function isAuthError(err: unknown): boolean {
  const e = err as { status?: number; code?: string };
  return e?.status === 401 || e?.status === 403 || (typeof e?.code === 'string' && e.code.includes('auth'));
}

export async function complete(
  messages: { role: string; content: string }[],
  options: CompletionOptions = {}
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('OPENROUTER_API_KEY not set');
  const model = options.model ?? 'openai/gpt-4o-mini';
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        max_tokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.3,
      });
      const choice = resp.choices[0];
      if (!choice?.message?.content) throw new Error('Empty completion');
      const usage = resp.usage;
      if (usage) {
        logger.debug('OpenRouter usage', {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          model,
        });
      }
      return choice.message.content;
    } catch (err) {
      lastErr = err;
      if (isAuthError(err)) {
        throw new Error('OpenRouter API key invalid or expired. Check OPENROUTER_API_KEY at openrouter.ai/keys.');
      }
      if (isConnectionError(err)) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error(OPENROUTER_ERR_MSG);
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function embed(texts: string[], model = 'openai/text-embedding-3-small'): Promise<number[][]> {
  const client = getClient();
  if (!client) throw new Error('OPENROUTER_API_KEY not set');
  const input = texts.map((t) => t.slice(0, 8000));
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await client.embeddings.create({ model, input });
      return resp.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (err) {
      lastErr = err;
      if (isAuthError(err)) {
        throw new Error('OpenRouter API key invalid or expired. Check OPENROUTER_API_KEY at openrouter.ai/keys.');
      }
      if (isConnectionError(err)) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error(OPENROUTER_ERR_MSG);
      }
      throw err;
    }
  }
  throw lastErr;
}

export function isConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
