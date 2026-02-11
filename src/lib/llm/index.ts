import * as openai from './openai';
import * as openrouter from './openrouter';
import { logger } from '@/lib/logger';

const useOpenRouter = openrouter.isConfigured();

export interface LLMAdapter {
  complete(messages: { role: string; content: string }[], options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<string>;
}

export const defaultLLM: LLMAdapter = {
  async complete(messages, options) {
    if (useOpenRouter) {
      return openrouter.complete(messages, {
        model: options?.model ?? 'openai/gpt-4o-mini',
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });
    }
    return openai.complete(messages, {
      model: options?.model ?? 'gpt-4o-mini',
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });
  },
};

/** Model key to full model id (OpenRouter or OpenAI). */
function resolveModel(modelKey: string): string {
  if (useOpenRouter) {
    return modelKey === 'gpt4' ? 'openai/gpt-4o' : modelKey === 'claude' ? 'anthropic/claude-3.5-sonnet' : 'openai/gpt-4o-mini';
  }
  return modelKey === 'gpt4' ? 'gpt-4o' : 'gpt-4o-mini';
}

export async function completeWithModel(
  modelKey: string,
  messages: { role: string; content: string }[],
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const model = resolveModel(modelKey);
  logger.info('LLM complete', { model, messageCount: messages.length, provider: useOpenRouter ? 'openrouter' : 'openai' });
  if (useOpenRouter) return openrouter.complete(messages, { model, ...opts });
  return openai.complete(messages, { model, ...opts });
}

export async function embed(texts: string[], model?: string): Promise<number[][]> {
  if (useOpenRouter) return openrouter.embed(texts, model ?? 'openai/text-embedding-3-small');
  return openai.embed(texts, model ?? 'text-embedding-3-small');
}

export { openai, openrouter };
