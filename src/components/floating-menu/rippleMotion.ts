// The ripple menu's motion.
// Opening floods the screen from the hub and swings the rings in; closing swings them out and
// drains the flood into the circle, which may have moved if the page jumped in between. Resting
// styles are the open menu (FloatingMenu.module.css), which is what reduced motion shows.

import { easings } from '../motion/animation';
import { type Point, floodRadius } from './ripple';

export const RIPPLE_MOTION = {
  flood: 650,
  ring: 650,
  ringDelay: 200,
  ringStagger: 55,
  /** Rings swing in from, and out to, this turn around the hub. */
  ringTurn: -22,
  disc: 250,
  mark: 320,
  strokeDelays: [60, 110],
  strokes: 320,
  ringsOut: 280,
  chosenLingers: 80,
  drain: 420,
  glide: 300,
} as const;

export interface RippleParts {
  /** The ink layer filling the dialog. */
  flood: HTMLElement;
  /** One group per ring, outermost first, each with `transform-origin` at the hub. */
  rings: SVGElement[];
  /** The circle's copy inside the dialog: the X. */
  close: HTMLElement;
  closeMark: HTMLElement;
  strokes: [HTMLElement, HTMLElement];
}

export interface CloseOptions {
  /** The hub the menu opened around. */
  hub: Point;
  /** The chosen ring's index, which leaves last. */
  chosen?: number;
  /** Runs once the rings are gone, under the full flood (the jump). */
  between?: () => Promise<void>;
  /** The real circle's rect after `between`, for the X to glide to and the flood to drain into. */
  target: () => Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null;
}

export const floodClip = (radius: number, { x, y }: Point) =>
  `circle(${radius}px at ${x}px ${y}px)`;

const RINGS_IN: Keyframe = { transform: 'none', opacity: 1 };
const ringsAway = (): Keyframe => ({
  transform: `rotate(${RIPPLE_MOTION.ringTurn}deg)`,
  opacity: 0,
});
const MARK_SHOWN: Keyframe = { transform: 'none', opacity: 1 };
const MARK_GONE: Keyframe = { transform: 'rotate(-90deg) scale(0.4)', opacity: 0 };
const STROKE_FOLDED: Keyframe = { transform: 'rotate(0deg) scaleX(0)' };
const strokeShown = (i: number): Keyframe => ({
  transform: `rotate(${i === 0 ? 45 : -45}deg) scaleX(1)`,
});

/** Finds the parts by their data attributes. */
export function ripplePartsIn(dialog: HTMLElement | null): RippleParts | null {
  if (!dialog) return null;
  const one = (attribute: string) => dialog.querySelector<HTMLElement>(`[${attribute}]`);
  const flood = one('data-ripple-flood');
  const close = one('data-ripple-close');
  const closeMark = one('data-ripple-mark');
  const strokes = [...dialog.querySelectorAll<HTMLElement>('[data-ripple-stroke]')];
  if (!flood || !close || !closeMark || strokes.length !== 2) return null;
  return {
    flood,
    rings: [...dialog.querySelectorAll<SVGElement>('[data-ripple-ring]')],
    close,
    closeMark,
    strokes: [strokes[0], strokes[1]],
  };
}

function motionAllowed(): boolean {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return false;
  }
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/** An element's current look for `properties`, so a close can start mid-opening. */
function now(el: Element, properties: string[]): Keyframe {
  const style = getComputedStyle(el);
  return Object.fromEntries(
    properties.map((name) => [
      name,
      style.getPropertyValue(name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)),
    ]),
  ) as Keyframe;
}

export interface RippleMotion {
  /** Plays the opening; call right after the dialog opens. `flood` is the full radius. */
  open(parts: RippleParts | null, hub: Point, flood: number): void;
  /** Plays the closing (with the jump in between, if any); close the dialog after it. */
  close(parts: RippleParts | null, options: CloseOptions): Promise<void>;
  cancel(): void;
}

