// The desktop projects wheel and grid (projects, "Motion" and "Links and interaction").
// It drives the static markup through data attributes and plays every move on the Web
// Animations API, since each card's path depends on measured rects (the wheel spot and the grid
// cells the browser lays out).
//
// Markup it reads (Projects.tsx renders it):
//   [data-wheel-spot]               the card-sized box where the current card sits
//   li[data-project]                one per project, in order, holding:
//     [data-card]                   the card link
//     [data-info]                   the info column (inert while not current)
//     [data-letter]                 the roll title's letters
//     [data-piece="title" | "status" | "description" | "link"]
//   [data-controls], [data-step="-1" | "1"] (each holding a [data-ink] hover fill),
//   [data-counter], [data-announce],
//   [data-view-button="wheel" | "grid"]
// and, around the section, the scroll hold's [data-hold] wrapper.

import { type ProjectsView, rememberView } from './projectsView';
import { type Timing, createRunner, easings, settle, shifted, write } from '../motion/animation';
import { attachHoverFill } from './hoverFill';
import { createWheelGesture } from './wheelGesture';
import {
  PROJECTS_MOTION as M,
  type Pose,
  type Rect,
  type Size,
  type RollBox,
  announcement,
  clearedDelays,
  counterText,
  pieceDelays,
  placePose,
  poseTransform,
  rollFrom,
  rollTo,
  slotPose,
  slotZ,
  stepTarget,
  visibleFraction,
} from './wheel';

export type View = 'wheel' | 'grid';

export interface ProjectsWheel {
  readonly current: number;
  readonly view: View;
  /** Turns the wheel to a project (held until a running transition ends). */
  goTo(index: number): void;
  showGrid(): void;
  showWheel(): void;
  /** Resolves once no transition is running or held. */
  idle(): Promise<void>;
  /** Stops everything and restores the plain markup. */
  destroy(): void;
}

interface Item {
  card: HTMLElement;
  info: HTMLElement | null;
  title: string;
  /** The info column's pieces in roll order: letters, then status, description, link. */
  rollPieces: HTMLElement[];
  /** Each roll piece's kind: 'letter', or its block's name. */
  rollKinds: string[];
  /** The grid caption's pieces: title, then status. */
  captionPieces: HTMLElement[];
  letterCount: number;
}

const IDENTITY: Pose = slotPose(0, { width: 0, height: 0 });

function rectOf(el: Element): Rect {
  const { left, top, width, height } = el.getBoundingClientRect();
  return { left, top, width, height };
}

const sizeOf = ({ width, height }: Rect): Size => ({ width, height });

function readItem(root: HTMLElement): Item {
  const pick = (name: string) => root.querySelector<HTMLElement>(`[data-piece="${name}"]`);
  const letters = [...root.querySelectorAll<HTMLElement>('[data-letter]')];
  const blocks = ['status', 'description', 'link']
    .map((kind) => ({ kind, el: pick(kind) }))
    .filter((block): block is { kind: string; el: HTMLElement } => block.el !== null);
  return {
    card: root.querySelector<HTMLElement>('[data-card]')!,
    info: root.querySelector<HTMLElement>('[data-info]'),
    title: pick('title')?.textContent?.trim() ?? '',
    rollPieces: [...letters, ...blocks.map((block) => block.el)],
    rollKinds: [...letters.map(() => 'letter'), ...blocks.map((block) => block.kind)],
    captionPieces: [pick('title'), pick('status')].filter((el) => el !== null),
    letterCount: letters.length,
  };
}

export interface ProjectsWheelOptions {
  /** The card link (`/projects/<slug>`) to open on: a visitor coming back from that project's page.
   * The first project otherwise. */
  start?: string;
  /** The view to open in, composed: the one the visitor last chose. The wheel otherwise. */
  view?: ProjectsView;
}

