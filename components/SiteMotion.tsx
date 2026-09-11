'use client';

import { useEffect } from 'react';
import { animate, MotionConfig, useReducedMotion } from 'framer-motion';

const targets = '.kiosk-card, .download-hero, .download-card, .download-person, .download-item, .admin-panel, .admin-stat-card, .admin-campaign-card, .admin-provider-card';

export default function SiteMotion({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const seen = new WeakSet<Element>();
    const running = new Set<ReturnType<typeof animate>>();
    const reveal = (root: ParentNode) => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>(targets));
      if (root instanceof HTMLElement && root.matches(targets)) elements.unshift(root);
      elements.filter((element) => !seen.has(element)).forEach((element, index) => {
        seen.add(element);
        const animation = animate(element, { opacity: [0, 1] }, {
          duration: 0.35,
          delay: Math.min(index * 0.045, 0.2),
          ease: 'easeOut',
        });
        running.add(animation);
        animation.then(() => running.delete(animation));
      });
    };
    reveal(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) reveal(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      running.forEach((animation) => animation.stop());
    };
  }, [reducedMotion]);

  return <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: 'easeOut' }}>{children}</MotionConfig>;
}
