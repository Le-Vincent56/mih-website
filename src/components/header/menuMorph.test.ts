// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  MENU_MOTION,
  type MenuParts,
  boxTransform,
  capBox,
  createMenuMorph,
  menuPartsIn,
} from './menuMorph';

// jsdom has no Web Animations or matchMedia: record every animate() call instead.
interface Call {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
}
let calls: Call[] = [];

function stubAnimate() {
  calls = [];
  Element.prototype.animate = function (this: Element, keyframes, options) {
    const cancel = vi.fn();
    calls.push({
      el: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
      cancel,
    });
    return { cancel, finished: Promise.resolve(), playbackRate: 1 } as unknown as Animation;
  };
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }));
}

const rect = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
  el.getBoundingClientRect = () => ({ left: x, top: y, width: w, height: h }) as DOMRect;
  return el;
};

// Two links: lines at the icon, words down the page, two letters each, font size 100px.
function makeParts(): MenuParts {
  const lines = [0, 1].map((i) => rect(document.createElement('span'), 330, 20 + i * 6, 22, 2.5));
  const blocks = [0, 1].map(() => document.createElement('span'));
  const words = [0, 1].map((i) => {
    const word = rect(document.createElement('span'), 16, 100 + i * 100, 300, 100);
    word.style.fontSize = '100px';
    for (const letter of 'AB') {
      const span = document.createElement('span');
      span.dataset.letter = '';
      span.textContent = letter;
      word.append(span);
    }
    return word;
  });
  const surface = document.createElement('div');
  const xStrokes = [document.createElement('span'), document.createElement('span')] as [
    HTMLElement,
    HTMLElement,
  ];
  return { lines, blocks, words, surface, xStrokes };
}

const callsOn = (el: Element) => calls.filter((call) => call.el === el);
const delayOf = (call: Call) => call.options.delay;

beforeEach(() => {
  stubAnimate();
  stubReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error restore jsdom's missing API
  delete Element.prototype.animate;
});

describe('capBox', () => {
  test("covers a word's Koulen capitals within its line box", () => {
    expect(capBox(16, 100, 300, 100)).toEqual({ x: 16, y: 110.8, w: 300, h: 71.7 });
  });

  test('maps to a translate-and-scale transform of a 1px element', () => {
    expect(boxTransform({ x: 1, y: 2, w: 3, h: 4 })).toBe('translate(1px, 2px) scale(3, 4)');
  });
});

describe('opening', () => {
  test('throws each line, top to bottom, into a block the size of its word, then drains it', () => {
    const parts = makeParts();
    createMenuMorph().open(parts);
    parts.blocks.forEach((block, i) => {
      const [flight] = callsOn(block);
      expect(delayOf(flight)).toBe(i * MENU_MOTION.open.lineStagger);
      const first = flight.keyframes[0];
      const last = flight.keyframes[flight.keyframes.length - 1];
      expect(first.transform).toBe(boxTransform({ x: 330, y: 20 + i * 6, w: 22, h: 2.5 }));
      expect(first.backgroundColor).toBe('var(--mih-paper)');
      const word = capBox(16, 100 + i * 100, 300, 100);
      expect(flight.keyframes.map((frame) => frame.transform)).toContain(boxTransform(word));
      expect(last.transform).toBe(boxTransform({ ...word, y: word.y + word.h, h: 0 }));
      expect(last.backgroundColor).toBe('var(--mih-ink)');
    });
  });

  test("raises each word's letters one by one out of its bottom edge as the block drains", () => {
    const parts = makeParts();
    createMenuMorph().open(parts);
    const { lineStagger, fly, hold, letterDelay, letterStagger, letterRise } = MENU_MOTION.open;
    parts.words.forEach((word, i) => {
      const letters = [...word.querySelectorAll('[data-letter]')];
      letters.forEach((letter, k) => {
        const [rise] = callsOn(letter);
        expect(delayOf(rise)).toBe(i * lineStagger + fly + hold + letterDelay + k * letterStagger);
        expect(rise.options.duration).toBe(letterRise);
        expect(rise.keyframes[0].transform).toBe('translateY(0.8em)');
      });
    });
  });

  test('folds the X in and fades the surface in', () => {
    const parts = makeParts();
    createMenuMorph().open(parts);
    expect(parts.xStrokes.map((stroke) => delayOf(callsOn(stroke)[0]))).toEqual(
      MENU_MOTION.open.xDelays,
    );
    expect(callsOn(parts.surface)).toHaveLength(1);
  });

  test('cancels whatever was still running', () => {
    const parts = makeParts();
    const morph = createMenuMorph();
    morph.open(parts);
    const first = [...calls];
    morph.open(parts);
    for (const call of first) expect(call.cancel).toHaveBeenCalled();
  });
});

