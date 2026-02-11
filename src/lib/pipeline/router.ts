import { TaskType } from './types';
import { logger } from '@/lib/logger';

const ROUTER_PROMPT = `You are a task classifier. Classify the user query into exactly one of: factual_with_sources, math_logic, code_assistance, general_writing, unknown.
- factual_with_sources: questions that need citations, facts from documents, or "according to the doc"
- math_logic: arithmetic, equations, calculations, logic puzzles
- code_assistance: programming, code snippets, debugging, implementation
- general_writing: creative writing, style, summarization without strict factual claims
- unknown: unclear or mixed
Reply with only the single label, nothing else.`;

export async function classifyTask(
  inputText: string,
  hasAttachments: boolean,
  llm: { complete: (messages: { role: string; content: string }[]) => Promise<string> }
): Promise<TaskType> {
  const text = inputText.slice(0, 2000);
  const withContext = hasAttachments
    ? `User has attached documents/URLs. Query: ${text}`
    : text;
  try {
    const raw = await llm.complete([
      { role: 'system', content: ROUTER_PROMPT },
      { role: 'user', content: withContext },
    ]);
    const label = raw.trim().toLowerCase().replace(/\s+/g, '_');
    const allowed: TaskType[] = [
      'factual_with_sources',
      'math_logic',
      'code_assistance',
      'general_writing',
      'unknown',
    ];
    if (allowed.includes(label as TaskType)) return label as TaskType;
    if (label.includes('factual')) return 'factual_with_sources';
    if (label.includes('math') || label.includes('logic')) return 'math_logic';
    if (label.includes('code')) return 'code_assistance';
    if (label.includes('writing')) return 'general_writing';
    return 'unknown';
  } catch (e) {
    logger.warn('Router LLM failed, defaulting to unknown', { error: String(e) });
    return hasAttachments ? 'factual_with_sources' : 'unknown';
  }
}
