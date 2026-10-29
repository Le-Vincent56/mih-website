// The card-to-hero morph and its return: an "art flight". A copy of
// the art lifts into a fixed overlay while paper hides the old page; only then does the route
// change, so the new page renders out of sight; the box flies to its place on the new page,
// re-cropping live (object-fit: cover), so it lands on the exact pixels; then the paper drops away.
//
// - Forward: a card (or the next project banner) grows into the new page's hero.
// - Return: the hero shrinks back into its card on the homepage, from the back link or from the
//   browser's Back button (which changes the page itself, so the paper cuts in at once).
//
// Not View Transitions: they morph raster snapshots, so a 4:3 card crop scaled into the wide hero
// is magnified and cropped wrong until the real hero fades in over it.
//
// Call the click starters from the link's onClick with the navigation to run: they run after the
// wheel's native listener, which prevents the click when it turns to a neighbor instead. When they
// take the click they prevent the default, so React Router's own handler leaves it to them.

import { easings } from '../motion/animation';

export const ART_FLIGHT = {
  /** The old page fading to paper. */
  fadeOut: 300,
  /** The box flying between the card and the hero. */
  flight: 900,
  /** The paper dropping away to show the new page. */
  reveal: 200,
  /** How long to wait for the new page's art before giving up. */
  waitForPage: 1500,
  /** How long, after landing, to wait for the landing spot's own image. */
  waitForImage: 600,
  /** The overlay's stacking level; the site header is lifted just above it during a flight. */
  zIndex: 100,
};

/** The parts of a click this needs (React's and the DOM's mouse events both fit). */
export interface ArtClick {
  preventDefault(): void;
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  currentTarget: EventTarget | null;
}

type Kind = 'forward' | 'return';

let current: { kind: Kind; returning: string | null; stop: () => void } | null = null;

/** True while a card's art is on its way to a project page: the page then arrives as a morph. */
export const isArtFlightPending = (): boolean => current?.kind === 'forward';

/** The card link (`/projects/<slug>`) a hero is flying back into, so the wheel opens on it. */
export const returningTo = (): string | null =>
  current?.kind === 'return' ? current.returning : null;

const cardHref = (slug: string) => `/projects/${slug}`;

// --- Helpers ---------------------------------------------------------------------------------

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const px = (n: number) => `${n}px`;
const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const boxFrame = (r: Box, radius: string): Keyframe => ({
  left: px(r.left),
  top: px(r.top),
  width: px(r.width),
  height: px(r.height),
  borderRadius: radius,
});

const onScreen = (r: Box) =>
  r.top < window.innerHeight && r.top + r.height > 0 && r.left < window.innerWidth;
const fullyOnScreen = (r: Box) => r.top >= 0 && r.top + r.height <= window.innerHeight;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const canAnimate = () => typeof Element.prototype.animate === 'function' && !reducedMotion();

const plainClick = (event: ArtClick) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);

