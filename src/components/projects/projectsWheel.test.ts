// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type ProjectsWheel, createProjectsWheel } from './projectsWheel';
import {
  PROJECTS_MOTION as M,
  type Rect,
  placePose,
  poseTransform,
  slotPose,
  splitTitle,
} from './wheel';

// jsdom has no Web Animations or IntersectionObserver: record every animate() call, and let a
// test hold the animations open to check what happens mid-transition.
interface Call {
  el: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let calls: Call[] = [];
let holding = false;
let held: (() => void)[] = [];

function stubAnimate() {
  calls = [];
  held = [];
  Element.prototype.animate = function (this: Element, keyframes, options) {
    calls.push({
      el: this as HTMLElement,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    const finished = holding
      ? new Promise<void>((resolve) => held.push(resolve))
      : Promise.resolve();
    return { cancel: vi.fn(), finish: vi.fn(), finished } as unknown as Animation;
  };
}

const release = async (wheel: ProjectsWheel) => {
  holding = false;
  while (held.length) held.splice(0).forEach((resolve) => resolve());
  await wheel.idle();
};

let observed: IntersectionObserverCallback | undefined;
const disconnect = vi.fn();
function stubObserver() {
  observed = undefined;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
}
const intersect = (ratio: number) =>
  observed?.(
    [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );

const TITLES = ['Fast Frankie', 'Good Luck Valley', 'Third Game'];
const SPOT: Rect = { left: 736, top: 210, width: 640, height: 480 };
const card = { width: 640, height: 480 };
let spot: Rect = SPOT;

const gridCell = (i: number): Rect => ({
  left: 64 + i * 448,
  top: 200,
  width: 416,
  height: 312,
});

const rectOf = (r: Rect) => () =>
  ({ ...r, right: r.left + r.width, bottom: r.top + r.height }) as DOMRect;

function build(sectionTop: number, titles = TITLES): HTMLElement {
  const section = document.createElement('section');
  const letters = (title: string) =>
    splitTitle(title)
      .map((word) => `<span>${word.map((l) => `<span data-letter>${l}</span>`).join('')}</span>`)
      .join('');
  section.innerHTML = `
    <div data-wheel-spot></div>
    <div><button data-view-button="wheel" aria-pressed="true">Wheel</button>
      <button data-view-button="grid" aria-pressed="false">Grid</button></div>
    <ul>${titles
      .map(
        (title) => `<li data-project>
          <a data-card href="/projects/x"><img data-art alt=""></a>
          <div data-info>
            <p aria-hidden="true">${letters(title)}</p>
            <h3><span data-piece="title">${title}</span></h3>
            <p><span data-piece="status">In development</span></p>
            <p><span data-piece="description">About it.</span></p>
            <p><a data-piece="link" href="/projects/x">View project</a></p>
          </div>
        </li>`,
      )
      .join('')}</ul>
    <div data-controls><button data-step="-1"><span data-ink></span></button>
      <span data-counter>01 / 03</span><button data-step="1"><span data-ink></span></button></div>
    <p data-announce></p>`;
  document.body.append(section);
  section.getBoundingClientRect = rectOf({ left: 0, top: sectionTop, width: 1440, height: 900 });
  const spotEl = section.querySelector<HTMLElement>('[data-wheel-spot]')!;
  spotEl.getBoundingClientRect = () => rectOf(spot)();
  cards(section).forEach((el, i) => {
    el.getBoundingClientRect = () => rectOf(section.dataset.view === 'grid' ? gridCell(i) : spot)();
  });
  return section;
}

const items = (section: HTMLElement) => [
  ...section.querySelectorAll<HTMLElement>('[data-project]'),
];
const cards = (section: HTMLElement) => [...section.querySelectorAll<HTMLElement>('[data-card]')];
const lettersOf = (item: HTMLElement) => [...item.querySelectorAll<HTMLElement>('[data-letter]')];
const piece = (item: HTMLElement, name: string) =>
  item.querySelector<HTMLElement>(`[data-piece="${name}"]`)!;
const callsOn = (el: Element) => calls.filter((call) => call.el === el);
const lastCallOn = (el: Element) => callsOn(el).at(-1)!;
const at = (pose: ReturnType<typeof slotPose>, size = card) => poseTransform(pose, size);

let wheels: ProjectsWheel[] = [];
const start = (section: HTMLElement) => {
  const wheel = createProjectsWheel(section);
  wheels.push(wheel);
  return wheel;
};

beforeEach(() => {
  stubAnimate();
  stubObserver();
  holding = false;
  spot = SPOT;
  disconnect.mockClear();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
});

afterEach(() => {
  wheels.forEach((wheel) => wheel.destroy());
  wheels = [];
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('starting', () => {
  test('starts composed when already a third in view', () => {
    const section = build(0);
    start(section);
    expect(section.dataset.view).toBe('wheel');
    cards(section).forEach((el, i) => {
      expect(el.style.transform).toBe(at(slotPose(i, card)));
      expect(el.style.zIndex).toBe(String(40 - 2 * i));
    });
    const [first, ...rest] = items(section);
    expect(first.hasAttribute('data-current')).toBe(true);
    expect(piece(first, 'status').style.transform).toBe('translateY(0%)');
    rest.forEach((item) => {
      expect(item.querySelector('[data-info]')!.hasAttribute('inert')).toBe(true);
      expect(piece(item, 'status').style.transform).toBe('translateY(110%)');
    });
    expect(section.querySelector('[data-counter]')!.textContent).toBe('01 / 03');
    expect(section.querySelector('[data-step="-1"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(calls).toHaveLength(0);
  });

  test('stacks and hides before the entry, then fans out once', async () => {
    const section = build(2000);
    const wheel = start(section);
    cards(section).forEach((el) => expect(el.style.transform).toBe(at(slotPose(0, card))));
    expect(piece(items(section)[0], 'status').style.transform).toBe('translateY(110%)');
    expect(section.querySelector<HTMLElement>('[data-controls]')!.style.opacity).toBe('0');

    intersect(0.1);
    expect(calls).toHaveLength(0);
    intersect(0.4);
    await wheel.idle();
    cards(section).forEach((el, i) => {
      const { keyframes, options } = lastCallOn(el);
      expect(keyframes.map((k) => k.transform)).toEqual([
        at(slotPose(0, card)),
        at(slotPose(i, card)),
      ]);
      expect(options).toMatchObject({ duration: M.step, fill: 'both' });
    });
    const first = items(section)[0];
    expect(lastCallOn(lettersOf(first)[0]).options.delay).toBe(M.step * M.rollInAt);
    expect(lastCallOn(lettersOf(first)[0]).keyframes[0].transform).toBe('translateY(110%)');
    expect(disconnect).toHaveBeenCalled();

    const count = calls.length;
    intersect(0.5);
    await wheel.idle();
    expect(calls).toHaveLength(count);
  });
});

describe('stepping', () => {
  test('steps to the next project', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.goTo(1);
    await wheel.idle();
    expect(wheel.current).toBe(1);
    cards(section).forEach((el, i) => {
      const { keyframes, options } = lastCallOn(el);
      expect(keyframes.map((k) => k.transform)).toEqual([
        at(slotPose(i, card)),
        at(slotPose(i - 1, card)),
      ]);
      expect(options).toMatchObject({ duration: M.step, delay: 0, fill: 'both' });
      expect(options.easing).toBe('cubic-bezier(0.76, 0, 0.24, 1)');
      expect(el.style.transform).toBe(at(slotPose(i - 1, card)));
    });
    const [first, second] = items(section);
    const out = lastCallOn(lettersOf(first)[1]);
    expect(out.keyframes.map((k) => k.transform)).toEqual(['translateY(0%)', 'translateY(-110%)']);
    expect(out.options).toMatchObject({ delay: M.letterStagger, duration: M.roll });
    const inn = lastCallOn(lettersOf(second)[2]);
    expect(inn.keyframes.map((k) => k.transform)).toEqual(['translateY(110%)', 'translateY(0%)']);
    expect(inn.options.delay).toBe(M.step * M.rollInAt + 2 * M.letterStagger);
    expect(inn.options.easing).toBe('cubic-bezier(0.25, 1, 0.5, 1)');
    expect(lastCallOn(piece(second, 'link')).options.delay).toBe(M.step * M.rollInAt + 240);

    expect(second.hasAttribute('data-current')).toBe(true);
    expect(first.querySelector('[data-info]')!.hasAttribute('inert')).toBe(true);
    expect(second.querySelector('[data-info]')!.hasAttribute('inert')).toBe(false);
    expect(section.querySelector('[data-counter]')!.textContent).toBe('02 / 03');
    expect(section.querySelector('[data-announce]')!.textContent).toBe('Good Luck Valley, 2 of 3');
  });

  test('steps back with the roll mirrored', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.goTo(1);
    await wheel.idle();
    wheel.goTo(0);
    await wheel.idle();
    const [first, second] = items(section);
    expect(lastCallOn(piece(second, 'status')).keyframes.map((k) => k.transform)).toEqual([
      'translateY(0%)',
      'translateY(110%)',
    ]);
    expect(lastCallOn(piece(first, 'status')).keyframes.map((k) => k.transform)).toEqual([
      'translateY(-110%)',
      'translateY(0%)',
    ]);
  });

  test("holds what rolls in until a two-row title's second row has left", async () => {
    const section = build(0);
    const [first, second] = items(section);
    // Clip boxes, one column: Fast Frankie's title is one row, Good Luck Valley's two, so its
    // second row (VALLEY) sits where Fast Frankie's status lands.
    const stub = (el: Element, top: number) => {
      el.getBoundingClientRect = rectOf({ left: 0, top, width: 300, height: 40 });
    };
    first.querySelectorAll('[data-letter]').forEach((el) => stub(el.parentElement!, 0));
    second
      .querySelectorAll('[data-letter]')
      .forEach((el, i) => stub(el.parentElement!, i < 8 ? 0 : 60));
    stub(piece(first, 'status').parentElement!, 60);
    stub(piece(second, 'status').parentElement!, 120);
    const clear = (delay: number) => delay + M.roll * M.rollClear;
    const inAt = M.step * M.rollInAt;

    const wheel = start(section);
    wheel.goTo(1);
    await wheel.idle();
    expect(lastCallOn(lettersOf(second)[0]).options.delay).toBe(inAt);
    expect(lastCallOn(lettersOf(second)[8]).options.delay).toBe(clear(M.blockDelays[0]));

    wheel.goTo(0);
    await wheel.idle();
    expect(lastCallOn(lettersOf(first)[0]).options.delay).toBe(inAt);
    expect(lastCallOn(piece(first, 'status')).options.delay).toBe(clear(13 * M.letterStagger));
  });

  test('holds the latest request while a transition runs', async () => {
    const section = build(0);
    const wheel = start(section);
    holding = true;
    wheel.goTo(1);
    wheel.goTo(2);
    wheel.goTo(0);
    const first = cards(section)[0];
    expect(callsOn(first)).toHaveLength(1);
    await release(wheel);
    expect(callsOn(first)).toHaveLength(2);
    expect(wheel.current).toBe(0);
    expect(lastCallOn(first).keyframes.map((k) => k.transform)).toEqual([
      at(slotPose(-1, card)),
      at(slotPose(0, card)),
    ]);
  });

  test('the arrows step and stop at the ends', async () => {
    const section = build(0);
    const wheel = start(section);
    section.querySelector<HTMLElement>('[data-step="-1"]')!.click();
    await wheel.idle();
    expect(calls).toHaveLength(0);
    section.querySelector<HTMLElement>('[data-step="1"]')!.click();
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });
});

describe('input', () => {
  const click = (el: HTMLElement) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  };

  test('clicking a neighbor turns instead of navigating', async () => {
    const section = build(0);
    const wheel = start(section);
    expect(click(cards(section)[1]).defaultPrevented).toBe(true);
    await wheel.idle();
    expect(wheel.current).toBe(1);
    expect(click(cards(section)[1]).defaultPrevented).toBe(false);
  });

  test('a mouse press that focuses a neighbor still turns instead of navigating', async () => {
    const section = build(0);
    const wheel = start(section);
    const neighbor = cards(section)[1];
    neighbor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 400 }));
    neighbor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientY: 400 }));
    expect(click(neighbor).defaultPrevented).toBe(true);
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });

