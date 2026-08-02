'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { MarketingShell, Section } from '@/components/marketing/MarketingShell';
import { FadeUp, HeroMedia } from '@/components/marketing/Motion';
import { TrialCtaBand } from '@/components/marketing/TrialCtaBand';
import { RESEARCH } from '@/lib/content/research';
import { EASE_OUT } from '@/lib/motion';

const RevealWaveImage = dynamic(
  () =>
    import('@/components/ui/reveal-wave-image').then((m) => m.RevealWaveImage),
  { ssr: false },
);

const HERO_SRC = '/scenes/research-nyse.png';

export default function ResearchIndexPage() {
  const reduce = useReducedMotion();

  return (
    <MarketingShell>
      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        <motion.div
          className="relative flex min-h-[calc(50svh-1.5rem)] items-center justify-center overflow-hidden sm:min-h-[calc(50svh-0.5rem)]"
          style={{ borderRadius: 24 }}
          initial={reduce ? false : { opacity: 0, scale: 0.985, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          {reduce ? (
            <HeroMedia src={HERO_SRC} />
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <RevealWaveImage
                src={HERO_SRC}
                className="absolute inset-0 !h-full !w-full min-h-full min-w-full"
                pixelSize={2}
                shimmer={1}
                shadow={0.18}
                mid={0.45}
                lift={0}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/72" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 40%, rgba(0,0,0,0.55) 100%)',
            }}
          />

          <div className="relative z-[1] w-full px-5 py-14 text-center sm:px-8 sm:py-16">
            <motion.div
              className="flex items-center justify-center gap-3 sm:gap-4"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.2, ease: EASE_OUT }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                className="drop-shadow-sm h-[52px] w-[52px] rounded-xl object-cover sm:h-[72px] sm:w-[72px]"
                width={72}
                height={72}
              />
              <p className="font-sans text-[clamp(2.5rem,8vw,4.75rem)] font-semibold tracking-[-0.045em] text-white">
                Research
              </p>
            </motion.div>

            <motion.h1
              className="mx-auto mt-6 max-w-[22ch] font-sans text-[clamp(1.15rem,2.4vw,1.5rem)] font-medium leading-snug tracking-[-0.02em] text-white"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.4, ease: EASE_OUT }}
            >
              How we read prediction markets.
            </motion.h1>
          </div>

          <motion.a
            href="#notes"
            className="absolute bottom-5 right-5 z-[1] flex items-center gap-2 text-[12px] text-white sm:bottom-7 sm:right-7"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            whileHover={{ color: '#fff' }}
          >
            <span className="hidden sm:inline">Scroll</span>
            <motion.span
              className="flex h-7 w-7 items-center justify-center border border-white/30"
              style={{ borderRadius: 4 }}
              animate={reduce ? undefined : { y: [0, 4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              ↓
            </motion.span>
          </motion.a>
        </motion.div>
      </div>

      <Section id="notes" className="py-16 font-sans text-white md:py-20">
        <FadeUp>
          <p className="max-w-xl text-[15px] leading-relaxed text-white">
            Product research with public citations. We do not invent sample sizes or win rates.
          </p>
        </FadeUp>

        <div className="mt-10 space-y-1">
          {RESEARCH.map((r, i) => (
            <FadeUp key={r.slug} delay={0.04 + i * 0.05} y={14}>
              <Link
                href={`/research/${r.slug}`}
                className="group block px-4 py-5 transition-colors duration-200"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-raised)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <p className="text-[13px] text-white">{r.published}</p>
                <h2 className="mt-2 font-sans text-[18px] font-semibold leading-snug tracking-[-0.02em] text-white sm:text-[19px]">
                  {r.title}
                </h2>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white">
                  {r.summary}
                </p>
              </Link>
            </FadeUp>
          ))}
        </div>
      </Section>

      <Section className="pb-20 md:pb-28">
        <TrialCtaBand
          title="Start free trial"
          subtitle="Get early access to the free whale desk. Upgrade to Pro when you want arbs and live flow."
          buttonLabel="Start free trial →"
        />
      </Section>
    </MarketingShell>
  );
}
