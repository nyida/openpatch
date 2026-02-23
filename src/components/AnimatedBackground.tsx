'use client';

import { motion } from 'framer-motion';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 to-white" />
      <motion.div
        className="absolute w-[min(70vw,500px)] h-[min(70vw,500px)] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(13, 148, 136, 0.2) 0%, transparent 65%)',
          filter: 'blur(60px)',
          left: '10%',
          top: '20%',
        }}
        animate={{ x: [0, 25, -15, 0], y: [0, -20, 15, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[min(60vw,400px)] h-[min(60vw,400px)] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.2) 0%, transparent 65%)',
          filter: 'blur(50px)',
          right: '10%',
          bottom: '25%',
        }}
        animate={{ x: [0, -30, 20, 0], y: [0, 15, -10, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
