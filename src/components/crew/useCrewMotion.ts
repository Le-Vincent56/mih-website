import { type RefObject, useEffect } from 'react';
import { createCrewSelect } from './crewSelect';

// Runs the crew section. It starts under the motion
// gate (html.mih-motion, once Koulen has loaded, so the names measure correctly), with or without
// reduced motion: the select screen is how the content is reached, so reduced motion only turns
// the animations off.
export function useCrewMotion(sectionRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let stop: (() => void) | undefined;
    const html = document.documentElement;
    const start = () => {
      const controller = createCrewSelect(section, { reduced });
      stop = () => controller.destroy();
    };

    // The gate adds mih-motion once Koulen loads (up to 1.5s), possibly after this mounts.
    let gate: MutationObserver | undefined;
    if (html.classList.contains('mih-motion')) start();
    else {
      gate = new MutationObserver(() => {
        if (!html.classList.contains('mih-motion')) return;
        gate?.disconnect();
        start();
      });
      gate.observe(html, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      gate?.disconnect();
      stop?.();
    };
  }, [sectionRef]);
}
