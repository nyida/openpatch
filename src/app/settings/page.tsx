import { getSession } from '@/lib/auth';
import { AuthForm } from './AuthForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">v1</span>
        </div>
        <p className="text-slate-600 mt-1 text-sm">Auth and API configuration.</p>
      </div>
      <div className="card space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Auth (demo)</h2>
          {session ? (
            <p className="text-slate-700">Signed in as <span className="font-medium">{session.email}</span></p>
          ) : (
            <AuthForm />
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">API keys</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Keys are read from environment variables (OPENROUTER_API_KEY or OPENAI_API_KEY). For production, use the encryption module and never log raw keys.
          </p>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Version</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Set <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs">VERSION_TAG</code> in .env to tag runs for regression comparison.
          </p>
        </section>
      </div>
    </div>
  );
}
