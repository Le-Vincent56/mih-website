// The crew lineup and its character select. It drives
// the static markup through data attributes and plays every move on the Web Animations API.
//
// Markup it reads (Crew.tsx renders it):
//   [data-lineup-layer]           the lineup and the hover names (inert while a member is open)
//     [data-hover-name]           one per member, in order: the giant name behind the lineup
//     li[data-member]             one per member, in order, holding
//       [data-member-button]      the button (aria-expanded, aria-controls)
//       [data-silhouette]         the figure
//   [data-select]                 the select screen (inert at rest), holding
//     [data-flood]                the accent flood, colored through --flood
//     article[data-panel]         one per member, in order, style="--accent: …", holding
//       [data-heading]            the h3 (focused on open), holding [data-title] (the name as
//                                 text) and [data-name] (the Koulen name, aria-hidden)
//       [data-portrait], [data-info] ([data-role] inside it)
//     [data-roster] [data-pick]   one tile per member, in order
//     [data-back]                 the back arrow
//   [data-announce]               the live region
// Every fitted name holds a [data-fit-line] (the letters' line) and [data-letter] spans.

import { type Timing, createRunner, easings, settle, shifted, write } from '../motion/animation';
import {
  CREW_MOTION as M,
  SLASH,
  type Hit,
  type Mask,
  alphaMask,
  announcement,
  fitFontSize,
  hoverShape,
  distanceToShape,
  leanFor,
  maskOutline,
  nearestRect,
  pickTopmost,
  rollOffset,
  swipeStep,
  visibleFraction,
  wrapIndex,
} from './select';

export interface CrewSelect {
  /** The member under the pointer or focus, at rest. */
  readonly hovered: number | null;
  /** The member on the select screen, or null at rest. */
  readonly current: number | null;
  hover(index: number | null): void;
  open(index: number): void;
  /** Switches the select screen (dir defaults to the direction of the index). */
  change(index: number, dir?: 1 | -1): void;
  close(): void;
  /** Resolves once no transition is running or held. */
  idle(): Promise<void>;
  /** Stops everything and restores the plain markup. */
  destroy(): void;
}

/** The width at which the section uses its desktop layout. */
export const DESKTOP_QUERY = '(min-width: 960px)';

const HIDDEN_FIGURE: Keyframe = { transform: 'translateY(110%)', opacity: 0 };
const at = (x: number, y = 0): string => `${x}% ${y}%`;

