'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';

interface MotionStepProps {
  stepKey: string;
  children: ReactNode;
}

export function MotionStep({ stepKey, children }: MotionStepProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        className="motion-step"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.99 }}
        transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function MotionLogo({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="kiosk-logo"
      initial={reduceMotion ? false : { opacity: 0, y: -12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, -4, 0] }}
      transition={reduceMotion
        ? { duration: 0.15 }
        : { opacity: { duration: 0.35 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
    >
      {children}
    </motion.div>
  );
}
