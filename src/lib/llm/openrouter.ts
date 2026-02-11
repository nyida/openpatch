/**
 * OpenRouter API client. OpenAI-compatible base URL + key.
 * Use OPENROUTER_API_KEY in .env to use multiple models (OpenAI, Anthropic, etc.) with one key.
 */
import OpenAI from 'openai';
import { logger } from '@/lib/logger';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function getClient(): OpenAI | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: OPENROUTER_BASE });
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function complete(
  messages: { role: string; content: string }[],
  options: CompletionOptions = {}
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('OPENROUTER_API_KEY not set');
  const model = options.model ?? 'openai/gpt-4o-mini';
  const resp = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
    max_tokens: options.maxTokens ?? 1024,
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
}

export async function embed(texts: string[], model = 'openai/text-embedding-3-small'): Promise<number[][]> {
  const client = getClient();
  if (!client) throw new Error('OPENROUTER_API_KEY not set');
  const input = texts.map((t) => t.slice(0, 8000));
  const resp = await client.embeddings.create({ model, input });
  return resp.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function isConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
