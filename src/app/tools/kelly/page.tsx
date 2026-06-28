'use client';

import { Shell, PageHeader } from '@/components/whale/Shell';
import { KellyCalculator } from '@/components/whale/KellyCalculator';

export default function KellyToolPage() {
  return (
    <Shell>
      <PageHeader
        title="Kelly calculator"
        description="Optimal position sizing for binary prediction markets using fractional Kelly criterion."
      />
      <KellyCalculator defaultBankroll={10000} />
    </Shell>
  );
}