  test('focusing a card turns to it', async () => {
    const section = build(0);
    const wheel = start(section);
    cards(section)[2].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await wheel.idle();
    expect(wheel.current).toBe(2);
    expect(lastCallOn(cards(section)[0]).keyframes[1].transform).toBe(at(slotPose(-2, card)));
  });

  test('arrow keys at the ends are not intercepted', async () => {
    const section = build(0);
    const wheel = start(section);
    const key = (name: string) => {
      const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
      cards(section)[0].dispatchEvent(event);
      return event;
    };
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(key('ArrowDown').defaultPrevented).toBe(true);
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });

  test('a vertical mouse drag steps, and does not count as a click', async () => {
    const section = build(0);
    const wheel = start(section);
    const current = cards(section)[0];
    current.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 500 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 450 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientY: 440 }));
    expect(click(current).defaultPrevented).toBe(true);
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });
});

describe('scrolling over the cards', () => {
  /** Dispatches a vertical wheel event at `time` on an element; true when it was taken. */
  const scroll = (el: Element, deltaY: number, time: number) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'timeStamp', { value: time });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  };
  /** A swipe's momentum: 16ms apart from `from`, decaying. */
  const swipe = (el: Element, sign: number, from: number) =>
    Array.from({ length: 30 }, (_, i) => scroll(el, sign * Math.max(1, 40 - i), from + i * 16));

  test('a swipe down over a card while pinned steps once and keeps its momentum', async () => {
    const section = build(0);
    const wheel = start(section);
    expect(swipe(cards(section)[0], 1, 0).every(Boolean)).toBe(true);
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });

  test('a swipe up steps back', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.goTo(2);
    await wheel.idle();
    swipe(cards(section)[2], -1, 0);
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });

  test('each gesture steps once', async () => {
    const section = build(0);
    const wheel = start(section);
    swipe(cards(section)[0], 1, 0);
    await wheel.idle();
    swipe(cards(section)[1], 1, 2000);
    await wheel.idle();
    expect(wheel.current).toBe(2);
  });

  test('the momentum stays taken when the cards move away from the pointer', async () => {
    const section = build(0);
    const wheel = start(section);
    expect(scroll(cards(section)[0], 30, 0)).toBe(true);
    const info = section.querySelector('[data-info]')!;
    expect(scroll(info, 20, 16)).toBe(true);
    await wheel.idle();
    expect(wheel.current).toBe(1);
  });

  test('past the last project a new gesture scrolls the page', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.goTo(2);
    await wheel.idle();
    expect(swipe(cards(section)[2], 1, 0).some(Boolean)).toBe(false);
    expect(wheel.current).toBe(2);
  });

  test('before the first project a new gesture scrolls the page', () => {
    const section = build(0);
    start(section);
    expect(scroll(cards(section)[0], -30, 0)).toBe(false);
  });

  test('scrolling off the cards moves the page', async () => {
    const section = build(0);
    const wheel = start(section);
    expect(swipe(section.querySelector('[data-info]')!, 1, 0).some(Boolean)).toBe(false);
    expect(scroll(section.querySelector('[data-counter]')!, 30, 2000)).toBe(false);
    await wheel.idle();
    expect(wheel.current).toBe(0);
  });

  test('scrolling over a card before the section pins moves the page', async () => {
    const section = build(300);
    const wheel = start(section);
    expect(swipe(cards(section)[0], 1, 0).some(Boolean)).toBe(false);
    await wheel.idle();
    expect(wheel.current).toBe(0);
  });

  test('the grid scrolls the page', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.showGrid();
    await wheel.idle();
    expect(scroll(cards(section)[0], 30, 0)).toBe(false);
  });

  test('a gesture the browser will scroll anyway (not cancelable) is left to the page', async () => {
    const section = build(0);
    const wheel = start(section);
    const event = new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: false });
    cards(section)[0].dispatchEvent(event);
    expect(scroll(cards(section)[0], 30, 16)).toBe(false);
    await wheel.idle();
    expect(wheel.current).toBe(0);
  });

  test('pinch zoom and sideways swipes are left alone', () => {
    const section = build(0);
    start(section);
    const pinch = new WheelEvent('wheel', { deltaY: 30, ctrlKey: true, cancelable: true });
    cards(section)[0].dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(false);
    const sideways = new WheelEvent('wheel', { deltaX: 40, deltaY: 5, cancelable: true });
    cards(section)[0].dispatchEvent(sideways);
    expect(sideways.defaultPrevented).toBe(false);
  });
});

