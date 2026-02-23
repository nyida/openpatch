import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function POST() {
  try {
    const python = getPython();
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
      const proc = spawn(python, ['-m', 'evals.score', '--config', CONFIG], { cwd: ROOT, timeout: 55_000 });
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => resolve({ stdout, stderr, code }));
    });
    if (result.code !== 0) {
      return NextResponse.json(
        { error: 'Score failed', detail: result.stderr || result.stdout, code: result.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, message: 'Score complete.', stdout: result.stdout });
  } catch (e) {
    return NextResponse.json(
      { error: 'Score failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