export function createCrewSelect(section: HTMLElement, options: { reduced: boolean }): CrewSelect {
  const { reduced } = options;
  const all = (selector: string, root: ParentNode = section) => [
    ...root.querySelectorAll<HTMLElement>(selector),
  ];
  const one = (selector: string) => section.querySelector<HTMLElement>(selector);

  const lineupLayer = one('[data-lineup-layer]');
  const select = one('[data-select]');
  const flood = one('[data-flood]');
  const back = one('[data-back]');
  const live = one('[data-announce]');
  const items = all('[data-member]');
  const buttons = items.map((li) => li.querySelector<HTMLElement>('[data-member-button]')!);
  const figures = items.map((li) => li.querySelector<HTMLElement>('[data-silhouette]'));
  const hoverNames = all('[data-hover-name]');
  const hoverLetters = hoverNames.map((name) => all('[data-letter]', name));
  const articles = all('[data-panel]');
  const panels = articles.map((article) => ({
    heading: article.querySelector<HTMLElement>('[data-heading]'),
    name: article.querySelector<HTMLElement>('[data-name]'),
    letters: all('[data-letter]', article),
    portrait: article.querySelector<HTMLElement>('[data-portrait]'),
    info: article.querySelector<HTMLElement>('[data-info]'),
    title: article.querySelector('[data-title]')?.textContent?.trim() ?? '',
    role: article.querySelector('[data-role]')?.textContent?.trim() ?? '',
  }));
  const picks = all('[data-pick]');
  const count = Math.min(items.length, articles.length);
  const wideQuery = window.matchMedia?.(DESKTOP_QUERY);
  const isWide = () => wideQuery?.matches ?? true;

  const ease = easings();
  const runner = createRunner();
  const touched = new Set<HTMLElement>();

  // Plays an animation, or under reduced motion only writes its end state.
  const play = (el: HTMLElement | null, frames: Keyframe[], timing: Timing) => {
    if (!el) return null;
    touched.add(el);
    if (reduced) {
      write(el, frames[frames.length - 1]);
      return null;
    }
    return runner.play(el, frames, timing);
  };
  const set = (el: HTMLElement | null, frame: Keyframe) => {
    if (!el) return;
    touched.add(el);
    write(el, frame);
  };
  const done = (animations: (Animation | null)[]) =>
    settle(animations.filter((a): a is Animation => a !== null));

  // Rolls letters up into place. With `resume`, a letter still on its way out (a quick return to
  // the same name) rolls back from where it is instead of jumping below its box first.
  const rollIn = (letters: HTMLElement[], start: number, resume = false) =>
    letters.map((el, i) => {
      // Only letters this controller has rolled (they carry an inline transform) can be mid-roll.
      const rolled = resume && el.style.transform !== '';
      const now = rolled ? rollOffset(getComputedStyle(el).transform, el.offsetHeight) : null;
      const from = now === null || now <= -100 ? 110 : now;
      return play(el, [shifted(from), shifted(0)], {
        duration: M.name.in,
        delay: start + M.name.inStagger * i,
        easing: ease.throw,
      });
    });
  const rollOut = (letters: HTMLElement[]) =>
    letters.map((el, i) =>
      play(el, [{ transform: getComputedStyle(el).transform || 'none' }, shifted(-110)], {
        duration: M.name.out,
        delay: M.name.outStagger * i,
        easing: ease.lift,
      }),
    );
  const rise = (start: number) =>
    figures.map((el, i) =>
      play(
        el,
        [
          HIDDEN_FIGURE,
          { opacity: 1, offset: M.rise.fadeUntil },
          { transform: 'none', opacity: 1 },
        ],
        { duration: M.rise.duration, delay: start + M.rise.stagger * i, easing: ease.lift },
      ),
    );
  // Clears what an article's animations left inline, so its next entrance starts clean.
  const clearPanel = (i: number) => {
    const { portrait, info, letters } = panels[i];
    for (const el of [portrait, info, ...letters]) {
      el?.style.removeProperty('transform');
      el?.style.removeProperty('translate');
      el?.style.removeProperty('opacity');
    }
  };

  // --- Fitting the names -----------------------------------------------------------------------

  const fitOne = (box: HTMLElement | null, maxCap: number) => {
    const line = box?.querySelector('[data-fit-line]');
    if (!box || !line) return;
    touched.add(box);
    box.style.fontSize = '100px';
    const width = line.getBoundingClientRect().width;
    box.style.fontSize = `${Math.round(fitFontSize(width, box.clientWidth, maxCap) * 100) / 100}px`;
  };
  const fit = () => {
    const height = section.clientHeight;
    if (isWide()) for (const name of hoverNames) fitOne(name, M.caps.hover * height);
    const cap = isWide() ? M.caps.select * height : M.caps.phone * window.innerHeight;
    for (const { name } of panels) fitOne(name, cap);
  };

  // --- Hit-testing the figures by their painted pixels -----------------------------------------

  const masks: (Mask | null)[] = figures.map(() => null);
  /** Each figure's painted shape (unpadded) and its outline: the lean measures to them. */
  const shapes: ({ mask: Mask; outline: Float32Array } | null)[] = figures.map(() => null);
  const readMask = (i: number) => {
    const img = figures[i];
    if (!(img instanceof HTMLImageElement)) return;
    const build = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || !w || !h) return;
        context.drawImage(img, 0, 0);
        const painted = alphaMask(context.getImageData(0, 0, w, h).data, w, h, M.hit.cell);
        masks[i] = hoverShape(painted);
        shapes[i] = { mask: painted, outline: maskOutline(painted) };
      } catch {
        masks[i] = null; // An unreadable canvas: the whole rect counts.
      }
    };
    if (img.complete) build();
    else img.addEventListener('load', build, { once: true });
  };
  figures.forEach((_, i) => readMask(i));

  // The member painted at (x, y). Later members paint over earlier ones; the hovered one is on top.
  const pick = (x: number, y: number): number | null => {
    const order = buttons.map((_, i) => i);
    if (hovered !== null) order.push(order.splice(hovered, 1)[0]);
    const hits: Hit[] = order.map((i) => ({
      rect: buttons[i].getBoundingClientRect(),
      mask: masks[i],
    }));
    const found = pickTopmost(hits, x, y);
    return found === null ? null : order[found];
  };

  // --- State -----------------------------------------------------------------------------------

  let hovered: number | null = null;
  let current: number | null = null;
  /** Where the select screen will be once held requests have run. */
  let intended: number | null = null;
  /** The member under the pointer, and the member with visible keyboard focus. */
  let pointerHover: number | null = null;
  let focusHover: number | null = null;
  /** Pending release of the pointer hover while it crosses a gap (CREW_MOTION.hoverGrace). */
  let grace = 0;
  let destroyed = false;
  let busy = false;
  let pending: (() => Promise<void>) | null = null;
  let chain: Promise<void> = Promise.resolve();

  // The hover names' running animations, and the names that may have letters showing (in, or
  // still rolling out). Only one name ever shows: moving to another member cuts every other name
  // at once, and only leaving the lineup rolls a name out.
  const nameRolls = new Map<number, (Animation | null)[]>();
  const showing = new Set<number>();
  // Finished animations are cancelled by the runner (playState 'idle'), so they're dropped here.
  const track = (index: number, animations: (Animation | null)[]) =>
    nameRolls.set(
      index,
      [...(nameRolls.get(index) ?? []), ...animations].filter((a) => a && a.playState !== 'idle'),
    );
  const cutName = (index: number) => {
    for (const animation of nameRolls.get(index) ?? []) animation?.cancel();
    nameRolls.delete(index);
    showing.delete(index);
    for (const el of hoverLetters[index] ?? []) set(el, shifted(110));
  };

  const hover = (index: number | null) => {
    if (destroyed || current !== null || intended !== null || index === hovered) return;
    const previous = hovered;
    hovered = index;
    section.toggleAttribute('data-hover', index !== null);
    items.forEach((li, i) => li.toggleAttribute('data-hovered', i === index));
    if (index !== null) leanToward(null);
    if (!isWide()) return;
    if (index === null) {
      if (previous !== null) track(previous, rollOut(hoverLetters[previous] ?? []));
      return;
    }
    for (const other of [...showing]) if (other !== index) cutName(other);
    track(index, rollIn(hoverLetters[index] ?? [], M.name.inAt, true));
    showing.add(index);
  };

  // How far (x, y) is from a figure's painted shape on screen (from its canvas box when the image
  // couldn't be read). The canvases are wide and overlap, so their boxes can't be used.
  const distanceTo = (i: number, x: number, y: number) => {
    const rect = buttons[i].getBoundingClientRect();
    const shape = shapes[i];
    return shape
      ? distanceToShape(shape.mask, shape.outline, rect, x, y)
      : (nearestRect([rect], x, y)?.distance ?? Infinity);
  };

  // The proximity lean: while the pointer is over the section but on
  // no one, the nearest figure scales up a little, more the closer it gets. Null clears it.
  const leanToward = (point: { clientX: number; clientY: number } | null) => {
    let nearest: { index: number; distance: number } | null = null;
    if (point && !reduced && hovered === null) {
      for (let index = 0; index < buttons.length; index++) {
        const distance = distanceTo(index, point.clientX, point.clientY);
        if (!nearest || distance < nearest.distance) nearest = { index, distance };
      }
    }
    const amount = nearest ? leanFor(nearest.distance) : 0;
    items.forEach((li, i) => {
      if (nearest && i === nearest.index && amount > 0)
        li.style.setProperty('--lean', (1 + amount).toFixed(3));
      else li.style.removeProperty('--lean');
    });
  };

  // The pointer wins while it's over someone; otherwise keyboard focus does.
  const settleHover = () => hover(pointerHover ?? focusHover);
  const endGrace = () => {
    window.clearTimeout(grace);
    grace = 0;
  };

  // Lets go of the hover without rolling the name back out (used as the select screen opens).
  const dropHover = () => {
    if (hovered !== null && isWide()) track(hovered, rollOut(hoverLetters[hovered] ?? []));
    hovered = null;
    pointerHover = null;
    focusHover = null;
    endGrace();
    section.removeAttribute('data-hover');
    items.forEach((li) => li.removeAttribute('data-hovered'));
  };

  const showMember = (index: number | null) => {
    articles.forEach((article, i) => {
      article.toggleAttribute('data-current', i === index);
      article.toggleAttribute('inert', i !== index);
    });
    buttons.forEach((button, i) => button.setAttribute('aria-expanded', String(i === index)));
    picks.forEach((tile, i) => {
      if (i === index) tile.setAttribute('aria-current', 'true');
      else tile.removeAttribute('aria-current');
    });
    if (index !== null && flood) {
      touched.add(flood);
      flood.style.setProperty('--flood', articles[index].style.getPropertyValue('--accent'));
    }
  };

  const scrollToSection = () => {
    const { top } = section.getBoundingClientRect();
    if (Math.abs(top) <= 1) return;
    window.scrollTo({ top: window.scrollY + top, behavior: reduced ? 'auto' : 'smooth' });
  };

  // --- Transitions -----------------------------------------------------------------------------

  const opening = async (index: number) => {
    if (current !== null) return changing(index, index > current ? 1 : -1);
    current = index;
    dropHover();
    section.setAttribute('data-open', '');
    lineupLayer?.toggleAttribute('inert', true);
    select?.toggleAttribute('inert', false);
    showMember(index);
    fit();
    scrollToSection();
    panels[index].heading?.focus({ preventScroll: true });

    const { open: o } = M;
    const panel = panels[index];
    await done([
      play(flood, [{ clipPath: SLASH.start }, { clipPath: SLASH.full }], {
        duration: o.slash,
        delay: 0,
        easing: ease.lift,
      }),
      ...rollIn(panel.letters, o.nameAt),
      play(
        panel.portrait,
        [
          { translate: at(o.portraitFrom), opacity: 0 },
          { translate: at(0), opacity: 1 },
        ],
        { duration: o.portrait, delay: o.portraitAt, easing: ease.throw },
      ),
      play(panel.info, [{ translate: at(-120) }, { translate: at(0) }], {
        duration: o.panel,
        delay: o.panelAt,
        easing: ease.throw,
      }),
      ...picks.map((tile, i) =>
        play(
          tile,
          [
            { translate: at(0, o.rosterFrom), opacity: 0 },
            { translate: at(0), opacity: 1 },
          ],
          { duration: o.roster, delay: o.rosterAt + o.rosterStagger * i, easing: ease.throw },
        ),
      ),
      play(back, [{ opacity: 0 }, { opacity: 1 }], {
        duration: o.arrow,
        delay: o.arrowAt,
        easing: ease.lift,
      }),
    ]);
    if (!destroyed && current === index) section.setAttribute('data-covered', '');
  };

  const changing = async (index: number, dir: 1 | -1) => {
    const from = current;
    if (from === null || index === from || !articles[index]) return;
    const { change: c } = M;
    const old = panels[from];
    const next = panels[index];
    const focusWasInside = articles[from].contains(document.activeElement);
    current = index;
    articles[from].setAttribute('data-leaving', '');
    showMember(index);

    if (focusWasInside) next.heading?.focus({ preventScroll: true });
    else if (live) live.textContent = announcement(next.title, next.role);

    const leaving = done([
      play(
        old.portrait,
        [
          { translate: at(0), opacity: 1 },
          { translate: at(-c.outShift * dir), opacity: 0 },
        ],
        { duration: c.out, delay: 0, easing: ease.lift },
      ),
      ...rollOut(old.letters),
      play(old.info, [{ opacity: 1 }, { opacity: 0 }], {
        duration: c.panelOut,
        delay: 0,
        easing: ease.lift,
      }),
    ]);
    const entering = done([
      ...rollIn(next.letters, c.nameAt),
      play(
        next.portrait,
        [
          { translate: at(c.inShift * dir), opacity: 0 },
          { translate: at(0), opacity: 1 },
        ],
        { duration: c.portrait, delay: c.portraitAt, easing: ease.throw },
      ),
      play(
        next.info,
        [
          { translate: at(0, c.panelFrom), opacity: 0 },
          { translate: at(0), opacity: 1 },
        ],
        { duration: c.panel, delay: c.panelAt, easing: ease.throw },
      ),
    ]);
    await leaving;
    articles[from].removeAttribute('data-leaving');
    clearPanel(from);
    await entering;
  };

  const closing = async () => {
    const index = current;
    if (index === null) return;
    const { close: x } = M;
    const panel = panels[index];
    const focusWasInside = section.contains(document.activeElement);
    section.removeAttribute('data-covered');
    if (live) live.textContent = '';
    for (const figure of figures) set(figure, HIDDEN_FIGURE);

    const rising = rise(x.backAt);
    await done([
      ...rollOut(panel.letters),
      play(
        panel.portrait,
        [
          { translate: at(0), opacity: 1 },
          { translate: at(x.portraitTo), opacity: 0 },
        ],
        { duration: x.out, delay: 0, easing: ease.lift },
      ),
      play(panel.info, [{ translate: at(0) }, { translate: at(-120) }], {
        duration: x.out,
        delay: 0,
        easing: ease.lift,
      }),
      play(back, [{ opacity: 1 }, { opacity: 0 }], {
        duration: x.fade,
        delay: 0,
        easing: ease.lift,
      }),
      ...picks.map((tile, i) =>
        play(tile, [{ opacity: 1 }, { opacity: 0 }], {
          duration: x.fade,
          delay: x.rosterStagger * i,
          easing: ease.lift,
        }),
      ),
      play(flood, [{ clipPath: SLASH.full }, { clipPath: SLASH.gone }], {
        duration: x.wipe,
        delay: x.wipeAt,
        easing: ease.lift,
      }),
    ]);
    if (destroyed) return;

    // The lineup comes back.
    current = null;
    section.removeAttribute('data-open');
    select?.toggleAttribute('inert', true);
    lineupLayer?.toggleAttribute('inert', false);
    showMember(null);
    articles.forEach((article) => article.toggleAttribute('inert', true));
    clearPanel(index);
    for (const el of [back, flood, ...picks]) {
      el?.style.removeProperty('opacity');
      el?.style.removeProperty('translate');
      el?.style.removeProperty('clip-path');
    }
    // On phones the section shrinks back; keep its top on screen (the screen is paper now).
    const { top } = section.getBoundingClientRect();
    if (top < 0) window.scrollTo({ top: window.scrollY + top, behavior: 'auto' });
    if (focusWasInside) buttons[index]?.focus({ preventScroll: true });
    await done(rising);
  };

  /** Runs an action now, or holds it (replacing any held one) until the running one ends. */
  const request = (action: () => Promise<void>) => {
    if (destroyed) return;
    if (busy) {
      pending = action;
      return;
    }
    busy = true;
    chain = (async () => {
      let next: (() => Promise<void>) | null = action;
      while (next && !destroyed) {
        pending = null;
        await next();
        next = pending;
      }
      busy = false;
      pending = null;
    })();
  };

  // --- Arrival ---------------------------------------------------------------------------------

  let entered = false;
  let observer: IntersectionObserver | undefined;

  const arrive = (animate: boolean) => {
    if (entered) return;
    entered = true;
    observer?.disconnect();
    if (animate) {
      rise(0);
      return;
    }
    for (const figure of figures) {
      figure?.style.removeProperty('transform');
      figure?.style.removeProperty('opacity');
    }
  };

  const startsHidden =
    !reduced &&
    typeof IntersectionObserver !== 'undefined' &&
    visibleFraction(section.getBoundingClientRect(), window.innerHeight) < M.arrival;
  if (startsHidden) {
    for (const figure of figures) set(figure, HIDDEN_FIGURE);
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.intersectionRatio >= M.arrival)) arrive(true);
      },
      { threshold: M.arrival },
    );
    observer.observe(section);
  } else entered = true;

  // --- Input -----------------------------------------------------------------------------------

  const open = (index: number) => {
    if (destroyed || index < 0 || index >= count) return;
    arrive(false);
    leanToward(null);
    const from = intended;
    intended = index;
    request(() => (from === null ? opening(index) : changing(index, index > from ? 1 : -1)));
  };

  const change = (index: number, dir?: 1 | -1) => {
    if (destroyed || intended === null || index === intended || index < 0 || index >= count) return;
    const direction = dir ?? (index > intended ? 1 : -1);
    intended = index;
    request(() => changing(index, direction));
  };

  const close = () => {
    if (destroyed || intended === null) return;
    intended = null;
    request(closing);
  };

  const step = (delta: 1 | -1) => {
    if (intended === null || count < 2) return;
    change(wrapIndex(intended, delta, count), delta);
  };

  const isFine = (event: Event) => (event as PointerEvent).pointerType !== 'touch';

  const onPointerMove = (event: PointerEvent) => {
    if (!isFine(event) || intended !== null) return;
    const found = pick(event.clientX, event.clientY);
    section.toggleAttribute('data-pointing', found !== null);
    if (found !== null) {
      endGrace();
      pointerHover = found;
      settleHover();
    } else if (pointerHover !== null && !grace) {
      // Over no one: hold the hover briefly, so crossing a gap doesn't flicker it off and on.
      grace = window.setTimeout(() => {
        grace = 0;
        pointerHover = null;
        settleHover();
      }, M.hoverGrace);
    }
    leanToward(found === null ? event : null);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (!isFine(event)) return;
    endGrace();
    section.removeAttribute('data-pointing');
    leanToward(null);
    pointerHover = null;
    settleHover();
  };

  const onLineupClick = (event: MouseEvent) => {
    const button = (event.target as Element | null)?.closest('[data-member-button]');
    // A keyboard click (detail 0) means the focused button; a pointer click means the painted pixel.
    const index =
      event.detail === 0
        ? buttons.indexOf(button as HTMLElement)
        : pick(event.clientX, event.clientY);
    if (index === null || index < 0) return;
    open(index);
  };

  const onFocusIn = (event: FocusEvent) => {
    const index = buttons.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    arrive(false);
    let visible = true;
    try {
      visible = (event.target as HTMLElement).matches(':focus-visible');
    } catch {
      // Older engines: treat every focus as visible.
    }
    if (!visible) return;
    focusHover = index;
    hover(index);
  };
  const onFocusOut = (event: FocusEvent) => {
    if (buttons.includes(event.relatedTarget as HTMLElement)) return;
    focusHover = null;
    settleHover();
  };

  const onKey = (event: KeyboardEvent) => {
    if (intended === null) return;
    const target = event.target as Node | null;
    if (target !== document.body && !section.contains(target)) return;
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'ArrowLeft') step(-1);
    else return;
    event.preventDefault();
  };

  const onPick = (event: MouseEvent) => {
    const tile = (event.target as Element | null)?.closest<HTMLElement>('[data-pick]');
    if (tile) change(picks.indexOf(tile));
  };
  const onBack = () => close();

  let swipeFrom: { x: number; y: number } | null = null;
  const onSwipeStart = (event: PointerEvent) => {
    swipeFrom = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  };
  const onSwipeEnd = (event: PointerEvent) => {
    if (!swipeFrom || event.pointerType !== 'touch') return;
    const delta = swipeStep(event.clientX - swipeFrom.x, event.clientY - swipeFrom.y);
    swipeFrom = null;
    if (delta !== 0) step(delta);
  };

  let frame = 0;
  const onResize = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fit();
    });
  };
  const onWidthChange = () => {
    hover(null);
    fit();
  };

  section.addEventListener('pointermove', onPointerMove);
  section.addEventListener('pointerleave', onPointerLeave);
  lineupLayer?.addEventListener('click', onLineupClick);
  lineupLayer?.addEventListener('focusin', onFocusIn);
  lineupLayer?.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKey);
  select?.querySelector('[data-roster]')?.addEventListener('click', onPick as EventListener);
  back?.addEventListener('click', onBack);
  select?.addEventListener('pointerdown', onSwipeStart);
  select?.addEventListener('pointerup', onSwipeEnd);
  window.addEventListener('resize', onResize);
  wideQuery?.addEventListener?.('change', onWidthChange);

  // --- Start -----------------------------------------------------------------------------------

  section.setAttribute('data-crew', 'ready');
  select?.toggleAttribute('inert', true);
  articles.forEach((article) => article.toggleAttribute('inert', true));
  fit();

  return {
    get hovered() {
      return hovered;
    },
    get current() {
      return current;
    },
    hover,
    open,
    change,
    close,
    idle: async () => {
      // A held request starts only once the running one ends, so wait until the chain settles.
      let last: Promise<void>;
      do {
        last = chain;
        await last;
      } while (last !== chain);
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
      runner.cancelAll();
      if (frame) cancelAnimationFrame(frame);
      endGrace();
      section.removeEventListener('pointermove', onPointerMove);
      leanToward(null);
      section.removeEventListener('pointerleave', onPointerLeave);
      lineupLayer?.removeEventListener('click', onLineupClick);
      lineupLayer?.removeEventListener('focusin', onFocusIn);
      lineupLayer?.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKey);
      select?.querySelector('[data-roster]')?.removeEventListener('click', onPick as EventListener);
      back?.removeEventListener('click', onBack);
      select?.removeEventListener('pointerdown', onSwipeStart);
      select?.removeEventListener('pointerup', onSwipeEnd);
      window.removeEventListener('resize', onResize);
      wideQuery?.removeEventListener?.('change', onWidthChange);

      for (const name of ['data-crew', 'data-open', 'data-hover', 'data-covered', 'data-pointing'])
        section.removeAttribute(name);
      items.forEach((li) => li.removeAttribute('data-hovered'));
      for (const article of articles) {
        article.removeAttribute('data-current');
        article.removeAttribute('data-leaving');
        article.removeAttribute('inert');
      }
      lineupLayer?.removeAttribute('inert');
      select?.removeAttribute('inert');
      buttons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
      picks.forEach((tile) => tile.removeAttribute('aria-current'));
      for (const el of touched) {
        for (const prop of [
          'transform',
          'translate',
          'opacity',
          'clip-path',
          'font-size',
          '--flood',
        ])
          el.style.removeProperty(prop);
      }
      if (live) live.textContent = '';
    },
  };
}
