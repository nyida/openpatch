import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Returns config status without exposing secrets. Used by /setup page. */
export async function GET() {
  const dbUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();
  const db = dbUrl
    ? dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    : false;
  const supabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const llm =
    Boolean(process.env.OPENROUTER_API_KEY?.trim()) ||
    Boolean(process.env.OPENAI_API_KEY?.trim()) ||
    Boolean(process.env.OLLAMA_BASE_URL?.trim()) ||
    Boolean(process.env.OLLAMA_URLS?.trim());

  return NextResponse.json({
    database: db,
    supabase,
    llm,
    ready: db && llm, // Supabase optional for anonymous use
  });
}
