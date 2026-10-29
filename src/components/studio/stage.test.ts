// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createStage, type StageClasses } from './stage';
import { EXIT, HOLD, TRANSITION, type Station, pinnedScreens, withExit } from './stations';

// jsdom has no layout or canvas: measuring words and text widths is stubbed here.
const classes: StageClasses = {
  title: 'title',
  slot: 'slot',
  label: 'label',
  measure: 'measure',
  word: 'word',
  letter: 'letter',
};

const stations: Station[] = withExit([
  {
    title: 'VISION',
    text: 'one two',
    label: '',
    background: 'var(--mih-paper)',
    foreground: 'var(--mih-ink)',
    align: 'left',
  },
  {
    title: 'MISSION',
    text: 'three four',
    label: '',
    background: 'var(--mih-ink)',
    foreground: 'var(--mih-paper)',
    align: 'right',
  },
  {
    title: 'AMBITION',
    text: 'five six',
    label: 'VALUES',
    background: 'var(--mih-brody-red)',
    foreground: 'var(--mih-ink)',
    align: 'center',
  },
  {
    title: 'CONFIDENCE',
    text: 'seven',
    label: 'VALUES',
    background: 'var(--mih-vincent-gold)',
    foreground: 'var(--mih-ink)',
    align: 'center',
  },
  {
    title: 'PROCESS',
    text: 'eight',
    label: 'VALUES',
    background: 'var(--mih-bella-green)',
    foreground: 'var(--mih-ink)',
    align: 'center',
  },
  {
    title: 'TRANSPARENCY',
    text: 'nine',
    label: 'VALUES',
    background: 'var(--mih-owen-blue)',
    foreground: 'var(--mih-ink)',
    align: 'center',
  },
]);

// Progress on the stations.ts timeline: the middle of station `s`'s hold, and transition `k`
// `t` of the way through (the last one is the exit).
const screens = pinnedScreens(stations.length);
const hold = (s: number) => (s * (HOLD + TRANSITION) + HOLD / 2) / screens;
const during = (k: number, t: number) =>
  (HOLD + k * (TRANSITION + HOLD) + t * (k === stations.length - 2 ? EXIT : TRANSITION)) / screens;

// Word `i` of station `s` sits at x = 100·s + 50·i (shifted by `offset`), on row 600.
let offset = 0;
const originalRect = HTMLElement.prototype.getBoundingClientRect;
const originalContext = HTMLCanvasElement.prototype.getContext;

let root: HTMLElement;

