// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createListReveal } from './listReveal';
import { PROJECTS_MOTION } from './wheel';

const { phone } = PROJECTS_MOTION;

interface Call {
  el: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let calls: Call[] = [];
let observed: IntersectionObserverCallback;
let watched: Element[] = [];
const disconnect = vi.fn();

beforeEach(() => {
  calls = [];
  watched = [];
  disconnect.mockClear();
  Element.prototype.animate = function (this: Element, keyframes, options) {
    calls.push({
      el: this as HTMLElement,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    return { cancel: vi.fn(), finished: Promise.resolve() } as unknown as Animation;
  };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback;
      }
      observe(el: Element) {
        watched.push(el);
      }
      unobserve(el: Element) {
        watched = watched.filter((other) => other !== el);
      }
      disconnect = disconnect;
    },
  );
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

// Three items: one above the viewport, one on screen, one below.
function build() {
  const section = document.createElement('section');
  section.innerHTML = [0, 1, 2]
    .map(
      () => `<li data-project><a data-card><img data-art alt=""></a>
        <h3><span data-piece="title">T</span></h3><p><span data-piece="status">S</span></p>
        <p><span data-piece="description">D</span></p><p><a data-piece="link">L</a></p></li>`,
    )
    .join('');
  document.body.append(section);
  const items = [...section.querySelectorAll<HTMLElement>('[data-project]')];
  [-900, 200, 900].forEach((top, i) => {
    items[i].getBoundingClientRect = () => ({ top, height: 700 }) as DOMRect;
  });
  return { items, reveal: createListReveal(section) };
}

const art = (item: HTMLElement) => item.querySelector<HTMLElement>('[data-art]')!;
const pieces = (item: HTMLElement) => [...item.querySelectorAll<HTMLElement>('[data-piece]')];
const intersect = (target: Element, intersectionRatio: number) =>
  observed(
    [{ target, intersectionRatio } as unknown as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );

test('hides only the items that start below the viewport', () => {
  const [above, onScreen, below] = build().items;
  for (const item of [above, onScreen]) {
    expect(art(item).style.transform).toBe('');
    pieces(item).forEach((el) => expect(el.style.transform).toBe(''));
  }
  expect(art(below).style.transform).toBe('translateY(110%)');
  pieces(below).forEach((el) => expect(el.style.transform).toBe('translateY(110%)'));
  expect(watched).toEqual([below]);
});

test('reveals an item once a quarter of it is on screen, then stops watching it', () => {
  const below = build().items[2];
  intersect(below, 0.1);
  expect(calls).toHaveLength(0);
  intersect(below, 0.3);

  const rise = calls.find((call) => call.el === art(below))!;
  expect(rise.keyframes.map((k) => k.transform)).toEqual(['translateY(110%)', 'translateY(0%)']);
  expect(rise.options).toMatchObject({ duration: phone.rise, delay: 0, fill: 'both' });
  expect(rise.options.easing).toBe('cubic-bezier(0.76, 0, 0.24, 1)');

  pieces(below).forEach((el, i) => {
    const call = calls.find((c) => c.el === el)!;
    expect(call.keyframes.map((k) => k.transform)).toEqual(['translateY(110%)', 'translateY(0%)']);
    expect(call.options).toMatchObject({ duration: phone.roll, delay: phone.textDelays[i] });
    expect(call.options.easing).toBe('cubic-bezier(0.25, 1, 0.5, 1)');
  });
  expect(art(below).style.transform).toBe('translateY(0%)');
  expect(watched).toEqual([]);
});

test('destroy disconnects and clears every inline transform', () => {
  const { items, reveal } = build();
  reveal.destroy();
  expect(disconnect).toHaveBeenCalled();
  expect(art(items[2]).getAttribute('style')).toBe('');
  pieces(items[2]).forEach((el) => expect(el.getAttribute('style')).toBe(''));
});
