'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { DUR, EASE_OUT, fadeUp, staggerContainer, staggerItem } from '@/lib/motion';

export function PageMotion({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.slow, ease: EASE_OUT, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={reduced ? undefined : staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div className={className} variants={reduced ? undefined : staggerItem}>
      {children}
    </motion.div>
  );
}
