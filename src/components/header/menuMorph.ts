// The phone menu's hamburger-to-rows choreography (hero, "Phone"). Each hamburger line is
// thrown into a block the size of its word, which drains into the word's bottom edge as the
// letters rise; closing mirrors it, top to bottom. Flight paths depend on measured word widths,
// so this runs on the Web Animations API instead of CSS keyframes.

export const MENU_MOTION = {
  open: {
    lineStagger: 60,
    fly: 500,
    hold: 20,
    drain: 300,
    letterDelay: 40,
    letterStagger: 35,
    letterRise: 520,
    xDelays: [260, 300],
    xDuration: 380,
    surface: 180,
  },
  close: {
    rowStagger: 50,
    letterStagger: 25,
    letterDrop: 260,
    blockDelay: 200,
    grow: 220,
    back: 440,
    x: 260,
    surface: 200,
  },
} as const;

/** Koulen's capitals, measured in the browser ("Touching rows"). */
const CAP_TOP = 0.108;
const CAP_HEIGHT = 0.717;

/** Fallbacks for the easing tokens in tokens.css, read at runtime when available. */
const EASE_FALLBACK = {
  throw: 'cubic-bezier(0.25, 1, 0.5, 1)',
  lift: 'cubic-bezier(0.76, 0, 0.24, 1)',
};

const PAPER = 'var(--mih-paper)';
const INK = 'var(--mih-ink)';
const LETTER_HIDDEN = 'translateY(0.8em)';
const LETTER_SHOWN = 'translateY(0)';
const X_FOLDED = 'rotate(0deg) scaleX(0)';
const xShown = (i: number) => `rotate(${i === 0 ? 45 : -45}deg) scaleX(1)`;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MenuParts {
  /** The hamburger's lines, top to bottom; one per link. */
  lines: HTMLElement[];
  /** One flying block per link: a fixed, 1px element with `transform-origin: 0 0`. */
  blocks: HTMLElement[];
  /** Each row's word (line-height: 1), containing its `[data-letter]` spans. */
  words: HTMLElement[];
  /** The menu's paper surface, faded in and out. */
  surface: HTMLElement;
  /** The X's two strokes. */
  xStrokes: [HTMLElement, HTMLElement];
}

/** The box of a word's capitals, given its line box's left, top, width, and font size. */
export function capBox(left: number, top: number, width: number, fontSize: number): Box {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { x: left, y: round(top + fontSize * CAP_TOP), w: width, h: round(fontSize * CAP_HEIGHT) };
}

/** Places and sizes a 1px, top-left-origin element over `box`. */
export function boxTransform({ x, y, w, h }: Box): string {
  return `translate(${x}px, ${y}px) scale(${w}, ${h})`;
}

const drained = (word: Box): Box => ({ ...word, y: word.y + word.h, h: 0 });

const toBox = (rect: DOMRect): Box => ({
  x: rect.left,
  y: rect.top,
  w: rect.width,
  h: rect.height,
});

function wordBox(word: HTMLElement): Box {
  const rect = word.getBoundingClientRect();
  return capBox(rect.left, rect.top, rect.width, parseFloat(getComputedStyle(word).fontSize));
}

function easings() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    throw: read('--ease-throw', EASE_FALLBACK.throw),
    lift: read('--ease-lift', EASE_FALLBACK.lift),
  };
}

function motionAllowed(): boolean {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return false;
  }
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/** Finds the parts by their data attributes: lines in the hamburger, the rest in the dialog. */
export function menuPartsIn(
  button: HTMLElement | null,
  dialog: HTMLElement | null,
): MenuParts | null {
  if (!button || !dialog) return null;
  const all = (root: HTMLElement, attribute: string) => [
    ...root.querySelectorAll<HTMLElement>(`[${attribute}]`),
  ];
  const surface = dialog.querySelector<HTMLElement>('[data-menu-surface]');
  const xStrokes = all(dialog, 'data-x-stroke');
  if (!surface || xStrokes.length !== 2) return null;
  return {
    lines: all(button, 'data-menu-line'),
    blocks: all(dialog, 'data-menu-block'),
    words: all(dialog, 'data-word'),
    surface,
    xStrokes: [xStrokes[0], xStrokes[1]],
  };
}

