import { getSession } from '@/lib/auth';
import { AuthForm } from '@/app/auth/AuthForm';
import { PageMotion } from '@/components/PageMotion';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <PageMotion className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Settings</h1>
          <span className="badge text-[var(--text-muted)] bg-[var(--bg-subtle)]">v1</span>
        </div>
        <p className="page-subtitle">Auth and API configuration.</p>
      </div>
      <div className="card space-y-8">
        <section>
          <h2 className="section-label">Account</h2>
          {session ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <p className="text-[var(--text-primary)] font-medium">Logged in</p>
              <p className="text-slate-700 text-[15px] mt-1">{session.email}</p>
              <p className="text-slate-500 text-sm mt-1">Your chats and runs are saved to your account.</p>
              <form action="/api/auth/logout" method="POST" className="mt-3">
                <button type="submit" className="text-sm text-slate-600 hover:text-slate-800 font-medium">
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <div>
              <p className="text-slate-600 text-sm mb-3">Log in to save your chats and access them from any device.</p>
              <AuthForm />
            </div>
          )}
        </section>
        <section>
          <h2 className="section-label">LLM (Ollama)</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The app uses 5 free Ollama models (llama3.2, qwen2.5:3b, mistral, phi3, gemma2:2b). No API key required. Default is 5 candidates per run. For parallel runs (faster), set <code className="px-1.5 py-0.5 rounded-md bg-slate-100 font-mono text-xs">OLLAMA_URLS</code> in .env to 5 comma-separated URLs (e.g. ports 11434–11438) and run 5 Ollama instances.
          </p>
        </section>
        <section>
          <h2 className="section-label">Version</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Set <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs">VERSION_TAG</code> in .env to tag runs for regression comparison.
          </p>
        </section>
      </div>
    </PageMotion>
  );
}
