'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRef, useState, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { NavAuth } from './NavAuth';

const links = [
  { href: '/', label: 'Query' },
  { href: '/chats', label: 'Conversations' },
  { href: '/research', label: 'Methodology' },
  { href: '/runs', label: 'Traces' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = links.findIndex((l) => l.href === pathname);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = activeIndex >= 0 ? linkRefs.current[activeIndex] : null;
    if (container && el) {
      const cr = container.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setPill({ left: er.left - cr.left, width: er.width });
    }
  }, [activeIndex, pathname]);

  return (
    <nav className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-14">
            <Link
            href="/"
            className="font-serif font-semibold text-[var(--text-primary)] text-[15px] tracking-tight flex items-center gap-2.5"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 overflow-hidden shrink-0">
              <Image src="/logo.png" alt="OpenPatch" width={32} height={32} className="object-contain" />
            </span>
            OpenPatch
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded-none">
              v1
            </span>
          </Link>
          <div ref={containerRef} className="flex gap-0.5 relative">
            {activeIndex >= 0 && pill.width > 0 && (
              <motion.span
                className="absolute top-0 bottom-0 rounded-none bg-[var(--accent)]/5"
                initial={false}
                animate={{ left: pill.left, width: pill.width }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {links.map(({ href, label }, i) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  ref={(el) => { linkRefs.current[i] = el; }}
                  className={`relative z-[1] px-3.5 py-2 rounded-none text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2 ${
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <NavAuth />
        </div>
      </div>
    </nav>
  );
}
