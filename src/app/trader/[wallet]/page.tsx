'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shell, SkeletonTable } from '@/components/whale/Shell';

function TraderRedirect() {
  const params = useParams();
  const router = useRouter();
  const wallet = typeof params.wallet === 'string' ? decodeURIComponent(params.wallet) : '';

  useEffect(() => {
    if (wallet) {
      router.replace(`/profile?wallet=${encodeURIComponent(wallet)}`);
    } else {
      router.replace('/traders');
    }
  }, [wallet, router]);

  return (
    <Shell>
      <SkeletonTable rows={6} />
    </Shell>
  );
}

export default function TraderPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <SkeletonTable rows={6} />
        </Shell>
      }
    >
      <TraderRedirect />
    </Suspense>
  );
}
