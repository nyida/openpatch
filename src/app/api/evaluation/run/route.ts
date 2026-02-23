import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'evals', 'configs', 'main.yaml');

function getPython(): string {
  try {
    const fs = require('fs');
    const venv = path.join(ROOT, '.venv', 'bin', 'python');
    if (fs.existsSync(venv)) return venv;
  } catch {}
  return 'python3';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const python = getPython();
    const args = ['-m', 'evals.run', '--config', CONFIG];
    const env = { ...process.env, EVAL_DRY_RUN: dryRun ? '1' : '' };
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
      const proc = spawn(python, args, { cwd: ROOT, timeout: 280_000, env });
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => resolve({ stdout, stderr, code }));
    });
    if (result.code !== 0) {
      return NextResponse.json(
        { error: 'Eval run failed', detail: result.stderr || result.stdout, code: result.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, message: 'Run complete.', stdout: result.stdout });
  } catch (e) {
    return NextResponse.json(
      { error: 'Run failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
