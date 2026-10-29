import { type RefObject, useEffect } from 'react';
import { attachHoverFill } from '../projects/hoverFill';

// The outlined capsule buttons' radial hover fill: every
// [data-hover-fill] inside the root gets the fill on its [data-ink]. Mouse and pen only, and not
// under reduced motion.
export function useHoverFills(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    const detach = [...root.querySelectorAll<HTMLElement>('[data-hover-fill]')].flatMap(
      (button) => {
        const ink = button.querySelector<HTMLElement>('[data-ink]');
        return ink ? [attachHoverFill(button, ink)] : [];
      },
    );
    return () => detach.forEach((stop) => stop());
  }, [rootRef]);
}
