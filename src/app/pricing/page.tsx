'use client';

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { MarketingShell, Section } from '@/components/marketing/MarketingShell';
import { FadeUp, HeroMedia } from '@/components/marketing/Motion';
import { TrialCtaBand } from '@/components/marketing/TrialCtaBand';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PRO_PRICE_LABEL } from '@/lib/auth/types';
import { EASE_OUT } from '@/lib/motion';

const RevealWaveImage = dynamic(
  () =>
    import('@/components/ui/reveal-wave-image').then((m) => m.RevealWaveImage),
  { ssr: false },
);

const HERO_SRC = '/scenes/affiliates-sunflowers.png';

const FREE_ROWS = [
  { title: 'Whale dashboard', detail: 'Holdings vs odds, ranked by notional' },
  { title: 'Trader leaderboard', detail: 'Profiles and wallet context' },
  { title: 'Market screener', detail: 'Crowded books across venues' },
  { title: 'Kelly & paper tools', detail: 'Size risk before you commit' },
  { title: 'Basic alerts', detail: 'Stay on top of your watchlist' },
] as const;

const PRO_ROWS = [
  { title: 'Cross-venue arbitrage', detail: 'Polymarket ↔ Kalshi gaps with venue links' },
  { title: 'Live whale flow', detail: 'Large fills as they hit the tape' },
  { title: 'Market exposure', detail: 'Where size is concentrating' },
  { title: 'Spread history', detail: 'Persistent mispricings over time' },
  { title: 'Priority refresh', detail: 'Faster data when markets move' },
] as const;

const COMPARE = [
  { feature: 'Whale dashboard & holdings', free: true, pro: true },
  { feature: 'Trader leaderboard & profiles', free: true, pro: true },
  { feature: 'Market screener', free: true, pro: true },
  { feature: 'Kelly calculator & paper tools', free: true, pro: true },
  { feature: 'Basic alerts', free: true, pro: true },
  { feature: 'Cross-venue arbitrage scanner', free: false, pro: true },
  { feature: 'Live whale flow & large fills', free: false, pro: true },
  { feature: 'Market exposure rankings', free: false, pro: true },
  { feature: 'Spread history & advanced feeds', free: false, pro: true },
  { feature: 'Priority data refresh', free: false, pro: true },
] as const;

