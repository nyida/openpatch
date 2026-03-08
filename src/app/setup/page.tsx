import Link from 'next/link';
import { PageMotion } from '@/components/PageMotion';
import { SetupChecklist } from './SetupChecklist';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  return (
    <PageMotion className="max-w-xl mx-auto px-4 py-16">
      <h1 className="page-title text-2xl">Quick setup</h1>
      <p className="text-slate-600 mt-1 mb-8">
        Add these in Vercel → your project → Settings → Environment Variables. One-click integrations do most of the work.
      </p>
      <SetupChecklist />
      <p className="mt-8 text-center">
        <Link href="/" className="text-sm text-teal-600 hover:text-teal-700">
          ← Back to Chat
        </Link>
      </p>
    </PageMotion>
  );
}
