'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageEnter } from '@/lib/motion';

/** Soft fade + rise on every route change (via template.tsx). */
export function RouteTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="route-transition"
      initial={reduced ? false : pageEnter.initial}
      animate={pageEnter.animate}
      transition={reduced ? { duration: 0 } : pageEnter.transition}
    >
      {children}
    </motion.div>
  );
}