beforeEach(() => {
  offset = 0;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const station = this.parentElement?.dataset.station;
    if (station !== undefined && this.dataset.i !== undefined) {
      const x = offset + 100 * Number(station) + 50 * Number(this.dataset.i);
      return { left: x, top: 600, width: 40, height: 30 } as DOMRect;
    }
    // Measuring paragraphs: the left-aligned one sets the margin; Mission's runs tallest.
    if (this.dataset.station !== undefined && this.dataset.align !== undefined) {
      const left = this.dataset.align === 'left' ? 64 : 0;
      const height = this.dataset.station === '1' ? 120 + offset : 60;
      return { left, top: 600, width: 500, height } as DOMRect;
    }
    return { left: 0, top: 0, width: 1440, height: 900 } as DOMRect;
  };
  HTMLCanvasElement.prototype.getContext = (() => ({
    font: '',
    measureText: (text: string) => ({ width: text.length * 10 }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  root = document.createElement('div');
  for (const [name, value] of Object.entries({
    '--mih-paper': '#fbfeff',
    '--mih-ink': '#1d160f',
    '--mih-brody-red': '#fd3456',
    '--mih-vincent-gold': '#f0ca41',
    '--mih-bella-green': '#5ada83',
    '--mih-owen-blue': '#3f78eb',
  })) {
    root.style.setProperty(name, value);
  }
  document.body.append(root);
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  HTMLCanvasElement.prototype.getContext = originalContext;
  document.body.replaceChildren();
});

const slots = () => [...root.querySelectorAll<HTMLElement>('.slot')];
const words = () => [...root.querySelectorAll<HTMLElement>('.word')];
const translateY = (el: Element) => (el as HTMLElement).style.transform;
const xOf = (el: HTMLElement) => Number(/translate\(([-\d.]+)px/.exec(el.style.transform)![1]);

describe('createStage', () => {
  test('builds a slot per letter of the longest title, the label, and a measure per station', () => {
    createStage(root, stations, classes);
    expect(slots()).toHaveLength(12);
    expect(root.querySelectorAll('.label > span')).toHaveLength(6);
    expect(
      [...root.querySelectorAll<HTMLElement>('p[data-align]')].map((p) => p.dataset.align),
    ).toEqual(['left', 'right', 'center', 'center', 'center', 'center', 'center']);
  });

  test('shows Vision at the start, paper behind ink', () => {
    const stage = createStage(root, stations, classes);
    stage.render(0, 1, 0);
    expect(root.style.backgroundColor).toBe('rgb(251, 254, 255)');
    const shown = slots().slice(0, 6);
    expect(shown.map((s) => s.children[0].textContent).join('')).toBe('VISION');
    for (const slot of shown) expect(translateY(slot.children[0])).toBe('translateY(0%)');
  });

  test('shows Mission during its hold, with its words at the Mission boxes', () => {
    const stage = createStage(root, stations, classes);
    stage.render(hold(1), 1, 0);
    const shown = slots().slice(0, 7);
    expect(shown.map((s) => s.children[0].textContent).join('')).toBe('MISSION');
    expect(shown.map((s) => s.children[1].textContent).join('')).toBe('AMBITION'.slice(0, 7));
    for (const slot of shown) {
      expect(translateY(slot.children[0])).toBe('translateY(0%)');
      expect(translateY(slot.children[1])).toBe('translateY(110%)');
    }
    const three = words().find((w) => w.textContent === 'three')!;
    expect(xOf(three)).toBe(100);
  });

  test('rebuilds when the transition changes, even by more than one', () => {
    const stage = createStage(root, stations, classes);
    stage.render(hold(0), 1, 0);
    stage.render(hold(3), 1, 0);
    expect(words().length).toBeGreaterThan(0);
    for (const word of words()) expect(word.dataset.k).toBe('3');
  });

  test('lets trailing words finish their slide during the hold instead of snapping', () => {
    const stage = createStage(root, stations, classes);
    stage.render(during(0, 0.93), 1, 0.016);
    const before = words().map((w) => w.style.transform);
    stage.render(hold(1), 1, 0.016);
    for (const word of words()) expect(word.dataset.k).toBe('0');
    expect(words().map((w) => w.style.transform)).not.toEqual(before);
  });

  test("times each title letter by the pair's own length, not the whole row", () => {
    const stage = createStage(root, stations, classes);
    // 60% through Vision -> Mission: with 7 slots, the 7th letter is still rising.
    stage.render(during(0, 0.6), 1, 0);
    const seventh = slots()[6].children[1] as HTMLElement;
    const offset = Number(/translateY\(([-\d.]+)%\)/.exec(seventh.style.transform)![1]);
    expect(offset).toBeGreaterThan(50);
  });

  test('never puts an old letter above its slot when scrolling back', () => {
    const stage = createStage(root, stations, classes);
    stage.render(during(0, 0.5), -1, 0);
    for (const slot of slots()) {
      const offsetY = Number(/translateY\(([-\d.]+)%\)/.exec(translateY(slot.children[0]))![1]);
      expect(offsetY).toBeGreaterThanOrEqual(0);
    }
  });

  test('shows TRANSPARENCY on blue during its hold, before the exit', () => {
    const stage = createStage(root, stations, classes);
    stage.render(hold(5), 1, 0);
    expect(root.style.backgroundColor).toBe('rgb(63, 120, 235)');
    expect(
      slots()
        .map((s) => s.children[0].textContent)
        .join(''),
    ).toBe('TRANSPARENCY');
    for (const slot of slots()) expect(translateY(slot.children[0])).toBe('translateY(0%)');
  });

  test('ends the exit on paper with the title, label, and line rolled out', () => {
    const stage = createStage(root, stations, classes);
    stage.render(1, 1, 0);
    expect(root.style.backgroundColor).toBe('rgb(251, 254, 255)');
    expect(root.style.color).toBe('rgb(29, 22, 15)');
    for (const slot of slots()) {
      expect(translateY(slot.children[0])).toBe('translateY(-110%)');
      expect(slot.style.width).toBe('0px');
    }
    for (const letter of root.querySelectorAll('.label > span > span')) {
      expect(translateY(letter)).toBe('translateY(-110%)');
    }
    const letters = [...root.querySelectorAll('.word .letter > span')];
    expect(letters.length).toBeGreaterThan(0);
    for (const letter of letters) expect(translateY(letter)).toBe('translateY(-110%)');
  });

  test('brings TRANSPARENCY back from below when scrolling back through the exit', () => {
    const stage = createStage(root, stations, classes);
    stage.render(during(5, 0.5), -1, 0);
    for (const slot of slots()) {
      const offsetY = Number(/translateY\(([-\d.]+)%\)/.exec(translateY(slot.children[0]))![1]);
      expect(offsetY).toBeGreaterThanOrEqual(0);
    }
  });

  test('moves words to the new boxes after remeasure', () => {
    const stage = createStage(root, stations, classes);
    stage.render(hold(1), 1, 0);
    offset = 1000;
    stage.remeasure();
    stage.render(hold(1), 1, 0);
    expect(xOf(words().find((w) => w.textContent === 'three')!)).toBe(1100);
  });

  test('reports the tallest paragraph so the block can be centered', () => {
    const stage = createStage(root, stations, classes);
    expect(root.style.getPropertyValue('--studio-text-height')).toBe('120px');
    offset = 30;
    stage.remeasure();
    expect(root.style.getPropertyValue('--studio-text-height')).toBe('150px');
  });

  test('removes everything it added on destroy', () => {
    const stage = createStage(root, stations, classes);
    stage.render(hold(2), 1, 0);
    stage.destroy();
    expect(root.children).toHaveLength(0);
    expect(root.style.backgroundColor).toBe('');
  });
});
