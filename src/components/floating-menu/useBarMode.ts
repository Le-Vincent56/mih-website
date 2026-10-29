import { type RefObject, useEffect, useState } from 'react';
import { type Mode, nextBarMode } from './barState';
import { circleLift } from './ripple';

/** The letterbox bar's height: the zone ends where its bottom edge passes the bar's. */
const BAR_HEIGHT = 56;

/** The scroll position where the page's `[data-bar-zone]` has passed under the bar, or null. */
function zoneEnd(): number | null {
  const zone = document.querySelector('[data-bar-zone]');
  return zone ? zone.getBoundingClientRect().bottom + window.scrollY - BAR_HEIGHT : null;
}

/**
 * Bar or circle. Decides on every scroll and resize, on every
 * route change (`routeKey`), and again when `frozen` (the menu is open) is lifted.
 */
export function useBarMode(frozen: boolean, routeKey: string): Mode {
  const [mode, setMode] = useState<Mode>('bar');

  useEffect(() => {
    const update = () => setMode((m) => nextBarMode(m, window.scrollY, zoneEnd(), frozen));
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [frozen, routeKey]);

  return mode;
}

/** Keeps the circle above the footer (`[data-floor]`) by writing `--lift` on scroll and resize. */
export function useCircleLift(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const update = () => {
      const floor = document.querySelector('[data-floor]');
      const top = floor ? floor.getBoundingClientRect().top : null;
      ref.current?.style.setProperty('--lift', `${circleLift(window.innerHeight, top)}px`);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [ref]);
}
