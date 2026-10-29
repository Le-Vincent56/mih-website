// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ART_FLIGHT,
  isArtFlightPending,
  returnOnBack,
  returningTo,
  startArtMorph,
  startArtReturn,
} from './artMorph';

interface Played {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let played: Played[] = [];
let reduced = false;

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

beforeEach(() => {
  reduced = false;
  played = [];
  navigate = vi.fn();
  document.body.innerHTML = `
    <div id="root">
      <div data-art-target id="old-hero"><img src="/old.png"></div>
      <ul>
        <li data-art-scope id="item">
          <a data-art-frame id="card" style="border-radius: 15px; border-top-left-radius: 15px; background-color: rgb(253, 52, 86)">
            <img src="/a-960.webp" srcset="/a-960.webp 960w, /a-1600.webp 1600w"
              style="object-position: left center">
          </a>
          <a id="more">View project</a>
        </li>
      </ul>
    </div>`;
  document.getElementById('card')!.getBoundingClientRect = () => rect(749, 212, 634, 475);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query.includes('reduce') && reduced })),
  );
  Element.prototype.animate = vi.fn(function (this: Element, keyframes, options) {
    played.push({
      el: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    return { finished: Promise.resolve(), cancel: vi.fn() } as unknown as Animation;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

let navigate = vi.fn();

const click = (target: Element, init: Partial<MouseEvent> = {}) => ({
  preventDefault: vi.fn(),
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  currentTarget: target,
  ...init,
});

const layer = () => document.querySelector<HTMLElement>('[data-art-flight]');
const box = () => layer()!.querySelector<HTMLElement>('[data-art-flight-box]')!;

/** The new page renders: the old one goes, and a hero at the top of the page arrives. */
function arrive(at = rect(0, 56, 1440, 594)) {
  document.getElementById('root')!.innerHTML = `
    <article><div data-art-target id="new-hero" style="border-radius: 0px"><img src="/h.webp"></div></article>`;
  document.getElementById('new-hero')!.getBoundingClientRect = () => at;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('startArtMorph', () => {
  test("lifts a copy of the card's art into an overlay at the card's place, over a paper fade", async () => {
    const event = click(document.getElementById('more')!);
    startArtMorph(navigate, event);

    // It takes over the link: the page changes only once the paper hides the old one.
    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    expect(layer()).not.toBeNull();
    expect(layer()!.getAttribute('aria-hidden')).toBe('true');
    const b = box();
    expect([b.style.left, b.style.top, b.style.width, b.style.height]).toEqual([
      '749px',
      '212px',
      '634px',
      '475px',
    ]);
    expect(b.style.borderRadius).toBe('15px');
    const art = b.querySelector('img')!;
    expect(art.getAttribute('src')).toBe('/a-960.webp');
    expect(art.style.objectPosition).toBe('left center');

    const fade = played.find((p) => p.el.hasAttribute('data-art-flight-paper'))!;
    expect(fade.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(fade.options.duration).toBe(ART_FLIGHT.fadeOut);
    expect(isArtFlightPending()).toBe(true);
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  test("flies to the new page's hero once it renders, ignoring the old page's hero", async () => {
    startArtMorph(navigate, click(document.getElementById('card')!));
    const flying = box();
    await settle();
    expect(played.some((p) => p.el === flying)).toBe(false);

    arrive();
    await settle();

    const flight = played.find((p) => p.el === flying)!;
    expect(flight.keyframes).toEqual([
      { left: '749px', top: '212px', width: '634px', height: '475px', borderRadius: '15px' },
      {
        left: '0px',
        top: '56px',
        width: '1440px',
        height: '594px',
        borderRadius: expect.stringMatching(/^0(px)?$/),
      },
    ]);
    expect(flight.options).toMatchObject({ duration: ART_FLIGHT.flight, fill: 'forwards' });
  });

  test('after landing, the paper drops away and the overlay is removed', async () => {
    startArtMorph(navigate, click(document.getElementById('card')!));
    arrive();
    await vi.waitFor(() => expect(layer()).toBeNull());

    const reveal = played.find((p) => p.el.hasAttribute('data-art-flight'))!;
    expect(reveal.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(reveal.options.duration).toBe(ART_FLIGHT.reveal);
    expect(isArtFlightPending()).toBe(false);
  });

  test('lifts the site header above the paper while it flies, so the header shows (and slides in) over it', async () => {
    const header = document.createElement('header');
    header.style.position = 'fixed';
    header.style.zIndex = '10';
    document.body.prepend(header);

    startArtMorph(navigate, click(document.getElementById('card')!));
    expect(Number(header.style.zIndex)).toBeGreaterThan(ART_FLIGHT.zIndex);

    arrive();
    await vi.waitFor(() => expect(layer()).toBeNull());
    expect(header.style.zIndex).toBe('10');
  });

  test('gives up and removes the overlay when no new page arrives', async () => {
    vi.useFakeTimers();
    startArtMorph(navigate, click(document.getElementById('card')!));
    await vi.advanceTimersByTimeAsync(ART_FLIGHT.waitForPage + 1);
    expect(layer()).toBeNull();
    expect(isArtFlightPending()).toBe(false);
  });

  test('a second click replaces a flight still running', () => {
    startArtMorph(navigate, click(document.getElementById('card')!));
    startArtMorph(navigate, click(document.getElementById('card')!));
    expect(document.querySelectorAll('[data-art-flight]')).toHaveLength(1);
  });

  test('ignores a handled click (the wheel turning to a neighbor, a drag)', () => {
    const event = click(document.getElementById('card')!, { defaultPrevented: true });
    startArtMorph(navigate, event);
    expect(layer()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('ignores modified and non-primary clicks, which open a new tab', () => {
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      startArtMorph(navigate, click(document.getElementById('card')!, init));
    }
    expect(layer()).toBeNull();
  });

  test('leaves the link alone under reduced motion or without an art scope', () => {
    reduced = true;
    const event = click(document.getElementById('card')!);
    startArtMorph(navigate, event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    reduced = false;
    const stray = document.createElement('a');
    document.body.append(stray);
    startArtMorph(navigate, click(stray));
    expect(layer()).toBeNull();
    expect(isArtFlightPending()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('the return: header back into its card', () => {
  /** A project page with its hero at the top, as the visitor sees it. */
  function projectPage(hero = rect(0, 56, 1440, 594)) {
    document.body.innerHTML = `
      <div id="root">
        <article>
          <div data-art-target id="hero" style="border-top-left-radius: 0px; background-color: rgb(90, 218, 131)">
            <img src="/glv-2560.webp" style="object-position: 0% 50%">
          </div>
          <a id="back" href="/#projects">Projects</a>
        </article>
      </div>`;
    document.getElementById('hero')!.getBoundingClientRect = () => hero;
  }

  /** The homepage renders with the wheel's cards, the returning one at `at`. */
  function homepage(at = rect(749, 212, 634, 475)) {
    document.getElementById('root')!.innerHTML = `
      <section id="projects"><ul>
        <li data-art-scope><a data-art-frame href="/projects/fast-frankie" id="ff"><img src="/ff.webp"></a></li>
        <li data-art-scope><a data-art-frame href="/projects/good-luck-valley" id="glv"
          style="border-top-left-radius: 15px"><img src="/glv.webp"></a></li>
      </ul></section>`;
    document.getElementById('glv')!.getBoundingClientRect = () => at;
  }

  beforeEach(() => {
    projectPage();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  test('the back link fades paper around the hero, then navigates and names the card it returns to', async () => {
    const event = click(document.getElementById('back')!);
    startArtReturn('good-luck-valley', navigate, event);

    expect(event.preventDefault).toHaveBeenCalled();
    const b = box();
    expect([b.style.left, b.style.top, b.style.width, b.style.height]).toEqual([
      '0px',
      '56px',
      '1440px',
      '594px',
    ]);
    expect(b.querySelector('img')!.getAttribute('src')).toBe('/glv-2560.webp');
    expect(b.querySelector('img')!.style.objectPosition).toBe('0% 50%');
    const fade = played.find((p) => p.el.hasAttribute('data-art-flight-paper'))!;
    expect(fade.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(returningTo()).toBe('/projects/good-luck-valley');
    expect(isArtFlightPending()).toBe(false);
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  test("flies from the hero into the returning project's card, rounding its corners", async () => {
    startArtReturn('good-luck-valley', navigate, click(document.getElementById('back')!));
    const flying = box();
    homepage();
    await vi.waitFor(() => expect(played.some((p) => p.el === flying)).toBe(true));

    const flight = played.find((p) => p.el === flying)!;
    expect(flight.keyframes).toEqual([
      {
        left: '0px',
        top: '56px',
        width: '1440px',
        height: '594px',
        borderRadius: expect.stringMatching(/^0(px)?$/),
      },
      { left: '749px', top: '212px', width: '634px', height: '475px', borderRadius: '15px' },
    ]);
    await vi.waitFor(() => expect(layer()).toBeNull());
    expect(returningTo()).toBeNull();
  });

  test('with the hero scrolled away, the art drops in from just above the screen', () => {
    projectPage(rect(0, -2400, 1440, 594));
    startArtReturn('good-luck-valley', navigate, click(document.getElementById('back')!));
    expect(box().style.top).toBe('-594px');
  });

  test('browser Back cuts to paper at once and leaves the navigation to the browser', () => {
    returnOnBack('good-luck-valley');

    expect(layer()).not.toBeNull();
    const paper = layer()!.querySelector<HTMLElement>('[data-art-flight-paper]')!;
    expect(paper.style.opacity).toBe('1');
    expect(played.some((p) => p.el === paper)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(returningTo()).toBe('/projects/good-luck-valley');
  });

  test('brings an off-screen card into view under the paper, then flies to it', async () => {
    returnOnBack('good-luck-valley');
    const flying = box();
    homepage(rect(16, 1400, 343, 257));
    const card = document.getElementById('glv')!;
    card.scrollIntoView = vi.fn(() => {
      card.getBoundingClientRect = () => rect(16, 278, 343, 257);
    });
    await vi.waitFor(() => expect(played.some((p) => p.el === flying)).toBe(true));

    expect(card.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    const flight = played.find((p) => p.el === flying)!;
    expect(flight.keyframes[1]).toMatchObject({ left: '16px', top: '278px' });
  });

  test('also centers a card that is only partly on screen (a phone list item below the fold)', async () => {
    returnOnBack('good-luck-valley');
    homepage(rect(16, 678, 343, 257));
    const card = document.getElementById('glv')!;
    card.scrollIntoView = vi.fn(() => {
      card.getBoundingClientRect = () => rect(16, 278, 343, 257);
    });
    await vi.waitFor(() => expect(card.scrollIntoView).toHaveBeenCalled());
  });

  test("lets the paper drop away without a flight if the card can't be brought into view", async () => {
    returnOnBack('good-luck-valley');
    const flying = box();
    homepage(rect(749, 2400, 634, 475));
    document.getElementById('glv')!.scrollIntoView = vi.fn();
    await vi.waitFor(() => expect(layer()).toBeNull());
    expect(played.some((p) => p.el === flying)).toBe(false);
  });

  test('does nothing under reduced motion or without a hero', () => {
    reduced = true;
    returnOnBack('good-luck-valley');
    const event = click(document.getElementById('back')!);
    startArtReturn('good-luck-valley', navigate, event);
    expect(layer()).toBeNull();
    expect(event.preventDefault).not.toHaveBeenCalled();

    reduced = false;
    document.getElementById('hero')!.remove();
    returnOnBack('good-luck-valley');
    expect(layer()).toBeNull();
  });
});
