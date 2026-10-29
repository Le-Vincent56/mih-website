import { type RefObject, useEffect } from 'react';
import { clamp01 } from './motion';
import { type StageClasses, createStage } from './stage';
import { type Station, withExit } from './stations';

// Drives the studio intro's stage from the scroll. Runs only
// under the motion gate (html.mih-motion) and without reduced motion, and draws frames only
// while the section is on screen.
export function useStudioMotion(
  sectionRef: RefObject<HTMLElement | null>,
  frameRef: RefObject<HTMLElement | null>,
  stations: Station[],
  classes: StageClasses,
): void {
  useEffect(() => {
    const section = sectionRef.current;
    const frame = frameRef.current;
    if (!section || !frame) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let stop: (() => void) | undefined;
    const html = document.documentElement;

    const start = () => {
      // The stage ends on the exit, so the frame lets go on paper (section handovers).
      const stage = createStage(frame, withExit(stations), classes);
      const progress = () => {
        const rect = section.getBoundingClientRect();
        return clamp01(-rect.top / (rect.height - window.innerHeight));
      };

      let active = true;
      let visible = false;
      let frameId = 0;
      let last = progress();
      let direction: 1 | -1 = 1;
      let lastTime = performance.now();

      const tick = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const p = progress();
        if (p !== last) {
          direction = p > last ? 1 : -1;
          last = p;
        }
        stage.render(p, direction, dt);
        frameId = visible ? requestAnimationFrame(tick) : 0;
      };
      const redraw = () => {
        stage.remeasure();
        stage.render(progress(), direction, 0);
      };

      stage.render(last, direction, 0);
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !frameId) {
          lastTime = performance.now();
          frameId = requestAnimationFrame(tick);
        }
      });
      observer.observe(section);
      document.fonts?.ready.then(() => active && redraw());
      window.addEventListener('resize', redraw);

      stop = () => {
        active = false;
        if (frameId) cancelAnimationFrame(frameId);
        observer.disconnect();
        window.removeEventListener('resize', redraw);
        stage.destroy();
      };
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
  }, [sectionRef, frameRef, stations, classes]);
}
