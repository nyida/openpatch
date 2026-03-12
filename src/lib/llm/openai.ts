import OpenAI from 'openai';
import { logger } from '@/lib/logger';

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const OPENAI_ERR_MSG =
  'OpenAI connection failed. Check your network and OPENAI_API_KEY. For local dev without API keys, set USE_OLLAMA=true and run: ollama serve';

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
  if (!client) throw new Error('OPENAI_API_KEY not set');
  const model = options.model ?? 'gpt-4o-mini';
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
        logger.debug('OpenAI usage', {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          model,
        });
      }
      return choice.message.content;
    } catch (err) {
      lastErr = err;
      if (isAuthError(err)) {
        throw new Error('OpenAI API key invalid or expired. Check OPENAI_API_KEY.');
      }
      if (isConnectionError(err)) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error(OPENAI_ERR_MSG);
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function embed(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
  const client = getClient();
  if (!client) throw new Error('OPENAI_API_KEY not set');
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
        throw new Error('OpenAI API key invalid or expired. Check OPENAI_API_KEY.');
      }
      if (isConnectionError(err)) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error(OPENAI_ERR_MSG);
      }
      throw err;
    }
  }
  throw lastErr;
}

export function estimateCost(promptTokens: number, completionTokens: number, model: string): number {
  const rates: Record<string, [number, number]> = {
    'gpt-4o': [2.5, 10],
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4-turbo': [10, 30],
    'text-embedding-3-small': [0.02, 0],
  };
  const [p, c] = rates[model] ?? [0.2, 0.6];
  return (promptTokens * p + completionTokens * c) / 1_000_000;
}
