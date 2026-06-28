'use client';

import { Suspense } from 'react';
import { AlertsPanel } from '@/components/whale/AlertsPanel';

export default function AlertsPage() {
  return (
    <Suspense>
      <AlertsPanel />
    </Suspense>
  );
}
