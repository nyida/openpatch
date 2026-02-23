import type { TaskType } from './types';
import { completeWithModel, getOllamaUrls } from '@/lib/llm';
import { createHash } from 'crypto';

const SYSTEM_PROMPT_FULL = `You are a helpful assistant. Give thorough, complete answers: cover the key points clearly and structure your response (e.g. short intro, main content, summary if needed). Be accurate and cite sources when you use them. For math, show your work. If uncertain, say so.`;
const SYSTEM_PROMPT_FAST = `You are a helpful assistant. Answer clearly and concisely. Be accurate. For math, show your work.`;

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
  { model: 'llama3.2', temperature: 0.3, maxTokens: 1024 },
  { model: 'qwen', temperature: 0.35, maxTokens: 1024 },
  { model: 'mistral', temperature: 0.3, maxTokens: 1024 },
  { model: 'phi', temperature: 0.25, maxTokens: 1024 },
  { model: 'gemma2', temperature: 0.3, maxTokens: 1024 },
];

const FAST_MAX_TOKENS = 512;

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
  const fastPath = count === 1;
  const systemPrompt = fastPath ? SYSTEM_PROMPT_FAST : SYSTEM_PROMPT_FULL;
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: prompt },
  ];
  const configs = DEFAULT_CONFIGS.slice(0, count);
  const ollamaUrls = getOllamaUrls();
  const results = await Promise.all(
    configs.map(async (config, i) => {
      const baseUrl = ollamaUrls.length > 0 ? ollamaUrls[i % ollamaUrls.length] : undefined;
      const maxTokens = fastPath ? FAST_MAX_TOKENS : config.maxTokens;
      const start = Date.now();
      const output = await completeWithModel(
        config.model,
        messages,
        { temperature: config.temperature, maxTokens, baseUrl }
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
