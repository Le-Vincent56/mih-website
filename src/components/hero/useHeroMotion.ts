import { type RefObject, useEffect } from 'react';
import { boostedRate, decayRate, driftDuration } from '../../motion/drift';
import { isDriftPaused } from '../../motion/driftPause';
import { heroExit } from './exit';

// The hero's runtime motion state (hero, "Drift"); the motion itself is CSS.
// Expects the hero root to contain:
//   [data-half]        one of a row strip's two identical halves (measured for the loop length)
//   [data-drift-layer] each element whose only animation is the drift loop
export function useHeroMotion(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let active = true;

    // Loop length: one half-strip at the drift speed, re-measured when the viewport changes.
    const measure = () => {
      const half = root.querySelector<HTMLElement>('[data-half]');
      if (!half) return;
      const seconds = driftDuration(half.getBoundingClientRect().width);
      root.style.setProperty('--drift-duration', `${seconds}s`);
    };
    (document.fonts?.ready ?? Promise.resolve()).then(() => active && measure());
    window.addEventListener('resize', measure);

    // Sleep off screen: CSS pauses the drift while data-asleep is set.
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) delete root.dataset.asleep;
            else root.dataset.asleep = '';
          });
    observer?.observe(root);

    // Scroll boost: speed the drift up with scroll speed, then ease back to normal.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let rate = 1;
    let frame = 0;
    let lastY = window.scrollY;
    let lastScroll = performance.now();
    let lastFrame = lastScroll;

    const apply = (value: number) => {
      for (const layer of root.querySelectorAll<HTMLElement>('[data-drift-layer]')) {
        for (const animation of layer.getAnimations?.() ?? []) animation.playbackRate = value;
      }
    };

    const tick = (now: number) => {
      rate = decayRate(rate, (now - lastFrame) / 1000);
      lastFrame = now;
      if (rate < 1.001) {
        rate = 1;
        frame = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
      apply(rate);
    };

    // Exit: CSS sinks the crew and fades the rows by --hero-exit (hero, "Exit").
    const writeExit = () => {
      const rect = root.getBoundingClientRect();
      root.style.setProperty('--hero-exit', String(heroExit(rect.top, rect.height)));
    };

    const onScroll = () => {
      writeExit();
      const now = performance.now();
      const seconds = Math.max((now - lastScroll) / 1000, 1 / 120);
      const speed = (window.scrollY - lastY) / seconds;
      lastY = window.scrollY;
      lastScroll = now;
      if (isDriftPaused() || 'asleep' in root.dataset) return;
      rate = Math.max(rate, boostedRate(speed));
      if (!frame) {
        lastFrame = now;
        frame = requestAnimationFrame(tick);
      }
    };

    if (!reduced) {
      writeExit();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      active = false;
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      apply(1);
      root.style.removeProperty('--hero-exit');
    };
  }, [rootRef]);
}
