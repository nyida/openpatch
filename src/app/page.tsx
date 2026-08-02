'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { MarketingShell, Section } from '@/components/marketing/MarketingShell';
import { FadeUp, HeroMedia } from '@/components/marketing/Motion';
import { TrialCtaBand } from '@/components/marketing/TrialCtaBand';
import { PRO_PRICE_LABEL } from '@/lib/auth/types';
import { EASE_OUT } from '@/lib/motion';

const RevealWaveImage = dynamic(
  () =>
    import('@/components/ui/reveal-wave-image').then((m) => m.RevealWaveImage),
  { ssr: false },
);

const HERO_SRC = '/scenes/hero-mountains.png';

function Diagram({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="mx-auto w-full max-w-[920px] h-auto"
      loading="lazy"
    />
  );
}

export default function HomePage() {
  const reduce = useReducedMotion();

  return (
    <MarketingShell>
      {/* Brand-first hero */}
      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        <motion.div
          className="relative flex min-h-[calc(100svh-4.5rem)] items-center justify-center overflow-hidden"
          style={{ borderRadius: 24 }}
          initial={reduce ? false : { opacity: 0, scale: 0.985, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          {reduce ? (
            <HeroMedia src={HERO_SRC} />
          ) : (
            <div className="absolute inset-0">
              <RevealWaveImage
                src={HERO_SRC}
                className="absolute inset-0 h-full w-full"
                pixelSize={2}
                shimmer={1}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/55" />

          <div className="relative z-[1] w-full px-5 py-20 text-center sm:px-8">
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
              <p className="font-sans text-[clamp(2.5rem,8vw,4.75rem)] font-bold tracking-[-0.045em] text-white">
                Algomarket
              </p>
            </motion.div>

            <motion.h1
              className="mx-auto mt-6 max-w-[26ch] font-sans text-[clamp(1.15rem,2.4vw,1.5rem)] font-medium leading-snug tracking-[-0.02em] text-white"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.4, ease: EASE_OUT }}
            >
              Whale analytics for Polymarket and Kalshi.
            </motion.h1>
          </div>

          <motion.a
            href="#product"
            className="absolute bottom-5 right-5 z-[1] flex items-center gap-2 text-[12px] text-white sm:bottom-7 sm:right-7"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            whileHover={{ opacity: 0.8 }}
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

      {/* Free vs Pro diagram */}
      <Section id="product" wide className="py-16 font-sans text-white md:py-24">
        <FadeUp>
          <h2 className="mx-auto max-w-[18ch] text-center font-sans text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.03em] text-white">
            Free core desk. Pro for the edge.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-[15px] leading-relaxed text-white">
            Whales, screener, and traders on Free. Arbitrage, live flow, and analytics on Pro.
          </p>
        </FadeUp>
        <FadeUp delay={0.08} className="mt-10">
          <Diagram
            src="/scenes/home-free-pro.png"
            alt="Free features versus Pro features on Algomarket"
          />
        </FadeUp>
        <FadeUp delay={0.12} className="mt-8 flex justify-center">
          <Link
            href="/pricing"
            className="text-[14px] font-semibold text-white transition hover:opacity-80"
          >
            Full pricing →
          </Link>
        </FadeUp>
      </Section>

      {/* Whales */}
      <Section id="whales" wide className="pb-16 font-sans text-white md:pb-24">
        <FadeUp>
          <p className="font-sans text-[14px] font-bold tracking-tight text-white">Free</p>
          <h2 className="mt-2 max-w-[16ch] font-sans text-[clamp(1.45rem,2.8vw,1.85rem)] font-bold tracking-[-0.03em] text-white">
            Whale desk
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white">
            Rank large positions against market odds. See notional, contracts held, and last activity
            in one view.
          </p>
        </FadeUp>
        <FadeUp delay={0.08} className="mt-10">
          <Diagram
            src="/scenes/home-whales.png"
            alt="Whale holdings dashboard with notional versus market odds"
          />
        </FadeUp>
      </Section>

      {/* Screener */}
      <Section id="screener" wide className="pb-16 font-sans text-white md:pb-24">
        <FadeUp>
          <p className="font-sans text-[14px] font-bold tracking-tight text-white">Free</p>
          <h2 className="mt-2 max-w-[16ch] font-sans text-[clamp(1.45rem,2.8vw,1.85rem)] font-bold tracking-[-0.03em] text-white">
            Market screener
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white">
            Filter by liquidity, spread, flow, and crowdedness. Highlight the books that matter.
          </p>
        </FadeUp>
        <FadeUp delay={0.08} className="mt-10">
          <Diagram
            src="/scenes/home-screener.png"
            alt="Market screener with liquidity spread flow and crowded filters"
          />
        </FadeUp>
      </Section>

      {/* Arbitrage / Pro */}
      <Section id="platform" wide className="pb-16 font-sans text-white md:pb-24">
        <FadeUp>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <p className="font-sans text-[14px] font-bold tracking-tight text-white">Pro</p>
            <span
              className="font-sans text-[12px] font-bold tracking-tight text-black"
              style={{
                background: 'var(--mint)',
                padding: '3px 8px',
                borderRadius: 3,
              }}
            >
              {PRO_PRICE_LABEL}
            </span>
          </div>
          <h2 className="mt-2 max-w-[18ch] font-sans text-[clamp(1.45rem,2.8vw,1.85rem)] font-bold tracking-[-0.03em] text-white">
            Cross-venue arbitrage
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white">
            Spot Polymarket ↔ Kalshi spreads, then follow capital flows from buy to sell.
          </p>
        </FadeUp>
        <FadeUp delay={0.08} className="mt-10">
          <Diagram
            src="/scenes/home-arb-spread.png"
            alt="Polymarket to Kalshi spread and capital flows diagram"
          />
        </FadeUp>
      </Section>

      {/* How to start */}
      <Section id="how" className="pb-20 font-sans text-white md:pb-28">
        <FadeUp>
          <h2 className="font-sans text-[clamp(1.45rem,2.8vw,1.85rem)] font-bold tracking-[-0.03em] text-white">
            How to start
          </h2>
        </FadeUp>

        <ol className="mt-10 space-y-8">
          {[
            {
              n: '1',
              title: 'Create a free account',
              body: 'Open whales, screener, and traders right away.',
            },
            {
              n: '2',
              title: 'Read both venues in one place',
              body: 'Track holdings vs odds and crowded books without tab-switching.',
            },
            {
              n: '3',
              title: 'Upgrade to Pro when you need it',
              body: `Add arbs, live flow, and analytics for ${PRO_PRICE_LABEL}.`,
            },
          ].map((step, i) => (
            <FadeUp key={step.n} delay={0.04 + i * 0.05}>
              <div className="flex gap-4 sm:gap-5">
                <span className="font-sans text-[15px] font-bold tabular-nums text-white">
                  {step.n}.
                </span>
                <div>
                  <h3 className="font-sans text-[16px] font-bold tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-white">{step.body}</p>
                </div>
              </div>
            </FadeUp>
          ))}
        </ol>
      </Section>

      <Section className="pb-20 md:pb-28">
        <TrialCtaBand
          title="Start free"
          subtitle="Open the free desk now. Upgrade to Pro when you want arbs, live flow, and analytics."
          buttonLabel="Start free →"
        />
      </Section>
    </MarketingShell>
  );
}
