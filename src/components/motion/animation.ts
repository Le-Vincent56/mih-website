// Shared Web Animations helpers for the section controllers (projects, crew).

export interface Timing {
  duration: number;
  delay: number;
  easing: string;
}

/** Fallbacks for the easing tokens in tokens.css, read at runtime when available. */
const EASE_FALLBACK = {
  throw: 'cubic-bezier(0.25, 1, 0.5, 1)',
  lift: 'cubic-bezier(0.76, 0, 0.24, 1)',
};

export function easings() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    throw: read('--ease-throw', EASE_FALLBACK.throw),
    lift: read('--ease-lift', EASE_FALLBACK.lift),
  };
}

export const shifted = (percent: number): Keyframe => ({ transform: `translateY(${percent}%)` });

// Keyframe keys that describe the frame rather than a CSS property.
const FRAME_KEYS = new Set(['offset', 'easing', 'composite']);

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Writes a keyframe's properties (transform, opacity, clipPath, …) to the element's inline style. */
export function write(el: HTMLElement, frame: Keyframe): void {
  for (const [name, value] of Object.entries(frame)) {
    if (FRAME_KEYS.has(name) || value === undefined || value === null) continue;
    el.style.setProperty(kebab(name), String(value));
  }
}

export interface Runner {
  /** One animation with its last frame committed inline; it's cancelled once finished. */
  play(el: HTMLElement, frames: Keyframe[], timing: Timing): Animation;
  /** `play` with two frames. */
  run(el: HTMLElement, from: Keyframe, to: Keyframe, timing: Timing): Animation;
  /** The animations still running. */
  readonly running: ReadonlySet<Animation>;
  cancelAll(): void;
}

export function createRunner(): Runner {
  const running = new Set<Animation>();
  const play = (el: HTMLElement, frames: Keyframe[], timing: Timing) => {
    write(el, frames[frames.length - 1]);
    const animation = el.animate(frames, { fill: 'both', ...timing });
    running.add(animation);
    animation.finished.then(
      () => {
        running.delete(animation);
        animation.cancel();
      },
      () => running.delete(animation),
    );
    return animation;
  };
  return {
    running,
    play,
    run: (el, from, to, timing) => play(el, [from, to], timing),
    cancelAll() {
      for (const animation of running) animation.cancel();
      running.clear();
    },
  };
}

/** Resolves once every animation has finished or been cancelled. */
export const settle = (animations: Iterable<Animation>) =>
  Promise.all([...animations].map((animation) => animation.finished.catch(() => undefined)));