export function createRippleMotion(): RippleMotion {
  let running: Animation[] = [];

  const run = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = el.animate(keyframes, { fill: 'both', ...options });
    running.push(animation);
    return animation;
  };

  const settle = (animations: Animation[]) =>
    Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));

  const cancel = () => {
    for (const animation of running) animation.cancel();
    running = [];
  };

  return {
    cancel,

    open(parts, hub, flood) {
      cancel();
      if (!parts || !motionAllowed()) return;
      const ease = easings();
      const m = RIPPLE_MOTION;

      run(parts.flood, [{ clipPath: floodClip(0, hub) }, { clipPath: floodClip(flood, hub) }], {
        duration: m.flood,
        easing: ease.lift,
      });
      const last = parts.rings.length - 1;
      parts.rings.forEach((ring, i) => {
        run(ring, [ringsAway(), RINGS_IN], {
          duration: m.ring,
          delay: m.ringDelay + (last - i) * m.ringStagger,
          easing: ease.throw,
        });
      });
      run(
        parts.close,
        [{ backgroundColor: 'var(--mih-ink)' }, { backgroundColor: 'var(--mih-paper)' }],
        { duration: m.disc, easing: ease.throw },
      );
      run(parts.closeMark, [MARK_SHOWN, MARK_GONE], { duration: m.mark, easing: ease.throw });
      parts.strokes.forEach((stroke, i) => {
        run(stroke, [STROKE_FOLDED, strokeShown(i)], {
          duration: m.strokes,
          delay: m.strokeDelays[i],
          easing: ease.throw,
        });
      });
    },

    async close(parts, { hub, chosen, between, target }) {
      if (!parts || !motionAllowed()) {
        cancel();
        await between?.();
        return;
      }
      const ease = easings();
      const m = RIPPLE_MOTION;

      // 1. Rings out, from wherever they are; the chosen one leaves last.
      const from = parts.rings.map((ring) => now(ring, ['transform', 'opacity']));
      const flood = now(parts.flood, ['clipPath']);
      cancel();
      const out = parts.rings.map((ring, i) =>
        run(ring, [from[i], ringsAway()], {
          duration: m.ringsOut,
          delay: i === chosen ? m.chosenLingers : 0,
          easing: ease.lift,
        }),
      );
      // Hold the flood and the X as they are while the rings leave.
      run(parts.flood, [flood, flood], { duration: 1 });
      await settle(out);

      // 2. The jump, under the ink.
      await between?.();

      // 3. Drain into the circle, wherever it is now; the X glides there and turns back.
      const closeRect = parts.close.getBoundingClientRect();
      const to = target() ?? closeRect;
      const dx = to.left - closeRect.left;
      const dy = to.top - closeRect.top;
      const end = { x: hub.x + dx, y: hub.y + dy };
      const full = floodClip(floodRadius(end, window.innerWidth, window.innerHeight), end);
      const drain = [
        run(parts.flood, [between ? { clipPath: full } : flood, { clipPath: floodClip(0, end) }], {
          duration: m.drain,
          easing: ease.lift,
        }),
        run(parts.close, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px)` }], {
          duration: m.glide,
          easing: ease.throw,
        }),
        run(
          parts.close,
          [{ backgroundColor: 'var(--mih-paper)' }, { backgroundColor: 'var(--mih-ink)' }],
          { duration: m.disc, delay: m.drain - m.disc, easing: ease.throw },
        ),
        run(parts.closeMark, [MARK_GONE, MARK_SHOWN], {
          duration: m.mark,
          delay: m.drain - m.mark,
          easing: ease.throw,
        }),
        ...parts.strokes.map((stroke, i) =>
          run(stroke, [strokeShown(i), STROKE_FOLDED], { duration: m.strokes, easing: ease.lift }),
        ),
      ];
      await settle(drain);
    },
  };
}
