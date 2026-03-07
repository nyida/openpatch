import { NextRequest, NextResponse } from 'next/server';
import { runBaseline } from '@/lib/pipeline/baseline';
import { runImproved } from '@/lib/pipeline/improved';
import { runStandard } from '@/lib/pipeline/standard';
import { appendRun, runId, type PipelineMode } from '@/lib/run-log';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  dataset_id: z.string(),
  item_id: z.string(),
  prompt: z.string().min(1),
  ground_truth: z.string(),
  mode: z.enum(['baseline', 'improved', 'standard']),
  dry_run: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { dataset_id, item_id, prompt, ground_truth, mode } = parsed.data;
    const stableContext = `${dataset_id}:${item_id}`;
    const run_id = runId(prompt, mode as PipelineMode, stableContext);
    const dryRun = Boolean(parsed.data.dry_run);
    const evalMode = true;
    const systemPrompt = 'You are a helpful assistant. Reply with a single line in the form: ANSWER: <value>';

    if (mode === 'baseline') {
      const result = await runBaseline({
        prompt,
        systemPrompt,
        evalMode,
        baseSeed: stableContext,
        ground_truth,
        dryRun,
      });
      appendRun({
        run_id,
        timestamp: new Date().toISOString(),
        mode: 'baseline',
        eval: { dataset_id, item_id, ground_truth },
        inputs: {
          prompt,
          seed: result.metadata.seed,
          temperature: 0.3,
          max_tokens: 1024,
        },
        outputs: {
          final_answer: result.final_answer,
          parsed_answer: result.metadata.parsed_answer,
          candidates: result.candidates,
          confidence: 1,
        },
        latency_ms: result.metadata.latencyMs,
      });
      return NextResponse.json({
        run_id,
        final_answer: result.final_answer,
        parsed_answer: result.metadata.parsed_answer,
        latency_ms: result.metadata.latencyMs,
        dry_run: dryRun,
      });
    }

    if (mode === 'standard') {
      const result = await runStandard({
        prompt,
        systemPrompt,
        evalMode,
        baseSeed: stableContext,
        ground_truth,
        dryRun,
      });
      appendRun({
        run_id,
        timestamp: new Date().toISOString(),
        mode: 'standard',
        eval: { dataset_id, item_id, ground_truth },
        inputs: {
          prompt,
          n_candidates: result.candidates.length,
          temperature: 0.3,
          max_tokens: 1024,
        },
        outputs: {
          final_answer: result.final_answer,
          parsed_answer: (result as { parsed_answer?: string }).parsed_answer ?? (result.metadata as { parsed_answer?: string }).parsed_answer,
          candidates: result.candidates,
          judge: result.metadata.judge,
          verification: result.metadata.verification,
          confidence: result.metadata.confidence,
        },
        latency_ms: result.metadata.latencyMs,
      });
      return NextResponse.json({
        run_id,
        final_answer: result.final_answer,
        parsed_answer: result.parsed_answer,
        latency_ms: result.metadata.latencyMs,
        confidence: result.metadata.confidence,
        dry_run: dryRun,
      });
    }

    const result = await runImproved({
      prompt,
      systemPrompt,
      evalMode,
      baseSeed: stableContext,
      ground_truth,
      dryRun,
    });
    const n = result.candidates.length;
    const voteCounts = result.metadata.judge?.vote_counts ?? {};
    const maxVotes = n > 0 ? Math.max(...Object.values(voteCounts), 0) : 0;
    const agreementRate = n > 0 ? maxVotes / n : 0;
    appendRun({
      run_id,
      timestamp: new Date().toISOString(),
      mode: 'improved',
      eval: { dataset_id, item_id, ground_truth },
      inputs: {
        prompt,
        n_candidates: result.candidates.length,
        temperature: 0.3,
        max_tokens: 1024,
      },
      outputs: {
        final_answer: result.final_answer,
        parsed_answer: result.candidates[result.metadata.judge?.chosen_index ?? 0]?.parsed,
        candidates: result.candidates,
        judge: result.metadata.judge,
        verification: result.metadata.verification,
        confidence: agreementRate,
      },
      latency_ms: result.metadata.latencyMs,
    });
    const chosen = result.candidates[result.metadata.judge?.chosen_index ?? 0];
    const parsed_answer = chosen?.parsed;
    return NextResponse.json({
      run_id,
      final_answer: result.final_answer,
      parsed_answer,
      latency_ms: result.metadata.latencyMs,
      confidence: agreementRate,
      dry_run: dryRun,
    });
  } catch (e) {
    console.error('Eval run-one failed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Eval run failed' },
      { status: 500 }
    );
  }
}
