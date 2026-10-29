// The studio intro's animated layer: builds the title slots, the VALUES label, hidden measuring paragraphs,
// and the current transition's words inside the frame, then draws a frame for a scroll progress. Everything
// numeric comes from stations.ts, motion.ts, and pairing.ts.
import {
  type Rgb,
  clamp01,
  easeLift,
  labelWindow,
  mixRgb,
  rollOffsets,
  segment,
  slideTitleWindow,
  swapWindow,
  wordLetterWindow,
} from './motion';
import { type Traveler, type WordBox, chainStep, groupLines, lagOf, pairLines } from './pairing';
import { type Align, type Station, kindOf, locate } from './stations';

export interface StageClasses {
  title: string;
  slot: string;
  label: string;
  measure: string;
  word: string;
  letter: string;
}

export interface Stage {
  render(p: number, direction: 1 | -1, dt: number): void;
  remeasure(): void;
  destroy(): void;
}

/** Koulen's capitals, measured in the browser. */
const CAP_HEIGHT = 0.717;
/** The title's size cap, as a share of the frame height. */
const MAX_TITLE_SHARE = 0.3;
const LABEL_LENGTH = 6;
const ALIGN_RANK: Record<Align, number> = { left: 0, center: 1, right: 2 };

interface Slot {
  el: HTMLElement;
  old: HTMLElement;
  next: HTMLElement;
}

interface SlideWord extends Traveler {
  el: HTMLElement;
  letters: HTMLElement[];
  v: number;
}

interface SwapLetter {
  el: HTMLElement;
  u: number;
  outgoing: boolean;
}

const span = (className = '', parent?: HTMLElement): HTMLElement => {
  const el = document.createElement('span');
  if (className) el.className = className;
  parent?.append(el);
  return el;
};

const translate = (el: HTMLElement, percent: number) => {
  el.style.transform = `translateY(${percent}%)`;
};

function parseColor(value: string): Rgb {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value.trim());
  if (hex) return [1, 2, 3].map((i) => parseInt(hex[i], 16)) as Rgb;
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  return rgb ? ([1, 2, 3].map((i) => Number(rgb[i])) as Rgb) : [0, 0, 0];
}