/** The first element `find` returns, now or after a later change to the page; null on timeout. */
function waitFor(find: () => HTMLElement | null, timeout: number): Promise<HTMLElement | null> {
  const present = find();
  if (present) return Promise.resolve(present);
  return new Promise((resolve) => {
    const done = (found: HTMLElement | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(found);
    };
    // Mutation callbacks run after React's commit, so the scroll reset has already happened.
    const observer = new MutationObserver(() => {
      const found = find();
      if (found) done(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => done(null), timeout);
  });
}

/** Two frames: long enough for effects (the wheel placing its cards) to run after a render. */
const twoFrames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/**
 * Lifts the site header (the page's fixed <header>) above the overlay for a flight, so it shows
 * over the paper instead of leaving a blank band; its own scroll-driven slide plays as the route
 * changes. Returns the undo.
 */
function liftHeader(): () => void {
  const header = [...document.querySelectorAll<HTMLElement>('header')].find(
    (el) => getComputedStyle(el).position === 'fixed',
  );
  if (!header) return () => {};
  const before = header.style.zIndex;
  header.style.zIndex = String(ART_FLIGHT.zIndex + 1);
  return () => {
    header.style.zIndex = before;
  };
}

/** Resolves once the image can paint, or after `timeout`. */
function imageReady(img: HTMLImageElement | null, timeout: number): Promise<void> {
  const decoded = img?.decode ? img.decode().catch(() => undefined) : Promise.resolve();
  return Promise.race([decoded, new Promise<void>((resolve) => setTimeout(resolve, timeout))]);
}

// --- The flight ------------------------------------------------------------------------------

/** What lifts off: a box at `rect` showing `image` the way its frame showed it. */
interface Source {
  rect: Box;
  radius: string;
  fill: string;
  image: HTMLImageElement;
}

function sourceOf(frame: HTMLElement, image: HTMLImageElement, rect?: Box): Source {
  const style = getComputedStyle(frame);
  return {
    rect: rect ?? boxOf(frame.getBoundingClientRect()),
    radius: style.borderTopLeftRadius || '0px',
    fill: style.backgroundColor,
    image,
  };
}

interface Flight {
  kind: Kind;
  returning?: string;
  source: Source;
  /** Paper fades over the old page first, or (browser Back) is there at once. */
  paper: 'fade' | 'instant';
  /** Runs once the paper hides the old page; null when the browser is already navigating. */
  navigate: (() => void) | null;
  /** The landing spot on the new page. */
  findTarget: () => HTMLElement | null;
  /** Wait for the new page's effects to place the target, and bring it into view if it isn't. */
  settle?: boolean;
}

function fly(flight: Flight): void {
  current?.stop();
  const { source } = flight;
  const ease = easings();

  const layer = document.createElement('div');
  layer.setAttribute('data-art-flight', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = `position: fixed; inset: 0; z-index: ${ART_FLIGHT.zIndex}; pointer-events: none;`;

  const paper = document.createElement('div');
  paper.setAttribute('data-art-flight-paper', '');
  paper.style.cssText = 'position: absolute; inset: 0; background: var(--mih-paper); opacity: 0;';

  const box = document.createElement('div');
  box.setAttribute('data-art-flight-box', '');
  box.style.cssText = 'position: fixed; overflow: hidden;';
  Object.assign(box.style, {
    left: px(source.rect.left),
    top: px(source.rect.top),
    width: px(source.rect.width),
    height: px(source.rect.height),
    borderRadius: source.radius,
    backgroundColor: source.fill,
  });

  // The image as it is (already loaded), cropped the same way; it re-crops as the box resizes.
  const art = document.createElement('img');
  art.alt = '';
  art.src = source.image.currentSrc || source.image.getAttribute('src') || '';
  art.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: cover;';
  const imageStyle = getComputedStyle(source.image);
  art.style.objectPosition = imageStyle.objectPosition || source.image.style.objectPosition;
  const zoom = imageStyle.transform && imageStyle.transform !== 'none' ? imageStyle.transform : '';

  box.append(art);
  layer.append(paper, box);
  document.body.append(layer);

  const lowerHeader = liftHeader();
  let stopped = false;
  const stop = () => {
    stopped = true;
    layer.remove();
    lowerHeader();
    if (current?.stop === stop) current = null;
  };
  current = { kind: flight.kind, returning: flight.returning ?? null, stop };

  let cleared: Promise<unknown> = Promise.resolve();
  if (flight.paper === 'instant') paper.style.opacity = '1';
  else {
    cleared = paper
      .animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ART_FLIGHT.fadeOut,
        easing: ease.lift,
        fill: 'forwards',
      })
      .finished.catch(() => undefined);
  }

  const dropPaper = async () => {
    if (stopped) return;
    const reveal = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ART_FLIGHT.reveal,
      easing: ease.lift,
      fill: 'forwards',
    });
    await reveal.finished.catch(() => undefined);
    stop();
  };

  cleared
    .then(() => {
      if (stopped) return null;
      const arrival = waitFor(flight.findTarget, ART_FLIGHT.waitForPage);
      flight.navigate?.();
      return arrival;
    })
    .then(async (target) => {
      if (stopped) return;
      if (!target) {
        stop();
        return;
      }
      if (flight.settle) await twoFrames();
      if (stopped) return;
      let to = boxOf(target.getBoundingClientRect());
      if (flight.settle && !fullyOnScreen(to)) {
        // Under the paper, a scroll doesn't show: bring the card into view (a phone list's later
        // items sit below the Projects section's top), then measure again.
        target.scrollIntoView?.({ block: 'center' });
        await twoFrames();
        if (stopped) return;
        to = boxOf(target.getBoundingClientRect());
        if (!onScreen(to)) {
          await dropPaper();
          return;
        }
      }
      const toRadius = getComputedStyle(target).borderTopLeftRadius || '0px';
      const landed = imageReady(
        target.querySelector('img'),
        ART_FLIGHT.flight + ART_FLIGHT.waitForImage,
      );
      const timing = { duration: ART_FLIGHT.flight, easing: ease.lift, fill: 'forwards' as const };
      const move = box.animate(
        [boxFrame(source.rect, source.radius), boxFrame(to, toRadius)],
        timing,
      );
      // A card zoomed by its hover settles back to the hero's scale on the way.
      if (zoom) art.animate([{ transform: zoom }, { transform: 'none' }], timing);
      await move.finished.catch(() => undefined);
      await landed;
      await dropPaper();
    });
}

