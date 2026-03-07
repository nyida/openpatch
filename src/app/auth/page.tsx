import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageMotion } from '@/components/PageMotion';
import { AuthForm } from './AuthForm';

export const dynamic = 'force-dynamic';

export default async function AuthPage() {
  const session = await getSession();
  if (session) redirect('/chats');

  return (
    <PageMotion className="max-w-md mx-auto px-4 py-16">
      <div className="card">
        <h1 className="page-title text-xl">Sign in or create account</h1>
        <p className="text-slate-600 text-sm mt-1 mb-6">
          Use your email and password to sign in, or create a new account.
        </p>
        <AuthForm />
        <p className="text-xs text-slate-500 mt-6">
          Your chats and runs will be saved to your account.
        </p>
      </div>
      <p className="text-center mt-6">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-700">
          ← Back to Chat
        </Link>
      </p>
    </PageMotion>
  );
}
