// The bar-to-circle swap: lift and rise. The bar slides up off
// the top while the circle rises from below the bottom edge; nothing crosses the page. One
// timeline with offsets rather than delays, so a reversal mid-way mirrors it exactly.
// html[data-bar-swap] is set while it plays, which keeps both visible (Header.module.css,
// FloatingMenu.module.css).

import { easings } from '../motion/animation';
import type { Mode } from './barState';

export const BAR_SWAP = {
  duration: 720,
  /** The bar is gone by here. */
  barLifted: 320,
  /** The circle starts rising here. */
  circleFrom: 120,
} as const;

export interface BarParts {
  bar: HTMLElement;
  circle: HTMLElement;
}

/** The bar's and circle's keyframes toward the circle; `distance` is how far below it starts. */
export function swapFrames(distance: number, ease: { throw: string; lift: string }) {
  const { duration, barLifted, circleFrom } = BAR_SWAP;
  const below = `translateY(${distance}px)`;
  return {
    bar: [
      { transform: 'none', offset: 0, easing: ease.throw },
      { transform: 'translateY(-100%)', offset: barLifted / duration },
      { transform: 'translateY(-100%)', offset: 1 },
    ],
    circle: [
      { transform: below, offset: 0 },
      { transform: below, offset: circleFrom / duration, easing: ease.lift },
      { transform: 'none', offset: 1 },
    ],
  };
}

export function barPartsIn(bar: HTMLElement | null, circle: HTMLElement | null): BarParts | null {
  return bar && circle ? { bar, circle } : null;
}

function motionAllowed(): boolean {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return false;
  }
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

export interface BarMorph {
  /** Swaps toward `to`; resolves once it lands there (also after a reversal). */
  fly(to: Mode, parts: BarParts | null): Promise<void>;
  cancel(): void;
}

export function createBarMorph(): BarMorph {
  let swap: { to: Mode; animations: Animation[]; landed: Promise<void> } | null = null;
  // Where it rests between swaps; the page starts with the bar.
  let at: Mode = 'bar';
  // Read lazily: the morph is created during prerendering, where there's no document.
  const flag = () => document.documentElement.dataset;

  const cancel = () => {
    swap?.animations.forEach((animation) => animation.cancel());
    swap = null;
    delete flag().barSwap;
  };

  return {
    cancel,

    fly(to, parts) {
      if (swap) {
        if (swap.to !== to) {
          swap.to = to;
          swap.animations.forEach((animation) => animation.reverse());
        }
        return swap.landed;
      }
      if (to === at) return Promise.resolve();
      if (!parts || !motionAllowed()) {
        at = to;
        return Promise.resolve();
      }

      // From just below the screen's bottom edge, wherever the circle is parked.
      const distance = window.innerHeight - parts.circle.getBoundingClientRect().top;
      const frames = swapFrames(distance, easings());
      const timing: KeyframeAnimationOptions = {
        duration: BAR_SWAP.duration,
        fill: 'both',
        direction: to === 'circle' ? 'normal' : 'reverse',
      };
      const animations = [
        parts.bar.animate(frames.bar, timing),
        parts.circle.animate(frames.circle, timing),
      ];
      flag().barSwap = '';
      const current = {
        to,
        animations,
        landed: Promise.all(animations.map((a) => a.finished)).then(
          () => {
            if (swap !== current) return;
            at = current.to;
            cancel();
          },
          () => undefined,
        ),
      };
      swap = current;
      return current.landed;
    },
  };
}
