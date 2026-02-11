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

export async function complete(
  messages: { role: string; content: string }[],
  options: CompletionOptions = {}
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('OPENAI_API_KEY not set');
  const model = options.model ?? 'gpt-4o-mini';
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
    logger.debug('OpenAI usage', {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      model,
    });
  }
  return choice.message.content;
}

export async function embed(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
  const client = getClient();
  if (!client) throw new Error('OPENAI_API_KEY not set');
  const input = texts.map((t) => t.slice(0, 8000));
  const resp = await client.embeddings.create({ model, input });
  return resp.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
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