// --- Forward: card to hero -------------------------------------------------------------------

/** A card (or the next project banner) clicked: its art grows into the new page's hero. */
export function startArtMorph(navigate: () => void, event: ArtClick): void {
  if (!plainClick(event) || !canAnimate()) return;
  const link = event.currentTarget instanceof Element ? event.currentTarget : null;
  const frame = link?.closest('[data-art-scope]')?.querySelector<HTMLElement>('[data-art-frame]');
  const image = frame?.querySelector('img');
  if (!frame || !image) return;

  event.preventDefault();
  // The new page's hero: a [data-art-target] that wasn't on the page at the click.
  const old = document.querySelector('[data-art-target]');
  fly({
    kind: 'forward',
    source: sourceOf(frame, image),
    paper: 'fade',
    navigate,
    findTarget: () => {
      const target = document.querySelector<HTMLElement>('[data-art-target]');
      return target && target !== old ? target : null;
    },
  });
}

// --- Return: hero to card --------------------------------------------------------------------

/** The hero as it is on screen; scrolled above the screen, it starts just above the top edge. */
function heroSource(): Source | null {
  const hero = document.querySelector<HTMLElement>('[data-art-target]');
  const image = hero?.querySelector('img');
  if (!hero || !image) return null;
  const r = boxOf(hero.getBoundingClientRect());
  return sourceOf(hero, image, r.top + r.height <= 0 ? { ...r, top: -r.height } : r);
}

function flyBack(slug: string, paper: Flight['paper'], navigate: (() => void) | null): boolean {
  const source = heroSource();
  if (!source) return false;
  const href = cardHref(slug);
  fly({
    kind: 'return',
    returning: href,
    source,
    paper,
    navigate,
    findTarget: () => document.querySelector<HTMLElement>(`[data-art-frame][href="${href}"]`),
    settle: true,
  });
  return true;
}

/** The project page's back link clicked: the hero shrinks back into its card on the homepage. */
export function startArtReturn(slug: string, navigate: () => void, event: ArtClick): void {
  if (!plainClick(event) || !canAnimate()) return;
  if (flyBack(slug, 'fade', navigate)) event.preventDefault();
}

/**
 * The browser's Back button, from a project page to the homepage: the browser is already changing
 * the page, so paper cuts in at once around the hero (still on screen while React re-renders).
 */
export function returnOnBack(slug: string): void {
  if (!canAnimate()) return;
  flyBack(slug, 'instant', null);
}
