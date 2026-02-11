import type { TaskType } from './types';
import { completeWithModel } from '@/lib/llm';
import { createHash } from 'crypto';

const SYSTEM_PROMPT = `You are a helpful assistant. Be accurate and cite sources when you use them. If you are uncertain, say so. For math, show your work.`;

function buildPrompt(
  taskType: TaskType,
  userInput: string,
  contextExcerpts: string[]
): string {
  const contextBlock =
    contextExcerpts.length > 0
      ? `Relevant context:\n${contextExcerpts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}\n\n`
      : '';
  return `${contextBlock}User question: ${userInput}`;
}

export interface GenConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIGS: GenConfig[] = [
  { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 1024 },
  { model: 'gpt4', temperature: 0.2, maxTokens: 1024 },
  { model: 'claude', temperature: 0.2, maxTokens: 1024 },
];

export async function generateCandidates(
  taskType: TaskType,
  userInput: string,
  contextExcerpts: string[],
  count = 3,
  conversationHistory?: { role: string; content: string }[]
): Promise<{ promptHash: string; config: GenConfig; output: string; latencyMs: number; tokenEstimate: [number, number] }[]> {
  const prompt = buildPrompt(taskType, userInput, contextExcerpts);
  const promptHash = createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  const history = conversationHistory ?? [];
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: prompt },
  ];
  const configs = DEFAULT_CONFIGS.slice(0, count);
  const results = await Promise.all(
    configs.map(async (config) => {
      const start = Date.now();
      const output = await completeWithModel(
        config.model === 'gpt4' ? 'gpt4' : config.model === 'claude' ? 'claude' : 'gpt-4o-mini',
        messages,
        { temperature: config.temperature, maxTokens: config.maxTokens }
      );
      const latencyMs = Date.now() - start;
      const tokenEstimate: [number, number] = [
        Math.ceil(prompt.length / 4),
        Math.ceil(output.length / 4),
      ];
      return { promptHash, config, output, latencyMs, tokenEstimate };
    })
  );
  return results;
}