export function createStage(root: HTMLElement, stations: Station[], classes: StageClasses): Stage {
  const layer = document.createElement('div');
  root.append(layer);

  // Hidden paragraphs, one per station, whose word boxes are where words travel to and from.
  const measures = stations.map((station, s) => {
    const p = document.createElement('p');
    p.className = classes.measure;
    p.dataset.align = station.align;
    p.dataset.station = String(s);
    station.text.split(' ').forEach((word, i) => {
      if (i > 0) p.append(' ');
      const box = span('', p);
      box.dataset.i = String(i);
      box.textContent = word;
    });
    layer.append(p);
    return p;
  });

  const title = document.createElement('div');
  title.className = classes.title;
  layer.append(title);
  const slotCount = Math.max(...stations.map((s) => s.title.length));
  const slots: Slot[] = Array.from({ length: slotCount }, () => {
    const el = span(classes.slot, title);
    return { el, old: span('', el), next: span('', el) };
  });

  const label = document.createElement('div');
  label.className = classes.label;
  layer.append(label);
  const labelLetters = Array.from({ length: LABEL_LENGTH }, () => span('', span('', label)));

  const words = document.createElement('div');
  layer.append(words);

  const colors = stations.map((s) => [s.background, s.foreground].map(resolve) as [Rgb, Rgb]);
  function resolve(css: string): Rgb {
    const name = /var\((--[\w-]+)\)/.exec(css)?.[1];
    return parseColor(name ? getComputedStyle(root).getPropertyValue(name) : css);
  }

  const context = document.createElement('canvas').getContext('2d');
  const textWidth = (text: string, font: string) => {
    if (!text) return 0;
    if (!context) return text.length * 0.5 * parseFloat(font);
    context.font = font;
    return context.measureText(text).width;
  };

  let frameWidth = 0;
  let margin = 0;
  let titleFont = '';
  let titleWidths: number[] = [];
  let lines: WordBox[][][] = [];
  let built = -1;
  let slideWords: SlideWord[] = [];
  let swapLetters: SwapLetter[] = [];

  function measure() {
    const frame = root.getBoundingClientRect();
    frameWidth = frame.width;
    margin = measures[0].getBoundingClientRect().left - frame.left;
    const longest = Math.max(...stations.map((s) => textWidth(s.title, '100px Koulen')));
    const size = Math.min(
      ((frameWidth - 2 * margin) / longest) * 100,
      MAX_TITLE_SHARE * frame.height,
    );
    titleFont = `${size}px Koulen`;
    title.style.fontSize = `${size}px`;
    title.style.height = `${size * CAP_HEIGHT}px`;
    root.style.setProperty('--studio-title-height', `${size * CAP_HEIGHT}px`);
    // The tallest paragraph sets the block's height, so every station sits at one centered spot.
    const textHeight = Math.max(...measures.map((p) => p.getBoundingClientRect().height));
    root.style.setProperty('--studio-text-height', `${textHeight}px`);
    titleWidths = stations.map((s) =>
      [...s.title].reduce((w, c) => w + textWidth(c, titleFont), 0),
    );
    lines = measures.map((p) =>
      groupLines(
        [...p.children].map((el) => {
          const r = el.getBoundingClientRect();
          return { text: el.textContent ?? '', x: r.left - frame.left, y: r.top - frame.top };
        }),
      ),
    );
    built = -1;
  }

  const alignedX = (align: Align, width: number) =>
    align === 'left'
      ? margin
      : align === 'right'
        ? frameWidth - margin - width
        : (frameWidth - width) / 2;

  function wordElement(text: string, k: number) {
    const el = span(classes.word, words);
    el.dataset.k = String(k);
    const letters = [...text].map((c) => {
      const letter = span('', span(classes.letter, el));
      letter.textContent = c;
      return letter;
    });
    return { el, letters };
  }

  function build(k: number, t: number) {
    words.replaceChildren();
    slideWords = [];
    swapLetters = [];
    const [a, b] = [stations[k], stations[k + 1]];
    slots.forEach((slot, i) => {
      slot.old.textContent = a.title[i] ?? '';
      slot.next.textContent = b.title[i] ?? '';
    });
    labelLetters.forEach((letter, j) => {
      letter.textContent = (b.label || a.label)[j] ?? '';
    });
    if (kindOf(k) === 'slide') {
      slideWords = pairLines(lines[k], lines[k + 1]).map((traveler) => ({
        ...traveler,
        ...wordElement(traveler.text, k),
        v: t,
      }));
    } else {
      for (const [boxes, outgoing] of [
        [lines[k].flat(), true],
        [lines[k + 1].flat(), false],
      ] as const) {
        const letters: HTMLElement[] = [];
        for (const box of boxes) {
          const { el, letters: own } = wordElement(box.text, k);
          el.style.transform = `translate(${box.x}px, ${box.y}px)`;
          letters.push(...own);
        }
        letters.forEach((el, i) => {
          swapLetters.push({ el, u: letters.length > 1 ? i / (letters.length - 1) : 0, outgoing });
        });
      }
    }
    built = k;
  }

  function render(p: number, direction: 1 | -1, dt: number) {
    let { k, t } = locate(p, stations.length);
    // A hold is the start of the next transition; keep showing the end of the one just played
    // until the next actually starts, so trailing words finish their slide instead of snapping.
    if (t === 0 && k > 0 && built === k - 1) {
      k -= 1;
      t = 1;
    }
    if (built !== k) build(k, t);
    const [a, b] = [stations[k], stations[k + 1]];
    const kind = kindOf(k);
    const e = easeLift(t);
    // Letters time their roll by this pair's own slot count.
    const pairLength = Math.max(a.title.length, b.title.length);

    root.style.backgroundColor = mixRgb(colors[k][0], colors[k + 1][0], e);
    root.style.color = mixRgb(colors[k][1], colors[k + 1][1], e);

    let width = 0;
    slots.forEach((slot, i) => {
      const window =
        kind === 'slide' ? slideTitleWindow(i, pairLength) : swapWindow(i / pairLength);
      const { old, next } = rollOffsets(easeLift(segment(t, ...window)), direction);
      translate(slot.old, old);
      translate(slot.next, next);
      const oldWidth = textWidth(a.title[i] ?? '', titleFont);
      const slotWidth = oldWidth + (textWidth(b.title[i] ?? '', titleFont) - oldWidth) * e;
      slot.el.style.width = `${slotWidth}px`;
      width += slotWidth;
    });
    const x =
      kind === 'slide'
        ? alignedX(a.align, titleWidths[k]) +
          (alignedX(b.align, titleWidths[k + 1]) - alignedX(a.align, titleWidths[k])) * e
        : (frameWidth - width) / 2;
    title.style.transform = `translateX(${x}px)`;

    labelLetters.forEach((letter, j) => {
      if (a.label === b.label) return translate(letter, a.label ? 0 : 110);
      const { old, next } = rollOffsets(easeLift(segment(t, ...labelWindow(j))), direction);
      translate(letter, b.label ? next : old);
    });

    if (kind === 'slide') {
      const movingRight = ALIGN_RANK[b.align] > ALIGN_RANK[a.align];
      for (const word of slideWords) {
        word.v = chainStep(word.v, t, dt, lagOf(word.position, direction > 0 === movingRight));
        const v = easeLift(clamp01(word.v));
        const wx = word.from.x + (word.to.x - word.from.x) * v;
        const wy = word.from.y + (word.to.y - word.from.y) * v;
        word.el.style.transform = `translate(${wx}px, ${wy}px)`;
        word.letters.forEach((letter, i) => {
          const r = easeLift(segment(v, ...wordLetterWindow(i, word.letters.length)));
          const offsets = rollOffsets(r, direction);
          translate(letter, word.outgoing ? offsets.old : offsets.next);
        });
      }
    } else {
      for (const letter of swapLetters) {
        const offsets = rollOffsets(easeLift(segment(t, ...swapWindow(letter.u))), direction);
        translate(letter.el, letter.outgoing ? offsets.old : offsets.next);
      }
    }
  }

  measure();

  return {
    render,
    remeasure: measure,
    destroy() {
      layer.remove();
      root.style.backgroundColor = '';
      root.style.color = '';
      root.style.removeProperty('--studio-title-height');
      root.style.removeProperty('--studio-text-height');
    },
  };
}
