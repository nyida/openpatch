'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { EASE_OUT } from '@/lib/motion';

export function FadeUp({
  children,
  className = '',
  delay = 0,
  y = 28,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();

  if (reduce) return <div className={className} style={style}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.75, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/** Hero image with slow ken-burns + scroll parallax (reduced-motion / fallback). */
export function HeroMedia({ src }: { src: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: wrap,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1.2]);

  if (reduce) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
    );
  }

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden">
      <motion.div style={{ y, scale }} className="absolute inset-[-8%]">
        <motion.img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          initial={{ scale: 1.12, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE_OUT }}
        />
      </motion.div>
    </div>
  );
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
