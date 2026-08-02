'use client';

import { RouteTransition } from '@/components/RouteTransition';

export default function Template({ children }: { children: React.ReactNode }) {
  return <RouteTransition>{children}</RouteTransition>;
}