function PlanCta({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduce ? undefined : { scale: 1.02, y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={
        primary
          ? 'inline-flex h-12 w-full items-center justify-center bg-white px-6 text-[13px] font-semibold text-black transition hover:bg-white/90 sm:w-auto'
          : 'inline-flex h-12 w-full items-center justify-center border border-white/35 bg-transparent px-6 text-[13px] font-semibold text-white transition hover:bg-white/10 sm:w-auto'
      }
      style={{ borderRadius: 5 }}
    >
      {children}
    </motion.button>
  );
}

export default function PricingPage() {
  const reduce = useReducedMotion();
  const { openAuth } = useAuthModal();
  const { isSignedIn, isPro } = useAuth();

  const startFree = () => {
    if (isSignedIn) {
      window.location.href = '/dashboard';
      return;
    }
    openAuth({ mode: 'signup', next: '/dashboard' });
  };

  const startPro = () => {
    if (isPro) {
      window.location.href = '/dashboard';
      return;
    }
    if (isSignedIn) {
      window.location.href = '/paywall';
      return;
    }
    openAuth({ mode: 'signup', next: '/paywall' });
  };

  return (
    <MarketingShell>
      {/* Brand-first pricing hero */}
      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        <motion.div
          className="relative flex min-h-[calc(52svh-1.5rem)] items-center justify-center overflow-hidden sm:min-h-[calc(56svh-0.5rem)]"
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
                shadow={0.22}
                mid={0.5}
                lift={0.06}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 42%, rgba(0,0,0,0.65) 100%)',
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
                className="drop-shadow-sm h-[44px] w-[44px] rounded-xl object-cover sm:h-[56px] sm:w-[56px]"
                width={56}
                height={56}
              />
              <p className="font-sans text-[clamp(2.25rem,7vw,4.25rem)] font-semibold tracking-[-0.045em] text-white">
                Pricing
              </p>
            </motion.div>

            <motion.h1
              className="mx-auto mt-6 max-w-[24ch] font-sans text-[clamp(1.15rem,2.4vw,1.5rem)] font-medium leading-snug tracking-[-0.02em] text-white"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.4, ease: EASE_OUT }}
            >
              Free for the core desk. Pro for the edge.
            </motion.h1>
          </div>

          <motion.a
            href="#plans"
            className="absolute bottom-5 right-5 z-[1] flex items-center gap-2 text-[12px] text-white sm:bottom-7 sm:right-7"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            whileHover={{ opacity: 0.8 }}
          >
            <span className="hidden sm:inline">Plans</span>
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

      {/* Plan chooser - editorial split, not SaaS cards */}
      <Section id="plans" wide className="pb-8 pt-16 font-sans text-white md:pb-10 md:pt-20">
        <FadeUp>
          <p className="mx-auto max-w-xl text-center text-[15px] leading-relaxed text-white">
            Start free with whales, screener, and traders. Upgrade to Pro when you want arbs, live
            flow, and exposure.
          </p>
        </FadeUp>

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Free */}
          <FadeUp delay={0.05}>
            <div className="rounded-xl px-5 py-7 transition-colors duration-200 hover:bg-white/[0.045] sm:px-6">
              <div className="flex items-baseline gap-2">
                <p className="font-sans text-[17px] font-bold tracking-tight text-white">Free</p>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-sans text-[clamp(2.75rem,6vw,3.75rem)] font-bold leading-none tracking-[-0.05em] text-white">
                  $0
                </span>
                <span className="mb-1.5 text-[14px] text-white">forever</span>
              </div>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white">
                The core whale desk. Account required. No card for Free.
              </p>

              <ul className="mt-8 space-y-1">
                {FREE_ROWS.map((row) => (
                  <li
                    key={row.title}
                    className="rounded-lg px-3 py-2.5 -mx-1 transition-colors duration-150 hover:bg-white/[0.06]"
                  >
                    <p className="font-sans text-[15px] font-semibold text-white">{row.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white">{row.detail}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-10 px-2">
                <PlanCta onClick={startFree}>
                  {isSignedIn ? 'Open free desk' : 'Start free'}
                </PlanCta>
              </div>
            </div>
          </FadeUp>

          {/* Pro */}
          <FadeUp delay={0.1}>
            <div className="rounded-xl px-5 py-7 transition-colors duration-200 hover:bg-white/[0.045] sm:px-6">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <p className="font-sans text-[17px] font-bold tracking-tight text-white">Pro</p>
                <span
                  className="font-sans text-[12px] font-bold tracking-tight text-black"
                  style={{
                    background: 'var(--mint)',
                    padding: '3px 8px',
                    borderRadius: 3,
                  }}
                >
                  Recommended
                </span>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-sans text-[clamp(2.75rem,6vw,3.75rem)] font-bold leading-none tracking-[-0.05em] text-white tabular-nums">
                  $20
                </span>
                <span className="mb-1.5 text-[14px] text-white">/ month</span>
              </div>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white">
                Everything in Free, plus the alpha layer for traders who need the edge.
              </p>

              <ul className="mt-8 space-y-1">
                {PRO_ROWS.map((row) => (
                  <li
                    key={row.title}
                    className="rounded-lg px-3 py-2.5 -mx-1 transition-colors duration-150 hover:bg-white/[0.06]"
                  >
                    <p className="font-sans text-[15px] font-semibold text-white">{row.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white">{row.detail}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-10 px-2">
                <PlanCta onClick={startPro} primary>
                  {isPro ? 'Open dashboard' : `Go Pro · ${PRO_PRICE_LABEL}`}
                </PlanCta>
              </div>
            </div>
          </FadeUp>
        </div>
      </Section>

      {/* Full comparison */}
      <Section id="compare" className="pb-16 pt-8 font-sans text-white md:pb-24 md:pt-12">
        <FadeUp>
          <p className="font-sans text-[14px] font-bold tracking-tight text-white">
            Compare
          </p>
          <h2 className="mt-3 max-w-[18ch] font-sans text-[clamp(1.45rem,2.8vw,1.9rem)] font-bold tracking-[-0.03em] text-white">
            Every surface, side by side.
          </h2>
        </FadeUp>

        <FadeUp delay={0.06} className="mt-10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="pb-4 pr-4 font-sans text-[13px] font-bold text-white">
                    Feature
                  </th>
                  <th className="w-24 pb-4 text-center font-sans text-[13px] font-bold text-white sm:w-28">
                    Free
                  </th>
                  <th className="w-24 pb-4 text-center font-sans text-[13px] font-bold text-white sm:w-28">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr
                    key={row.feature}
                    className="transition-colors duration-150 hover:bg-white/[0.05]"
                  >
                    <td className="rounded-l-lg py-3.5 pr-4 pl-2 text-[14px] text-white">
                      {row.feature}
                    </td>
                    <td className="py-3.5 text-center text-[14px] text-white">
                      {row.free ? 'Yes' : '–'}
                    </td>
                    <td className="rounded-r-lg py-3.5 text-center text-[14px] font-semibold text-white">
                      {row.pro ? 'Yes' : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeUp>
      </Section>

      {/* Why upgrade */}
      <Section id="why-pro" className="pb-16 font-sans text-white md:pb-24">
        <FadeUp>
          <p className="font-sans text-[14px] font-bold tracking-tight text-white">
            Why Pro
          </p>
          <h2 className="mt-3 max-w-[20ch] font-sans text-[clamp(1.45rem,2.8vw,1.9rem)] font-bold tracking-[-0.03em] text-white">
            Free reads the book. Pro catches the move.
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white">
            Free is enough to study whales, screen markets, and follow top traders. Pro is for when
            you need cross-venue gaps, live size, and exposure in the same desk - without wiring your
            own stack.
          </p>
        </FadeUp>

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            {
              title: 'Same event, two venues',
              body: 'When Polymarket and Kalshi disagree, Pro surfaces the gap with links to both books.',
            },
            {
              title: 'Size while it matters',
              body: 'Live whale prints hit the desk as large fills land - not after the mid has already moved.',
            },
            {
              title: 'Structure, not noise',
              body: 'Exposure and spread history show where risk concentrates and which dislocations persist.',
            },
          ].map((item, i) => (
            <FadeUp key={item.title} delay={0.05 + i * 0.06}>
              <p className="font-sans text-[13px] font-medium tabular-nums tracking-[0.08em] text-white">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-3 text-[17px] font-semibold tracking-tight text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white">{item.body}</p>
            </FadeUp>
          ))}
        </div>
      </Section>

      <Section className="pb-20 md:pb-28">
        <TrialCtaBand
          title="Start on Free. Upgrade anytime."
          subtitle={`Open the whale desk now. Go Pro at ${PRO_PRICE_LABEL} when you want arbs, live flow, and exposure.`}
          buttonLabel="Start free trial →"
        />
      </Section>
    </MarketingShell>
  );
}