describe('closing', () => {
  test('mirrors the opening top to bottom: letters drop, then blocks fly home', async () => {
    const parts = makeParts();
    await createMenuMorph().close(parts);
    const { rowStagger, letterStagger, blockDelay } = MENU_MOTION.close;
    parts.words.forEach((word, i) => {
      const letters = [...word.querySelectorAll('[data-letter]')];
      expect(letters.map((letter) => delayOf(callsOn(letter)[0]))).toEqual(
        letters.map((_, k) => i * rowStagger + k * letterStagger),
      );
      const [flight] = callsOn(parts.blocks[i]);
      expect(delayOf(flight)).toBe(i * rowStagger + blockDelay);
      const last = flight.keyframes[flight.keyframes.length - 1];
      expect(last.transform).toBe(boxTransform({ x: 330, y: 20 + i * 6, w: 22, h: 2.5 }));
      expect(last.backgroundColor).toBe('var(--mih-paper)');
    });
  });

  test('resolves only after every animation has finished', async () => {
    const parts = makeParts();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    Element.prototype.animate = function () {
      return { cancel() {}, finished: gate, playbackRate: 1 } as unknown as Animation;
    };
    let done = false;
    const closing = createMenuMorph()
      .close(parts)
      .then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await closing;
    expect(done).toBe(true);
  });
});

describe('without motion', () => {
  test('does nothing under reduced motion, and closing resolves at once', async () => {
    stubReducedMotion(true);
    const parts = makeParts();
    const morph = createMenuMorph();
    morph.open(parts);
    await morph.close(parts);
    expect(calls).toHaveLength(0);
  });

  test('does nothing when the browser lacks Web Animations', async () => {
    // @ts-expect-error simulate a browser without Element.animate
    delete Element.prototype.animate;
    const parts = makeParts();
    const morph = createMenuMorph();
    morph.open(parts);
    await expect(morph.close(parts)).resolves.toBeUndefined();
  });

  test('does nothing when the parts are not mounted', async () => {
    const morph = createMenuMorph();
    morph.open(null);
    await morph.close(null);
    expect(calls).toHaveLength(0);
  });
});

describe('menuPartsIn', () => {
  test('collects the parts from the hamburger button and the dialog by their data attributes', () => {
    const button = document.createElement('button');
    button.innerHTML = '<span data-menu-line></span><span data-menu-line></span>';
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <div data-menu-surface></div>
      <span data-x-stroke></span><span data-x-stroke></span>
      <span data-word></span><span data-word></span>
      <span data-menu-block></span><span data-menu-block></span>`;
    const parts = menuPartsIn(button, dialog)!;
    expect([parts.lines.length, parts.words.length, parts.blocks.length]).toEqual([2, 2, 2]);
    expect(parts.surface.hasAttribute('data-menu-surface')).toBe(true);
    expect(parts.xStrokes).toHaveLength(2);
  });

  test('is null until both are mounted, or when a part is missing', () => {
    expect(menuPartsIn(null, null)).toBeNull();
    expect(
      menuPartsIn(document.createElement('button'), document.createElement('dialog')),
    ).toBeNull();
  });
});