export function createProjectsWheel(
  section: HTMLElement,
  options: ProjectsWheelOptions = {},
): ProjectsWheel {
  const items = [...section.querySelectorAll<HTMLElement>('[data-project]')]
    .map(readItem)
    .filter((item) => item.card);
  const count = items.length;
  const spot = section.querySelector<HTMLElement>('[data-wheel-spot]');
  const controls = section.querySelector<HTMLElement>('[data-controls]');
  const counter = section.querySelector<HTMLElement>('[data-counter]');
  const live = section.querySelector<HTMLElement>('[data-announce]');
  const stepButtons = [...section.querySelectorAll<HTMLElement>('[data-step]')];
  const viewButtons = [...section.querySelectorAll<HTMLElement>('[data-view-button]')];
  const holder = section.parentElement?.hasAttribute('data-hold') ? section.parentElement : null;
  const ease = easings();

  const startAt = items.findIndex((item) => item.card.getAttribute('href') === options.start);
  let current = Math.max(0, startAt);
  let intended = current;
  let view: View = 'wheel';
  let destroyed = false;
  let busy = false;
  let dirty = false;
  let pending: (() => Promise<void>) | null = null;
  let chain: Promise<void> = Promise.resolve();
  const { run, running, cancelAll } = createRunner();

  const measure = (): Size =>
    spot ? sizeOf(rectOf(spot)) : sizeOf(rectOf(items[0]?.card ?? section));
  let size = measure();
  const sizes: Size[] = items.map(() => size);
  const poses: Pose[] = items.map(() => IDENTITY);

  // --- Animating -------------------------------------------------------------------------------

  const cardFrame = (i: number, pose: Pose): Keyframe => ({
    transform: poseTransform(pose, sizes[i]),
    opacity: pose.opacity,
  });

  const place = (i: number, pose: Pose) => {
    poses[i] = pose;
    write(items[i].card, cardFrame(i, pose));
  };

  const move = (i: number, pose: Pose, timing: Timing) => {
    const animation = run(items[i].card, cardFrame(i, poses[i]), cardFrame(i, pose), timing);
    poses[i] = pose;
    return animation;
  };

  const stackZ = (i: number) => String(i === current ? 50 : slotZ(i - current));

  const setInfo = (i: number, percent: number) =>
    items[i].rollPieces.forEach((el) => write(el, shifted(percent)));

  /** Each roll piece's delay, from the info's start. */
  const rollDelays = (i: number, start: number) =>
    pieceDelays(items[i].letterCount).map((delay) => start + delay);

  /** The roll pieces' clip boxes (their parents, which never move). */
  const rollBoxes = (i: number): RollBox[] =>
    items[i].rollPieces.map((el, k) => ({
      ...rectOf(el.parentElement ?? el),
      kind: items[i].rollKinds[k],
    }));

  const rollInfo = (i: number, mode: 'in' | 'out', direction: 1 | -1, delays: number[]) =>
    items[i].rollPieces.map((el, k) =>
      mode === 'out'
        ? run(el, shifted(0), shifted(rollTo(direction)), {
            duration: M.roll,
            delay: delays[k],
            easing: ease.lift,
          })
        : run(el, shifted(rollFrom(direction)), shifted(0), {
            duration: M.roll,
            delay: delays[k],
            easing: ease.throw,
          }),
    );

  const fade = (to: number, delay: number) =>
    controls
      ? [
          run(
            controls,
            { opacity: 1 - to },
            { opacity: to },
            {
              duration: M.controlsFade,
              delay,
              easing: ease.lift,
            },
          ),
        ]
      : [];

  // --- State shown in the markup ---------------------------------------------------------------

  /** The toggle shows the view being switched to from the moment it's chosen. */
  const pressView = (target: View) => {
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.viewButton === target));
    }
  };

  const update = (announce: boolean) => {
    section.dataset.view = view;
    items.forEach((item, i) => {
      item.card.parentElement?.toggleAttribute('data-current', view === 'wheel' && i === current);
      item.info?.toggleAttribute('inert', view === 'wheel' && i !== current);
    });
    if (counter) counter.textContent = counterText(current, count);
    for (const button of stepButtons) {
      const blocked = stepTarget(current, Number(button.dataset.step), count) === null;
      button.setAttribute('aria-disabled', String(blocked));
    }
    pressView(view);
    if (announce && live) live.textContent = announcement(items[current].title, current, count);
  };

  /**
   * Switches the layout without moving the section on screen. The scroll hold exists only in the
   * wheel view (projects, "Scroll hold"), so a switch adds or removes it, and a section pinned in
   * it or scrolled past it would jump by up to the hold's length.
   */
  const keepPlace = (change: () => void) => {
    const before = section.getBoundingClientRect().top;
    change();
    if (!holder) return;
    const outer = holder.getBoundingClientRect();
    const hold = outer.height - section.getBoundingClientRect().height;
    // Unpinned, the section sits at the wrapper's top; a section above the screen's top must end
    // up past the hold, a hold's length lower.
    const target = before < 0 ? outer.top + hold : outer.top;
    if (target !== before)
      window.scrollTo({ top: window.scrollY + target - before, behavior: 'auto' });
  };

  // --- Transitions -----------------------------------------------------------------------------

  const fan = async () => {
    const animations = items.map((item, i) => {
      item.card.style.zIndex = String(slotZ(i - current));
      return move(i, slotPose(i - current, size), {
        duration: M.step,
        delay: 0,
        easing: ease.lift,
      });
    });
    animations.push(...rollInfo(current, 'in', 1, rollDelays(current, M.step * M.rollInAt)));
    animations.push(...fade(1, M.step * M.controlsAt));
    await settle(animations);
  };

  const step = async (target: number) => {
    if (view !== 'wheel' || target === current || target < 0 || target >= count) return;
    const direction = target > current ? 1 : -1;
    const from = current;
    current = target;
    update(true);
    size = measure();
    const animations = items.map((item, i) => {
      sizes[i] = size;
      item.card.style.zIndex = String(slotZ(i - target));
      return move(i, slotPose(i - target, size), { duration: M.step, delay: 0, easing: ease.lift });
    });
    const outDelays = rollDelays(from, 0);
    const inDelays = clearedDelays(
      rollBoxes(target),
      rollDelays(target, M.step * M.rollInAt),
      rollBoxes(from),
      outDelays,
    );
    animations.push(...rollInfo(from, 'out', direction, outDelays));
    animations.push(...rollInfo(target, 'in', direction, inDelays));
    await settle(animations);
  };

  const toGrid = async () => {
    if (view === 'grid' || count < 2) return;
    pressView('grid');
    size = measure();
    const gather = items.map((item, i) => {
      item.card.style.zIndex = stackZ(i);
      return move(i, slotPose(0, size), { duration: M.gather, delay: 0, easing: ease.lift });
    });
    rollInfo(current, 'out', 1, rollDelays(current, 0));
    fade(0, 0);
    await settle(gather);
    if (destroyed) return;

    // The stack moment: switch the layout, then start each card from the spot (a FLIP).
    keepPlace(() => {
      view = 'grid';
      update(false);
    });
    rememberView('grid');
    const target = rectOf(spot ?? items[0].card);
    const cells = items.map((item) => {
      item.card.style.transform = '';
      return rectOf(item.card);
    });
    const deal = items.map((item, i) => {
      sizes[i] = sizeOf(cells[i]);
      place(i, placePose(cells[i], target));
      const delay = i * M.dealStagger;
      item.captionPieces.forEach((el, k) =>
        run(el, shifted(110), shifted(0), {
          duration: M.captionRoll,
          delay: delay + M.captionAt * M.deal + k * M.captionStatusDelay,
          easing: ease.throw,
        }),
      );
      return move(i, IDENTITY, { duration: M.deal, delay, easing: ease.throw });
    });
    await settle([...deal, ...running]);
  };

  const toWheel = async () => {
    if (view === 'wheel') return;
    pressView('wheel');
    size = measure();
    const target = rectOf(spot ?? items[0].card);
    const converge = items.map((item, i) => {
      item.captionPieces.forEach((el, k) =>
        run(el, shifted(0), shifted(-110), {
          duration: M.captionOut,
          delay: i * M.captionOutStagger + k * M.captionStatusDelay,
          easing: ease.lift,
        }),
      );
      item.card.style.zIndex = stackZ(i);
      const cell = rectOf(item.card);
      sizes[i] = sizeOf(cell);
      return move(i, placePose(cell, target), {
        duration: M.gather,
        delay: i * M.dealStagger,
        easing: ease.lift,
      });
    });
    await settle([...converge, ...running]);
    if (destroyed) return;

    // The stack moment: switch back to the wheel layout, every card on the spot.
    keepPlace(() => {
      view = 'wheel';
      update(false);
    });
    rememberView('wheel');
    items.forEach((_, i) => {
      sizes[i] = size;
      place(i, slotPose(0, size));
      setInfo(i, 110);
    });
    await fan();
  };

  // --- Requests --------------------------------------------------------------------------------

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
      if (dirty && !destroyed) {
        dirty = false;
        relayout();
      }
    })();
  };

  let entered = false;
  let observer: IntersectionObserver | undefined;

  const enter = () => {
    if (entered) return;
    entered = true;
    observer?.disconnect();
    request(fan);
  };

  const goTo = (index: number) => {
    if (!entered) return enter();
    if (index < 0 || index >= count) return;
    intended = index;
    request(() => step(index));
  };

  const relayout = () => {
    if (busy) {
      dirty = true;
      return;
    }
    if (view !== 'wheel') return;
    size = measure();
    items.forEach((_, i) => {
      sizes[i] = size;
      place(i, slotPose(entered ? i - current : 0, size));
    });
  };

  // --- Input -----------------------------------------------------------------------------------

  const cardIndex = (target: EventTarget | null) => {
    const card = target instanceof Element ? target.closest('[data-card]') : null;
    return items.findIndex((item) => item.card === card);
  };

  // A press on a card: the click that follows is judged against the wheel as it was pressed, and
  // touch presses never drag (vertical swipes belong to the page's scroll).
  let press: { current: number; y: number; dragged: boolean; touch: boolean } | null = null;

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const stepButton = target?.closest<HTMLElement>('[data-step]');
    if (stepButton) {
      const next = stepTarget(intended, Number(stepButton.dataset.step), count);
      if (next !== null) goTo(next);
      return;
    }
    const viewButton = target?.closest<HTMLElement>('[data-view-button]');
    if (viewButton) {
      request(viewButton.dataset.viewButton === 'grid' ? toGrid : toWheel);
      return;
    }
    const index = cardIndex(target);
    const held = press;
    press = null;
    if (index < 0 || view !== 'wheel') return;
    if (held?.dragged) {
      event.preventDefault();
      return;
    }
    if (index !== (held ? held.current : current)) {
      event.preventDefault();
      goTo(index);
    }
  };

  const onFocus = (event: FocusEvent) => {
    const index = cardIndex(event.target);
    if (press || index < 0 || view !== 'wheel' || index === intended) return;
    goTo(index);
  };

  const onKey = (event: KeyboardEvent) => {
    if (view !== 'wheel') return;
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const next = delta === 0 ? null : stepTarget(intended, delta, count);
    if (next === null) return;
    event.preventDefault();
    goTo(next);
  };

  const onPointerDown = (event: PointerEvent) => {
    const index = cardIndex(event.target);
    if (index < 0 || view !== 'wheel') return;
    press = { current, y: event.clientY, dragged: false, touch: event.pointerType === 'touch' };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (press && !press.touch && Math.abs(event.clientY - press.y) > M.dragClick) {
      press.dragged = true;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!press) return;
    const dy = event.clientY - press.y;
    if (!press.touch && Math.abs(dy) > M.dragStep) {
      const next = stepTarget(intended, dy < 0 ? 1 : -1, count);
      if (next !== null) goTo(next);
    }
    // The click (if any) follows in the same task; drop the press after it.
    setTimeout(() => (press = null), 0);
  };

  // A wheel or trackpad gesture is decided by its first event: it turns the wheel one step if it
  // starts over a card while the section is pinned at the screen's top and the wheel can still
  // turn that way, and its momentum is then taken even once the cards move from under the pointer.
  // Any other gesture is the page's, as is one the browser won't let us stop (Chrome makes the rest
  // of a scroll sequence uncancelable once its first event wasn't), so the two never both move.
  const gesture = createWheelGesture();
  let turning = false;

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (gesture.next(event.deltaY, event.timeStamp)) {
      const pinned = Math.abs(section.getBoundingClientRect().top) < 1;
      const next =
        event.cancelable && view === 'wheel' && entered && pinned && cardIndex(event.target) >= 0
          ? stepTarget(intended, Math.sign(event.deltaY), count)
          : null;
      turning = next !== null;
      if (next !== null) goTo(next);
    }
    if (turning) event.preventDefault();
  };

  // --- Start -----------------------------------------------------------------------------------

  const inGrid = options.view === 'grid' && count >= 2;
  const composed =
    inGrid ||
    typeof IntersectionObserver === 'undefined' ||
    visibleFraction(section.getBoundingClientRect(), window.innerHeight) >= M.entryThreshold;
  entered = composed;
  if (inGrid) {
    // The grid as the visitor left it: every card resting in its cell, captions showing.
    keepPlace(() => {
      view = 'grid';
      update(false);
    });
    items.forEach((item, i) => {
      sizes[i] = sizeOf(rectOf(item.card));
      place(i, IDENTITY);
    });
    if (controls) controls.style.opacity = '0';
  } else {
    items.forEach((item, i) => {
      item.card.style.zIndex = String(slotZ(i - current));
      place(i, slotPose(composed ? i - current : 0, size));
      setInfo(i, composed && i === current ? 0 : 110);
    });
    if (controls) controls.style.opacity = composed ? '1' : '0';
    update(false);
  }

  if (!composed) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.intersectionRatio >= M.entryThreshold)) enter();
      },
      { threshold: M.entryThreshold },
    );
    observer.observe(section);
  }

  section.addEventListener('click', onClick);
  section.addEventListener('focusin', onFocus);
  section.addEventListener('keydown', onKey);
  section.addEventListener('pointerdown', onPointerDown);
  section.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', relayout);
  const detachFills = stepButtons.map((button) => {
    const ink = button.querySelector<HTMLElement>('[data-ink]');
    return ink ? attachHoverFill(button, ink) : () => {};
  });

  return {
    get current() {
      return current;
    },
    get view() {
      return view;
    },
    goTo,
    showGrid: () => request(toGrid),
    showWheel: () => request(toWheel),
    idle: () => chain,

    destroy() {
      destroyed = true;
      cancelAll();
      observer?.disconnect();
      section.removeEventListener('click', onClick);
      section.removeEventListener('focusin', onFocus);
      section.removeEventListener('keydown', onKey);
      section.removeEventListener('pointerdown', onPointerDown);
      section.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', relayout);
      detachFills.forEach((detach) => detach());

      delete section.dataset.view;
      for (const item of items) {
        item.card.parentElement?.removeAttribute('data-current');
        item.info?.removeAttribute('inert');
        for (const property of ['transform', 'opacity', 'z-index']) {
          item.card.style.removeProperty(property);
        }
        for (const el of [...item.rollPieces, ...item.captionPieces]) {
          el.style.removeProperty('transform');
        }
      }
      controls?.style.removeProperty('opacity');
      if (counter) counter.textContent = counterText(0, count);
      if (live) live.textContent = '';
      for (const button of stepButtons) button.removeAttribute('aria-disabled');
      pressView('wheel');
    },
  };
}
