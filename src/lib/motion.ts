/** Shared motion - soft fade + tiny rise, GPU-safe (opacity + transform only). */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_PANEL = [0.32, 0.72, 0, 1] as const;

export const SPRING_SOFT = { type: 'spring' as const, stiffness: 420, damping: 36, mass: 0.8 };
export const SPRING_SNAP = { type: 'spring' as const, stiffness: 500, damping: 38, mass: 0.75 };

export const DUR = {
  fast: 0.16,
  base: 0.26,
  slow: 0.36,
} as const;

/** Whole-page enter */
export const pageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.slow, ease: EASE_OUT },
};

/** Filter / tab panel swaps */
export const panelSwap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DUR.base, ease: EASE_PANEL },
};

export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.06 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
};
