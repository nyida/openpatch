import fs from 'fs';
import path from 'path';
import { runId as seedRunId } from '@/lib/seed';

export type PipelineMode = 'baseline' | 'improved';

export interface RunCandidate {
  model: string;
  raw: string;
  parsed?: string;
  latencyMs: number;
  sample_index: number;
  seed?: number;
  temperature?: number;
  maxTokens?: number;
}

/** Deterministic run ID. stableContext is required (no time-based entropy). */
export function runId(
  prompt: string,
  mode: PipelineMode,
  stableContext: string
): string {
  return seedRunId(prompt, mode, stableContext);
}

export interface RunRecord {
  run_id: string;
  timestamp: string;
  mode: PipelineMode;
  /** Eval: dataset_id, item_id, ground_truth. Chat: optional. */
  eval?: { dataset_id: string; item_id: string; ground_truth: string };
  inputs: {
    prompt: string;
    model?: string;
    models?: string[];
    temperature?: number;
    max_tokens?: number;
    seed?: number;
    n_candidates?: number;
  };
  outputs: {
    final_answer: string;
    parsed_answer?: string;
    candidates: RunCandidate[];
    judge?: { chosen_index: number; rationale?: string; scores?: Record<string, number>; vote_counts?: Record<string, number> };
    verification?: {
      format_ok: boolean;
      refusal_ok?: boolean;
      consistency?: string;
    };
  };
  latency_ms: number;
  failure?: string;
}

const APP_RUNS_DIR = process.env.APP_RUNS_DIR ?? path.join(process.cwd(), 'app_runs');
const LOG_FILE = path.join(APP_RUNS_DIR, 'logs', 'runs.jsonl');

function ensureDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function appendRun(record: RunRecord): void {
  ensureDir();
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

export function getRunsLogPath(): string {
  return LOG_FILE;
}

export function getAppRunsDir(): string {
  return APP_RUNS_DIR;
}