export interface MenuMorph {
  /** Plays the opening; call right after the dialog opens. */
  open(parts: MenuParts | null): void;
  /** Plays the closing and resolves when it has finished; close the dialog after it. */
  close(parts: MenuParts | null): Promise<void>;
  /** Stops any running motion (for example when a link is chosen). */
  cancel(): void;
}

export function createMenuMorph(): MenuMorph {
  let running: Animation[] = [];

  const cancel = () => {
    for (const animation of running) animation.cancel();
    running = [];
  };

  const run = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = el.animate(keyframes, { fill: 'both', ...options });
    running.push(animation);
    return animation;
  };

  return {
    cancel,

    open(parts) {
      cancel();
      if (!parts || !motionAllowed()) return;
      const ease = easings();
      const m = MENU_MOTION.open;
      const flight = m.fly + m.hold + m.drain;

      run(parts.surface, [{ opacity: 0 }, { opacity: 1 }], { duration: m.surface });
      parts.blocks.forEach((block, i) => {
        const line = parts.lines[i];
        const word = parts.words[i];
        if (!line || !word) return;
        const from = toBox(line.getBoundingClientRect());
        const to = wordBox(word);
        const delay = i * m.lineStagger;
        run(
          block,
          [
            { transform: boxTransform(from), backgroundColor: PAPER, easing: ease.throw },
            { transform: boxTransform(to), backgroundColor: INK, offset: m.fly / flight },
            {
              transform: boxTransform(to),
              backgroundColor: INK,
              offset: (m.fly + m.hold) / flight,
              easing: ease.lift,
            },
            { transform: boxTransform(drained(to)), backgroundColor: INK },
          ],
          { duration: flight, delay },
        );
        word.querySelectorAll('[data-letter]').forEach((letter, k) => {
          run(letter, [{ transform: LETTER_HIDDEN }, { transform: LETTER_SHOWN }], {
            duration: m.letterRise,
            delay: delay + m.fly + m.hold + m.letterDelay + k * m.letterStagger,
            easing: ease.throw,
          });
        });
      });
      parts.xStrokes.forEach((stroke, i) => {
        run(stroke, [{ transform: X_FOLDED }, { transform: xShown(i) }], {
          duration: m.xDuration,
          delay: m.xDelays[i],
          easing: ease.throw,
        });
      });
    },

    async close(parts) {
      cancel();
      if (!parts || !motionAllowed()) return;
      const ease = easings();
      const m = MENU_MOTION.close;
      const flight = m.grow + m.back;

      parts.blocks.forEach((block, i) => {
        const line = parts.lines[i];
        const word = parts.words[i];
        if (!line || !word) return;
        const home = toBox(line.getBoundingClientRect());
        const from = wordBox(word);
        const start = i * m.rowStagger;
        word.querySelectorAll('[data-letter]').forEach((letter, k) => {
          run(letter, [{ transform: LETTER_SHOWN }, { transform: LETTER_HIDDEN }], {
            duration: m.letterDrop,
            delay: start + k * m.letterStagger,
            easing: ease.lift,
          });
        });
        run(
          block,
          [
            { transform: boxTransform(drained(from)), backgroundColor: INK, easing: ease.lift },
            {
              transform: boxTransform(from),
              backgroundColor: INK,
              offset: m.grow / flight,
              easing: ease.lift,
            },
            { transform: boxTransform(home), backgroundColor: PAPER },
          ],
          { duration: flight, delay: start + m.blockDelay },
        );
      });
      parts.xStrokes.forEach((stroke, i) => {
        run(stroke, [{ transform: xShown(i) }, { transform: X_FOLDED }], {
          duration: m.x,
          easing: ease.lift,
        });
      });
      const last = (parts.blocks.length - 1) * m.rowStagger + m.blockDelay + flight;
      run(parts.surface, [{ opacity: 1 }, { opacity: 0 }], {
        duration: m.surface,
        delay: Math.max(0, last - m.surface),
      });

      await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    },
  };
}
