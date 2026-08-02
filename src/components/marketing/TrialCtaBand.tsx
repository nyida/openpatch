'use client';

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { FadeUp } from '@/components/marketing/Motion';

const RevealWaveImage = dynamic(
  () =>
    import('@/components/ui/reveal-wave-image').then((m) => m.RevealWaveImage),
  { ssr: false },
);

const CTA_SRC = '/scenes/waitlist-cta.png';

/**
 * Exact Relemetry waitlist CTA band design - adapted copy for Start free trial / Sign up.
 */
export function TrialCtaBand({
  title = 'Start free trial',
  subtitle = 'Open the free desk now. Upgrade to Pro when you want arbs, live flow, and exposure.',
  buttonLabel = 'Start free trial →',
}: {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
}) {
  const reduce = useReducedMotion();
  const { isSignedIn, isPro } = useAuth();
  const { openAuth } = useAuthModal();

  const onClick = () => {
    if (isPro || isSignedIn) {
      window.location.href = '/dashboard';
      return;
    }
    openAuth({ mode: 'signup', next: '/dashboard' });
  };

  const resolvedTitle = isPro
    ? 'Open the desk'
    : isSignedIn
      ? 'Continue on free'
      : title;
  const resolvedButton = isPro
    ? 'Open dashboard →'
    : isSignedIn
      ? 'Open free desk →'
      : buttonLabel;

  return (
    <FadeUp>
      <div className="relative overflow-hidden min-h-[220px]" style={{ borderRadius: 18 }}>
        {reduce ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={CTA_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0">
            <RevealWaveImage
              src={CTA_SRC}
              className="absolute inset-0 h-full w-full min-h-full min-w-full"
              pixelSize={2}
              shimmer={1}
              shadow={0.42}
              mid={0.72}
              lift={0.14}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-[1] px-7 py-10 text-white sm:px-10 sm:py-12">
          <div className="max-w-xl">
            <h2 className="font-sans text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.03em] text-white">
              {resolvedTitle}
            </h2>
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-white">{subtitle}</p>
            <div className="mt-8">
              <motion.button
                type="button"
                onClick={onClick}
                whileHover={reduce ? undefined : { scale: 1.03 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="inline-flex h-11 items-center justify-center bg-white px-6 text-[13px] font-semibold text-black transition hover:bg-white/90"
                style={{ borderRadius: 5 }}
              >
                {resolvedButton}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </FadeUp>
  );
}

/** Compact article-footer variant (Relemetry article CTA sizing). */
export function TrialCtaBandCompact() {
  return (
    <TrialCtaBand
      title="Start free trial"
      subtitle="Get early access to the free whale desk - Pro unlocks arbs and live flow."
      buttonLabel="Sign up free →"
    />
  );
}
