import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const RESULTS = path.join(ROOT, 'evals', 'results');

export async function GET() {
  try {
    const summaryPath = path.join(RESULTS, 'summary_by_mode.csv');
    const summaryTablePath = path.join(RESULTS, 'tables', 'summary_table.csv');
    const pairwisePath = path.join(RESULTS, 'tables', 'pairwise_comparison.csv');
    const bootstrapPath = path.join(RESULTS, 'bootstrap_results.json');
    const figuresDir = path.join(RESULTS, 'figures');

    let summaryCsv: string | null = null;
    let summaryTableCsv: string | null = null;
    let pairwiseCsv: string | null = null;
    let bootstrap: unknown = null;
    const figures: string[] = [];

    if (fs.existsSync(summaryPath)) {
      summaryCsv = fs.readFileSync(summaryPath, 'utf8');
    }
    if (fs.existsSync(summaryTablePath)) {
      summaryTableCsv = fs.readFileSync(summaryTablePath, 'utf8');
    }
    if (fs.existsSync(pairwisePath)) {
      pairwiseCsv = fs.readFileSync(pairwisePath, 'utf8');
    }
    if (fs.existsSync(bootstrapPath)) {
      bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
    }
    if (fs.existsSync(figuresDir)) {
      const names = fs.readdirSync(figuresDir);
      figures.push(...names.filter((n) => n.endsWith('.png') || n.endsWith('.pdf')));
    }

    return NextResponse.json({
      summaryCsv,
      summaryTableCsv,
      pairwiseCsv,
      bootstrap,
      figures,
      metricsCsv: fs.existsSync(path.join(RESULTS, 'metrics.csv'))
        ? fs.readFileSync(path.join(RESULTS, 'metrics.csv'), 'utf8')
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
