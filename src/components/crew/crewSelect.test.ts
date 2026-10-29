// @vitest-environment jsdom
import { type Mock, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type CrewSelect, createCrewSelect } from './crewSelect';
import { CREW_MOTION as M, SLASH, announcement, leanFor } from './select';

const CREW_LEAN = M.lean;

interface Call {
  el: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: Mock;
}
let calls: Call[] = [];
let hold: Promise<void> | null = null;
let observed: IntersectionObserverCallback | null = null;
const disconnect = vi.fn();
const scrollTo = vi.fn();
let wide = true;

const MEMBERS = [
  { slug: 'bella', name: 'Bella', role: 'Environment / Animation / Concept', accent: 'green' },
  { slug: 'brody', name: 'Brody', role: 'Level & Gameplay Designer', accent: 'red' },
  { slug: 'owen', name: 'Owen', role: 'Producer & Narrative Designer', accent: 'blue' },
  { slug: 'vincent', name: 'Vincent', role: 'Programmer & Audio Engineer', accent: 'gold' },
];

beforeEach(() => {
  calls = [];
  hold = null;
  observed = null;
  wide = true;
  disconnect.mockClear();
  scrollTo.mockClear();
  Element.prototype.animate = function (this: Element, keyframes, options) {
    const cancel = vi.fn();
    calls.push({
      el: this as HTMLElement,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
      cancel,
    });
    return { cancel, finished: hold ?? Promise.resolve() } as unknown as Animation;
  };
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  window.scrollTo = scrollTo as never;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
});

let crew: CrewSelect | null = null;

