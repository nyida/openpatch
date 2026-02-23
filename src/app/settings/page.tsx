import { getSession } from '@/lib/auth';
import { AuthForm } from './AuthForm';
import { PageMotion } from '@/components/PageMotion';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <PageMotion className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Settings</h1>
          <span className="badge text-slate-500 bg-slate-100/90">v1</span>
        </div>
        <p className="page-subtitle">Auth and API configuration.</p>
      </div>
      <div className="card space-y-8">
        <section>
          <h2 className="section-label">Auth (demo)</h2>
          {session ? (
            <p className="text-slate-700 text-[15px]">Signed in as <span className="font-medium">{session.email}</span></p>
          ) : (
            <AuthForm />
          )}
        </section>
        <section>
          <h2 className="section-label">LLM (Ollama)</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The app uses 5 free Ollama models (llama3.2, qwen2.5:3b, mistral, phi3, gemma2:2b). No API key required. Default is 5 candidates per run. For parallel runs (faster), set <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-xs">OLLAMA_URLS</code> in .env to 5 comma-separated URLs (e.g. ports 11434–11438) and run 5 Ollama instances.
          </p>
        </section>
        <section>
          <h2 className="section-label">Version</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Set <code className="px-1.5 py-0.5 rounded-none bg-slate-100 text-slate-700 font-mono text-xs">VERSION_TAG</code> in .env to tag runs for regression comparison.
          </p>
        </section>
      </div>
    </PageMotion>
  );
}
