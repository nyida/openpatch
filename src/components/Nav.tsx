'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const links = [
  { href: '/', label: 'Chat' },
  { href: '/research', label: 'Research' },
  { href: '/runs', label: 'Runs' },
  { href: '/evals', label: 'Evals' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <motion.nav
      className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="font-bold text-slate-900 text-lg tracking-tight flex items-center gap-2.5">
            <motion.span
              className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden shrink-0"
              whileHover={{ scale: 1.05, rotate: 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Image src="/logo.png" alt="OpenPatch" width={32} height={32} className="object-contain" />
            </motion.span>
            <span className="flex items-center gap-2">
              OpenPatch
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">v1</span>
            </span>
          </Link>
          <div className="flex gap-0.5">
            {links.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link key={href} href={href} className="relative px-3.5 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50">
                  <span className={`relative z-10 ${isActive ? 'text-teal-700' : 'text-slate-600 hover:text-slate-900'}`}>
                    {label}
                  </span>
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-xl bg-teal-500/10"
                      layoutId="nav-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