afterEach(() => {
  crew?.destroy();
  crew = null;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const letters = (word: string) =>
  `<span data-fit-line>${[...word.toUpperCase()].map((l) => `<span><span data-letter>${l}</span></span>`).join('')}</span>`;

function build({ top = 0, reduced = false } = {}) {
  const section = document.createElement('section');
  section.innerHTML = `
    <div data-lineup-layer>
      ${MEMBERS.map((m) => `<p data-hover-name aria-hidden="true">${letters(m.name)}</p>`).join('')}
      <ul>${MEMBERS.map(
        (m) => `<li data-member><button type="button" data-member-button aria-expanded="false"
          aria-controls="crew-${m.slug}"><img data-silhouette alt=""><span>${m.name}</span></button></li>`,
      ).join('')}</ul>
    </div>
    <div data-select>
      <div data-flood></div>
      ${MEMBERS.map(
        (m) => `<article data-panel id="crew-${m.slug}" style="--accent: var(--${m.accent})">
          <h3 data-heading tabindex="-1"><span data-title>${m.name}</span><span data-name aria-hidden="true">${letters(m.name)}</span></h3>
          <div data-portrait><img alt=""></div>
          <div data-info><p data-role>${m.role}</p><p>Bio.</p></div>
        </article>`,
      ).join('')}
      <div data-roster>${MEMBERS.map((m) => `<button type="button" data-pick aria-label="${m.name}"></button>`).join('')}</div>
      <button type="button" data-back aria-label="Back to the crew"></button>
    </div>
    <p aria-live="polite" data-announce></p>`;
  document.body.append(section);
  section.getBoundingClientRect = () => ({ top, height: 900, bottom: top + 900 }) as DOMRect;
  Object.defineProperty(section, 'clientHeight', { configurable: true, value: 900 });
  buttons(section).forEach((button, i) => {
    button.getBoundingClientRect = () =>
      ({ left: 100 * i, top: 600, width: 100, height: 150 }) as DOMRect;
  });
  crew = createCrewSelect(section, { reduced });
  return section;
}

const all = <T extends Element = HTMLElement>(root: ParentNode, selector: string) =>
  [...root.querySelectorAll<T & HTMLElement>(selector)] as (T & HTMLElement)[];
const buttons = (s: HTMLElement) => all(s, '[data-member-button]');
const items = (s: HTMLElement) => all(s, '[data-member]');
const sils = (s: HTMLElement) => all(s, '[data-silhouette]');
const articles = (s: HTMLElement) => all(s, '[data-panel]');
const headings = (s: HTMLElement) => all(s, '[data-heading]');
const picks = (s: HTMLElement) => all(s, '[data-pick]');
const hoverLetters = (s: HTMLElement, i: number) =>
  all(all(s, '[data-hover-name]')[i], '[data-letter]');
const nameLetters = (s: HTMLElement, i: number) => all(articles(s)[i], '[data-letter]');
const callsOn = (el: Element) => calls.filter((call) => call.el === el);
const lastTo = (el: Element) => {
  const frames = callsOn(el).at(-1)?.keyframes;
  return frames?.[frames.length - 1];
};
const pointer = (target: EventTarget, type: string, init: PointerEventInit) => {
  const event = new MouseEvent(type, { bubbles: true, ...init });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  target.dispatchEvent(event);
};
const key = (target: EventTarget, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('proximity lean', () => {
  const lean = (section: HTMLElement) =>
    items(section).map((li) => li.style.getPropertyValue('--lean'));

  test('the nearest figure leans toward the pointer, more as it gets closer', () => {
    const section = build();
    // Member 1's box spans x 100-200, y 600-750: 200px below the pointer.
    pointer(section, 'pointermove', { clientX: 150, clientY: 400 });
    expect(crew!.hovered).toBeNull();
    expect(lean(section)).toEqual(['', (1 + leanFor(200)).toFixed(3), '', '']);
    pointer(section, 'pointermove', { clientX: 150, clientY: 500 });
    expect(lean(section)).toEqual(['', (1 + leanFor(100)).toFixed(3), '', '']);
  });

  test('leans by the painted figure, not its overlapping canvas', () => {
    // Every figure is painted only in its middle columns (15-24 of 40), so with canvases 200px
    // wide and overlapping by half, member 1's figure spans x 175-225 and member 0's 75-125.
    const data = new Uint8ClampedArray(40 * 60 * 4);
    for (let y = 0; y < 60; y++) for (let x = 15; x < 25; x++) data[(y * 40 + x) * 4 + 3] = 255;
    HTMLCanvasElement.prototype.getContext = (() => ({
      drawImage() {},
      getImageData: () => ({ data }),
    })) as never;
    const proto = HTMLImageElement.prototype;
    const saved = (['naturalWidth', 'naturalHeight'] as const).map(
      (prop) => [prop, Object.getOwnPropertyDescriptor(proto, prop)] as const,
    );
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 40 });
    Object.defineProperty(proto, 'naturalHeight', { configurable: true, get: () => 60 });
    try {
      const section = build();
      buttons(section).forEach((button, i) => {
        button.getBoundingClientRect = () =>
          ({ left: 100 * i, top: 600, width: 200, height: 300 }) as DOMRect;
      });
      // Above x = 190: inside both canvases, but only near member 1's painted figure.
      pointer(section, 'pointermove', { clientX: 190, clientY: 400 });
      expect(lean(section).map((value) => value !== '')).toEqual([false, true, false, false]);
    } finally {
      for (const [prop, descriptor] of saved) {
        if (descriptor) Object.defineProperty(proto, prop, descriptor);
        else delete (proto as unknown as Record<string, unknown>)[prop];
      }
    }
  });

  test('only the nearest leans, and it moves with the pointer', () => {
    const section = build();
    pointer(section, 'pointermove', { clientX: 150, clientY: 400 });
    pointer(section, 'pointermove', { clientX: 350, clientY: 400 });
    expect(lean(section)).toEqual(['', '', '', (1 + leanFor(200)).toFixed(3)]);
  });

  test('reaching a figure hovers it fully and drops the lean', () => {
    const section = build();
    pointer(section, 'pointermove', { clientX: 150, clientY: 400 });
    pointer(section, 'pointermove', { clientX: 150, clientY: 650 });
    expect(crew!.hovered).toBe(1);
    expect(lean(section)).toEqual(['', '', '', '']);
  });

  test('far away, or leaving the section, nothing leans', () => {
    const section = build();
    pointer(section, 'pointermove', { clientX: 150, clientY: 600 - CREW_LEAN.range - 10 });
    expect(lean(section)).toEqual(['', '', '', '']);
    pointer(section, 'pointermove', { clientX: 150, clientY: 400 });
    pointer(section, 'pointerleave', { clientX: 0, clientY: 0 });
    expect(lean(section)).toEqual(['', '', '', '']);
  });

  test('the hand cursor shows only over a figure', () => {
    const section = build();
    pointer(section, 'pointermove', { clientX: 150, clientY: 400 });
    expect(section.hasAttribute('data-pointing')).toBe(false);
    pointer(section, 'pointermove', { clientX: 150, clientY: 650 });
    expect(section.hasAttribute('data-pointing')).toBe(true);
    pointer(section, 'pointerleave', { clientX: 0, clientY: 0 });
    expect(section.hasAttribute('data-pointing')).toBe(false);
  });

  test('touch and reduced motion never lean', () => {
    let section = build();
    pointer(section, 'pointermove', { clientX: 150, clientY: 400, pointerType: 'touch' });
    expect(lean(section)).toEqual(['', '', '', '']);
    crew!.destroy();
    document.body.replaceChildren();
    section = build({ reduced: true });
    pointer(section, 'pointermove', { clientX: 150, clientY: 400 });
    expect(lean(section)).toEqual(['', '', '', '']);
  });

  test('nothing happens on its own: no hover without input', async () => {
    vi.useFakeTimers();
    try {
      const section = build({ top: 0 });
      await vi.advanceTimersByTimeAsync(5000);
      expect(crew!.hovered).toBeNull();
      expect(section.hasAttribute('data-hover')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('arrival', () => {
  test('starts composed when already a third in view', () => {
    const section = build({ top: 0 });
    expect(section.dataset.crew).toBe('ready');
    expect(calls).toHaveLength(0);
    for (const img of sils(section)) expect(img.style.transform).toBe('');
  });

  test('hides the lineup before arrival, then rises once', () => {
    const section = build({ top: 2000 });
    for (const img of sils(section)) {
      expect(img.style.transform).toBe('translateY(110%)');
      expect(img.style.opacity).toBe('0');
    }
    const fire = () =>
      observed!(
        [{ target: section, intersectionRatio: 0.4 } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    fire();
    sils(section).forEach((img, i) => {
      const [call] = callsOn(img);
      expect(call.options).toMatchObject({ duration: M.rise.duration, delay: M.rise.stagger * i });
      expect(call.keyframes).toHaveLength(3);
      expect(call.keyframes[1]).toMatchObject({ opacity: 1, offset: M.rise.fadeUntil });
    });
    const count = calls.length;
    fire();
    expect(calls).toHaveLength(count);
  });
});

describe('hover', () => {
  test('rolls the name in behind and steps the others back', () => {
    const section = build();
    crew!.hover(1);
    expect(section.hasAttribute('data-hover')).toBe(true);
    expect(items(section).map((li) => li.hasAttribute('data-hovered'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    hoverLetters(section, 1).forEach((el, i) => {
      const [call] = callsOn(el);
      expect(call.keyframes[0]).toEqual({ transform: 'translateY(110%)' });
      expect(call.options.delay).toBe(M.name.inAt + M.name.inStagger * i);
    });

    // Moving to another member cuts the old name at once: no roll-out, back below its boxes.
    crew!.hover(2);
    for (const el of hoverLetters(section, 1)) {
      expect(callsOn(el)).toHaveLength(1);
      expect(callsOn(el)[0].cancel).toHaveBeenCalled();
      expect(el.style.transform).toBe('translateY(110%)');
    }

    // Leaving the lineup rolls the name out upward.
    crew!.hover(null);
    hoverLetters(section, 2).forEach((el, i) => {
      expect(lastTo(el)).toEqual({ transform: 'translateY(-110%)' });
      expect(callsOn(el).at(-1)!.options.delay).toBe(M.name.outStagger * i);
    });
    expect(section.hasAttribute('data-hover')).toBe(false);
    expect(items(section).some((li) => li.hasAttribute('data-hovered'))).toBe(false);
  });

  test('a fast sweep shows only the highlighted name', () => {
    const section = build();
    crew!.hover(0);
    crew!.hover(null); // Bella's name is still rolling out…
    crew!.hover(1); // …when the pointer reaches Brody
    crew!.hover(2);
    crew!.hover(3);
    const showing = [0, 1, 2, 3].filter((i) =>
      hoverLetters(section, i).some((el) => el.style.transform !== 'translateY(110%)'),
    );
    expect(showing).toEqual([3]);
    for (const i of [0, 1, 2])
      for (const el of hoverLetters(section, i))
        expect(callsOn(el).every((call) => call.cancel.mock.calls.length > 0)).toBe(true);
  });

  test('a pointer move picks by painted pixels, mouse and pen only', () => {
    const section = build();
    pointer(section, 'pointermove', { clientX: 250, clientY: 650, pointerType: 'touch' });
    expect(crew!.hovered).toBeNull();
    pointer(section, 'pointermove', { clientX: 250, clientY: 650 });
    expect(crew!.hovered).toBe(2);
  });

  test('crossing a gap keeps the hover for the grace period', () => {
    vi.useFakeTimers();
    try {
      const section = build();
      pointer(section, 'pointermove', { clientX: 150, clientY: 650 });
      expect(crew!.hovered).toBe(1);
      pointer(section, 'pointermove', { clientX: 150, clientY: 100 });
      vi.advanceTimersByTime(M.hoverGrace - 1);
      expect(crew!.hovered).toBe(1);
      vi.advanceTimersByTime(1);
      expect(crew!.hovered).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test('moving onto another member during the grace switches straight to it', () => {
    vi.useFakeTimers();
    try {
      const section = build();
      pointer(section, 'pointermove', { clientX: 150, clientY: 650 });
      pointer(section, 'pointermove', { clientX: 150, clientY: 100 });
      pointer(section, 'pointermove', { clientX: 250, clientY: 650 });
      expect(crew!.hovered).toBe(2);
      vi.advanceTimersByTime(M.hoverGrace * 2);
      expect(crew!.hovered).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('leaving the section drops a pointer hover even with focus inside', () => {
    const section = build();
    const matches = HTMLElement.prototype.matches;
    HTMLElement.prototype.matches = function (this: HTMLElement, selector: string) {
      return selector === ':focus-visible' ? false : matches.call(this, selector);
    } as never;
    try {
      pointer(section, 'pointermove', { clientX: 150, clientY: 650 });
      buttons(section)[1].focus();
      expect(crew!.hovered).toBe(1);
      pointer(section, 'pointerleave', { clientX: 0, clientY: 0 });
      expect(crew!.hovered).toBeNull();
    } finally {
      HTMLElement.prototype.matches = matches;
    }
  });

  test('a name hovered again mid-roll-out rolls back from where it is', () => {
    const section = build();
    crew!.hover(1);
    crew!.hover(null);
    const [first, second] = hoverLetters(section, 1);
    first.style.transform = 'translateY(-40%)'; // still on its way out
    second.style.transform = 'translateY(-110%)'; // already out
    crew!.hover(1);
    expect(callsOn(first).at(-1)!.keyframes[0]).toEqual({ transform: 'translateY(-40%)' });
    expect(callsOn(second).at(-1)!.keyframes[0]).toEqual({ transform: 'translateY(110%)' });
  });

  test('hovers by a forgiving shape: the gap between the legs counts', () => {
    // A 40×60 figure: two legs (columns 8-14 and 26-32), with an 11px gap between them.
    const data = new Uint8ClampedArray(40 * 60 * 4);
    for (let y = 0; y < 60; y++)
      for (const x0 of [8, 26]) for (let x = x0; x < x0 + 7; x++) data[(y * 40 + x) * 4 + 3] = 255;
    HTMLCanvasElement.prototype.getContext = (() => ({
      drawImage() {},
      getImageData: () => ({ data }),
    })) as never;
    const proto = HTMLImageElement.prototype;
    const saved = (['naturalWidth', 'naturalHeight'] as const).map(
      (prop) => [prop, Object.getOwnPropertyDescriptor(proto, prop)] as const,
    );
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 40 });
    Object.defineProperty(proto, 'naturalHeight', { configurable: true, get: () => 60 });
    try {
      const section = build();
      pointer(section, 'pointermove', { clientX: 150, clientY: 650 }); // member 1's gap
      expect(crew!.hovered).toBe(1);
    } finally {
      for (const [prop, descriptor] of saved) {
        if (descriptor) Object.defineProperty(proto, prop, descriptor);
        else delete (proto as unknown as Record<string, unknown>)[prop];
      }
    }
  });

  test('a click on transparent pixels opens nothing', () => {
    const section = build();
    buttons(section)[0].dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 50, clientY: 100 }),
    );
    expect(crew!.current).toBeNull();
  });
});

describe('select screen', () => {
  test('opens with the slash', async () => {
    const section = build();
    crew!.open(1);
    expect(section.hasAttribute('data-open')).toBe(true);
    expect(buttons(section)[1].getAttribute('aria-expanded')).toBe('true');
    expect(articles(section).map((a) => a.hasAttribute('data-current'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(articles(section).map((a) => a.hasAttribute('inert'))).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect(section.querySelector('[data-lineup-layer]')!.hasAttribute('inert')).toBe(true);
    expect(picks(section)[1].getAttribute('aria-current')).toBe('true');
    const flood = section.querySelector<HTMLElement>('[data-flood]')!;
    expect(flood.style.getPropertyValue('--flood')).toBe('var(--red)');

    const [slash] = callsOn(flood);
    expect(slash.keyframes).toEqual([{ clipPath: SLASH.start }, { clipPath: SLASH.full }]);
    expect(slash.options).toMatchObject({ duration: M.open.slash, delay: 0 });
    expect(callsOn(nameLetters(section, 1)[0])[0].options.delay).toBe(M.open.nameAt);
    const article = articles(section)[1];
    expect(callsOn(article.querySelector('[data-portrait]')!)[0].options.delay).toBe(
      M.open.portraitAt,
    );
    expect(callsOn(article.querySelector('[data-info]')!)[0].options.delay).toBe(M.open.panelAt);
    picks(section).forEach((tile, i) =>
      expect(callsOn(tile)[0].options.delay).toBe(M.open.rosterAt + M.open.rosterStagger * i),
    );
    expect(callsOn(section.querySelector('[data-back]')!)[0].options.delay).toBe(M.open.arrowAt);

    await crew!.idle();
    expect(section.hasAttribute('data-covered')).toBe(true);
  });

  test('opening scrolls the section to the top', () => {
    build({ top: 300 });
    crew!.open(0);
    expect(scrollTo).toHaveBeenCalledWith({ top: window.scrollY + 300, behavior: 'smooth' });
  });

  test('opening an already-aligned section does not scroll', () => {
    build({ top: 0 });
    crew!.open(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('switches in the direction of travel', async () => {
    const section = build();
    crew!.open(0);
    await crew!.idle();
    calls = [];
    crew!.change(1);
    const portrait = (i: number) => articles(section)[i].querySelector('[data-portrait]')!;
    expect(lastTo(portrait(0))).toMatchObject({ translate: '-20% 0%' });
    expect(callsOn(portrait(1))[0].keyframes[0]).toMatchObject({ translate: '25% 0%' });
    expect(callsOn(portrait(1))[0].options.delay).toBe(M.change.portraitAt);
    await crew!.idle();

    calls = [];
    crew!.change(0);
    expect(lastTo(portrait(1))).toMatchObject({ translate: '20% 0%' });
    expect(callsOn(portrait(0))[0].keyframes[0]).toMatchObject({ translate: '-25% 0%' });
  });

  test('ArrowRight at the last member wraps to the first as next', async () => {
    const section = build();
    crew!.open(3);
    await crew!.idle();
    calls = [];
    key(headings(section)[3], 'ArrowRight');
    expect(crew!.current).toBe(0);
    const portrait = articles(section)[0].querySelector('[data-portrait]')!;
    expect(callsOn(portrait)[0].keyframes[0]).toMatchObject({ translate: '25% 0%' });
  });

  test('holds the latest request while a transition runs', async () => {
    const section = build();
    let release!: () => void;
    hold = new Promise<void>((resolve) => (release = resolve));
    crew!.open(0);
    crew!.change(1);
    crew!.change(2);
    crew!.change(3);
    expect(crew!.current).toBe(0);
    hold = null;
    release();
    await crew!.idle();
    expect(crew!.current).toBe(3);
    // Article 1 and 2 never animated in.
    for (const i of [1, 2]) {
      const portrait = articles(section)[i].querySelector('[data-portrait]')!;
      expect(callsOn(portrait)).toHaveLength(0);
    }
  });

  test('keyboard open and close move focus', async () => {
    const section = build();
    buttons(section)[2].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(crew!.current).toBe(2);
    expect(document.activeElement).toBe(headings(section)[2]);
    await crew!.idle();

    key(headings(section)[2], 'ArrowLeft');
    await crew!.idle();
    expect(crew!.current).toBe(1);
    expect(document.activeElement).toBe(headings(section)[1]);
    expect(section.querySelector('[data-announce]')!.textContent).toBe('');

    calls = [];
    key(headings(section)[1], 'Escape');
    await crew!.idle();
    expect(crew!.current).toBeNull();
    expect(document.activeElement).toBe(buttons(section)[1]);
    expect(section.hasAttribute('data-open')).toBe(false);
    expect(section.querySelector('[data-lineup-layer]')!.hasAttribute('inert')).toBe(false);
    expect(buttons(section).every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    sils(section).forEach((img, i) =>
      expect(callsOn(img)[0].options.delay).toBe(M.close.backAt + M.rise.stagger * i),
    );
    const flood = section.querySelector('[data-flood]')!;
    expect(callsOn(flood)[0].keyframes).toEqual([
      { clipPath: SLASH.full },
      { clipPath: SLASH.gone },
    ]);
  });

  test('the roster announces when focus stays', async () => {
    const section = build();
    crew!.open(0);
    await crew!.idle();
    picks(section)[3].focus();
    picks(section)[3].click();
    await crew!.idle();
    expect(crew!.current).toBe(3);
    expect(document.activeElement).toBe(picks(section)[3]);
    expect(section.querySelector('[data-announce]')!.textContent).toBe(
      announcement(MEMBERS[3].name, MEMBERS[3].role),
    );
  });

  test('a swipe switches', async () => {
    const section = build();
    crew!.open(0);
    await crew!.idle();
    const select = section.querySelector('[data-select]')!;
    pointer(select, 'pointerdown', { clientX: 300, clientY: 400, pointerType: 'touch' });
    pointer(select, 'pointerup', { clientX: 240, clientY: 405, pointerType: 'touch' });
    expect(crew!.current).toBe(1);
  });

  test('the back button closes', async () => {
    const section = build();
    crew!.open(0);
    await crew!.idle();
    section.querySelector<HTMLElement>('[data-back]')!.click();
    await crew!.idle();
    expect(crew!.current).toBeNull();
  });
});

test('fits the names', () => {
  // Prepared before the controller starts: each line is 400px wide at 100px.
  const proto = HTMLElement.prototype;
  const rect = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (this: HTMLElement) {
    return this.hasAttribute('data-fit-line') ? ({ width: 400 } as DOMRect) : rect.call(this);
  };
  const widths = new Map<string, number>([
    ['hover', 1000],
    ['name', 400],
  ]);
  Object.defineProperty(proto, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute('data-hover-name')) return widths.get('hover');
      if (this.hasAttribute('data-name')) return widths.get('name');
      return 0;
    },
  });
  try {
    const section = build();
    for (const el of all(section, '[data-hover-name]')) expect(el.style.fontSize).toBe('250px');
    for (const el of all(section, '[data-name]')) expect(el.style.fontSize).toBe('100px');
  } finally {
    proto.getBoundingClientRect = rect;
    delete (proto as unknown as Record<string, unknown>).clientWidth;
  }
});

test('reduced motion swaps states without animating', async () => {
  const section = build({ top: 300, reduced: true });
  crew!.open(1);
  await crew!.idle();
  expect(section.hasAttribute('data-covered')).toBe(true);
  expect(scrollTo).toHaveBeenCalledWith({ top: window.scrollY + 300, behavior: 'auto' });
  crew!.change(2);
  await crew!.idle();
  expect(crew!.current).toBe(2);
  crew!.close();
  await crew!.idle();
  expect(crew!.current).toBeNull();
  expect(calls).toHaveLength(0);
});

test('destroy restores the markup', async () => {
  const section = build({ top: 2000 });
  crew!.hover(1);
  crew!.open(1);
  await crew!.idle();
  crew!.destroy();
  crew = null;
  for (const name of ['data-crew', 'data-open', 'data-hover', 'data-covered', 'data-chosen'])
    expect(section.hasAttribute(name)).toBe(false);
  for (const el of all(section, '*')) {
    expect(el.hasAttribute('inert')).toBe(false);
    for (const prop of ['transform', 'translate', 'opacity', 'clip-path', 'font-size', '--flood'])
      expect(el.style.getPropertyValue(prop)).toBe('');
  }
  buttons(section)[0].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(section.hasAttribute('data-open')).toBe(false);
});