describe('switching views', () => {
  test('gathers then deals into the grid', async () => {
    const section = build(0);
    const wheel = start(section);
    holding = true;
    section.querySelector<HTMLElement>('[data-view-button="grid"]')!.click();
    cards(section).forEach((el, i) => {
      const { keyframes, options } = lastCallOn(el);
      expect(keyframes.map((k) => k.transform)).toEqual([
        at(slotPose(i, card)),
        at(slotPose(0, card)),
      ]);
      expect(options).toMatchObject({ duration: M.gather, delay: 0 });
    });
    expect(cards(section)[0].style.zIndex).toBe('50');
    expect(section.dataset.view).toBe('wheel');
    // The toggle answers the click at once, before the layout switches.
    expect(section.querySelector('[data-view-button="grid"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );

    await release(wheel);
    expect(wheel.view).toBe('grid');
    expect(section.dataset.view).toBe('grid');
    cards(section).forEach((el, i) => {
      const cell = gridCell(i);
      const size = { width: cell.width, height: cell.height };
      const { keyframes, options } = lastCallOn(el);
      expect(keyframes.map((k) => k.transform)).toEqual([
        at(placePose(cell, SPOT), size),
        at(slotPose(0, size), size),
      ]);
      expect(options).toMatchObject({ duration: M.deal, delay: M.dealStagger * i });
    });
    const third = items(section)[2];
    expect(lastCallOn(piece(third, 'title')).keyframes[0].transform).toBe('translateY(110%)');
    expect(lastCallOn(piece(third, 'title')).options.delay).toBe(
      2 * M.dealStagger + M.captionAt * M.deal,
    );
    expect(lastCallOn(piece(third, 'status')).options.delay).toBe(
      2 * M.dealStagger + M.captionAt * M.deal + M.captionStatusDelay,
    );
    items(section).forEach((item) => {
      expect(item.hasAttribute('data-current')).toBe(false);
      expect(item.querySelector('[data-info]')!.hasAttribute('inert')).toBe(false);
    });
    const [wheelButton, gridButton] = section.querySelectorAll('[data-view-button]');
    expect(wheelButton.getAttribute('aria-pressed')).toBe('false');
    expect(gridButton.getAttribute('aria-pressed')).toBe('true');
  });

  test('converges then fans back into the wheel', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.goTo(1);
    await wheel.idle();
    wheel.showGrid();
    await wheel.idle();
    holding = true;
    wheel.showWheel();
    expect(section.dataset.view).toBe('grid');
    expect(section.querySelector('[data-view-button="wheel"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );
    cards(section).forEach((el, i) => {
      const cell = gridCell(i);
      const size = { width: cell.width, height: cell.height };
      const { keyframes, options } = lastCallOn(el);
      expect(keyframes[1].transform).toBe(at(placePose(cell, SPOT), size));
      expect(options).toMatchObject({ duration: M.gather, delay: M.dealStagger * i });
    });
    expect(lastCallOn(piece(items(section)[2], 'status')).keyframes[1].transform).toBe(
      'translateY(-110%)',
    );

    await release(wheel);
    expect(section.dataset.view).toBe('wheel');
    expect(wheel.current).toBe(1);
    cards(section).forEach((el, i) => {
      expect(lastCallOn(el).keyframes.map((k) => k.transform)).toEqual([
        at(slotPose(0, card)),
        at(slotPose(i - 1, card)),
      ]);
    });
    const controls = section.querySelector<HTMLElement>('[data-controls]')!;
    expect(lastCallOn(controls).options.delay).toBe(M.step * M.controlsAt);
  });

  describe('inside the scroll hold', () => {
    // A model of the hold's sticky layout (projects, "Scroll hold"): the wrapper is the section
    // plus HOLD in the wheel view and just the section in the grid; the section pins at the
    // screen's top while the wrapper scrolls through the hold. scrollTo moves the page.
    const HOLD = 450;
    let scrolled = 0;
    const scrollTo = vi.fn(({ top }: ScrollToOptions) => (scrolled = top!));

    const inHold = (wrapperTop: number) => {
      const section = build(0);
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-hold', '');
      document.body.append(wrapper);
      wrapper.append(section);
      const held = () => (section.dataset.view === 'wheel' ? HOLD : 0);
      const outer = () => wrapperTop - scrolled;
      const top = () => (outer() >= 0 ? outer() : outer() >= -held() ? 0 : outer() + held());
      wrapper.getBoundingClientRect = () =>
        rectOf({ left: 0, top: outer(), width: 1440, height: 900 + held() })();
      section.getBoundingClientRect = () =>
        rectOf({ left: 0, top: top(), width: 1440, height: 900 })();
      return { section, top };
    };

    beforeEach(() => {
      scrolled = 0;
      scrollTo.mockClear();
      window.scrollTo = scrollTo as never;
      Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrolled });
    });

    test('switching to the grid while pinned keeps the top row in place', async () => {
      const { section, top } = inHold(-200);
      const wheel = start(section);
      expect(top()).toBe(0);
      wheel.showGrid();
      await wheel.idle();
      expect(scrollTo).toHaveBeenCalledWith({ top: -200, behavior: 'auto' });
      expect(top()).toBe(0);
    });

    test('switching to the grid past the hold keeps the top row in place', async () => {
      const { section, top } = inHold(-HOLD - 100);
      const wheel = start(section);
      expect(top()).toBe(-100);
      wheel.showGrid();
      await wheel.idle();
      expect(top()).toBe(-100);
    });

    test('switching back to the wheel above the screen top keeps the top row in place', async () => {
      const { section, top } = inHold(100);
      const wheel = start(section);
      wheel.showGrid();
      await wheel.idle();
      scrolled = 150;
      expect(top()).toBe(-50);
      wheel.showWheel();
      await wheel.idle();
      expect(top()).toBe(-50);
    });

    test('leaves the scroll alone when the section starts below the screen top', async () => {
      const { section } = inHold(100);
      const wheel = start(section);
      wheel.showGrid();
      await wheel.idle();
      wheel.showWheel();
      await wheel.idle();
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  test('ignores the grid button when already in the grid', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.showGrid();
    await wheel.idle();
    const count = calls.length;
    wheel.showGrid();
    await wheel.idle();
    expect(calls).toHaveLength(count);
  });
});

describe('arrow hover', () => {
  const hover = (el: Element, type: string) =>
    el.dispatchEvent(new PointerEvent(type, { clientX: 10, clientY: 10, pointerType: 'mouse' }));

  test('fills an arrow with ink while the pointer is over it, until destroyed', () => {
    const section = build(0);
    const wheel = start(section);
    const next = section.querySelector<HTMLElement>('[data-step="1"]')!;
    const ink = next.querySelector('[data-ink]')!;
    hover(next, 'pointerenter');
    expect(lastCallOn(ink).keyframes.map((k) => k.transform)).toEqual(['scale(0)', 'scale(1)']);
    expect(next.hasAttribute('data-filled')).toBe(true);
    wheel.destroy();
    expect(next.hasAttribute('data-filled')).toBe(false);
    const count = calls.length;
    hover(next, 'pointerenter');
    expect(calls).toHaveLength(count);
  });

  test('leaves the disabled arrow empty', () => {
    const section = build(0);
    start(section);
    const previous = section.querySelector<HTMLElement>('[data-step="-1"]')!;
    hover(previous, 'pointerenter');
    expect(callsOn(previous.querySelector('[data-ink]')!)).toHaveLength(0);
  });
});

describe('resizing and teardown', () => {
  test('re-applies the slots on resize', () => {
    const section = build(0);
    start(section);
    spot = { left: 900, top: 300, width: 320, height: 240 };
    window.dispatchEvent(new Event('resize'));
    const small = { width: 320, height: 240 };
    cards(section).forEach((el, i) => {
      expect(el.style.transform).toBe(at(slotPose(i, small), small));
    });
  });

  test('waits for a running transition before re-applying', async () => {
    const section = build(0);
    const wheel = start(section);
    holding = true;
    wheel.goTo(1);
    spot = { left: 900, top: 300, width: 320, height: 240 };
    window.dispatchEvent(new Event('resize'));
    const small = { width: 320, height: 240 };
    expect(cards(section)[0].style.transform).toBe(at(slotPose(-1, card)));
    await release(wheel);
    expect(cards(section)[0].style.transform).toBe(at(slotPose(-1, small), small));
  });

  test('destroy restores the markup', async () => {
    const section = build(0);
    const wheel = start(section);
    wheel.goTo(1);
    await wheel.idle();
    wheel.destroy();
    expect(section.hasAttribute('data-view')).toBe(false);
    expect(section.querySelectorAll('[data-current], [inert]')).toHaveLength(0);
    section
      .querySelectorAll<HTMLElement>('[data-card], [data-letter], [data-piece]')
      .forEach((el) => {
        expect(el.getAttribute('style') ?? '').toBe('');
      });
    expect(section.querySelector<HTMLElement>('[data-controls]')!.style.opacity).toBe('');
    const count = calls.length;
    section.querySelector<HTMLElement>('[data-step="1"]')!.click();
    expect(calls).toHaveLength(count);
  });

  test('a single project shows composed with nothing to step to', async () => {
    const section = build(0, ['Fast Frankie']);
    const wheel = start(section);
    wheel.goTo(1);
    wheel.showGrid();
    await wheel.idle();
    expect(calls).toHaveLength(0);
    expect(cards(section)[0].style.transform).toBe(at(slotPose(0, card)));
  });
});
