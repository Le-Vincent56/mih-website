import { type RefObject, useEffect } from 'react';
import { clamp01 } from './motion';
import { advance, directionOf, progressOf, targetStation } from './playback';
import { type StageClasses, createStage } from './stage';
import { type Station, withExit } from './stations';

// Drives the studio intro's stage: the scroll picks a station, and each frame plays toward it
// in time (playback.ts), so a mouse wheel's jumps look as smooth as a trackpad. Runs only
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
      const sequence = withExit(stations);
      const stage = createStage(frame, sequence, classes);
      const count = sequence.length;
      const progress = () => {
        const rect = section.getBoundingClientRect();
        return clamp01(-rect.top / (rect.height - window.innerHeight));
      };

      let active = true;
      let visible = false;
      let frameId = 0;
      let last = progress();
      let target = targetStation(last, last, count, 0);
      let played = target;
      let direction: 1 | -1 = 1;
      let lastTime = performance.now();

      const draw = (dt: number) => stage.render(progressOf(played, count), direction, dt);
      const tick = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const p = progress();
        target = targetStation(last, p, count, target);
        last = p;
        // Once the frame starts to let go, the exit finishes at once so it leaves on paper.
        const next = p >= 1 ? target : advance(played, target, dt);
        direction = directionOf(played, next, direction);
        played = next;
        draw(dt);
        frameId = visible ? requestAnimationFrame(tick) : 0;
      };
      const redraw = () => {
        stage.remeasure();
        draw(0);
      };

      draw(0);
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !visible) {
          // Nothing played while off screen: start on the station the scroll is on.
          const p = progress();
          target = targetStation(last, p, count, target);
          last = p;
          played = target;
          // An endless time step lets the tug's chain settle, so no words are left mid-slide.
          draw(Infinity);
        }
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
