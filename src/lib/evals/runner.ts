import type { EvalCase, Run } from '@prisma/client';
import type { RunPipelineResult } from '@/lib/pipeline/run';

export function runEvalCase(
  evalCase: EvalCase,
  _run: Run,
  runResult: RunPipelineResult
): Record<string, unknown> | null {
  const expected = (evalCase.expectedPropertiesJson as Record<string, unknown>) ?? {};
  const metrics: Record<string, unknown> = {
    latencyMs: runResult.latencyMs,
    confidence: runResult.reliability.overallConfidence,
    retrievalUsed: runResult.reliability.retrievalUsed,
  };
  let pass = true;
  if (expected.minConfidence && typeof expected.minConfidence === 'string') {
    const order = { low: 0, medium: 1, high: 2 };
    if (order[runResult.reliability.overallConfidence] < order[expected.minConfidence as keyof typeof order]) pass = false;
  }
  if (expected.retrievalRequired && !runResult.reliability.retrievalUsed) pass = false;
  if (expected.claimsSupportedMin != null && (runResult.reliability.claimsSupportedPercent ?? 0) < Number(expected.claimsSupportedMin)) pass = false;
  metrics.pass = pass;
  return metrics;
}
