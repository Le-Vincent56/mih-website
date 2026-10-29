// Numbers for the projects section: the wheel's slot table, the poses and
// transforms the controllers animate between, timings, and small texts.

/** The slot table, in card units (projects, "The wheel view"). */
export const WHEEL = {
  /** Vertical offset per slot, in card heights: the nearest corner of a tilted neighbor keeps
   * about a 5% gap from the current card, so a good part of it shows. */
  offset: 0.88,
  /** Rotation at ±1, in degrees, and the extra per further slot. */
  rotate: 6,
  rotateStep: 5,
  /** Scale at ±1, and the reduction per further slot. */
  scale: 0.9,
  scaleStep: 0.08,
  minScale: 0.3,
  /** Opacity at ±1; cards further out are hidden. */
  opacity: 0.35,
  /** The pivot's distance left of the card's left edge, in card widths. */
  pivot: 0.9375,
} as const;

/** Timings in ms (projects, "Motion"). */
export const PROJECTS_MOTION = {
  step: 800,
  /** New info starts rolling in at this share of the step. */
  rollInAt: 0.2,
  roll: 600,
  /** By this share of the roll, the lift curve has carried an outgoing piece out of its box. */
  rollClear: 0.7,
  letterStagger: 25,
  /** Status, description, and link, after the first letter. */
  blockDelays: [120, 180, 240],
  gather: 650,
  deal: 780,
  dealStagger: 80,
  /** A caption starts rolling in at this share of its card's deal. */
  captionAt: 0.45,
  captionRoll: 500,
  captionStatusDelay: 60,
  captionOut: 350,
  captionOutStagger: 30,
  controlsFade: 300,
  /** The wheel controls fade in at this share of the fan. */
  controlsAt: 0.5,
  entryThreshold: 1 / 3,
  /** Drag distances in px: a step, and the most that still counts as a click. */
  dragStep: 40,
  dragClick: 12,
  /** The wheel arrows' ink fill on hover: in from the entry point, out to the exit point. */
  hoverFill: { in: 350, out: 300 },
  phone: {
    threshold: 0.25,
    rise: 900,
    /** Title, status, description, and link. */
    textDelays: [200, 260, 320, 380],
    roll: 600,
  },
} as const;

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  left: number;
  top: number;
}

/** A card's placement relative to its layout box, about the wheel's pivot. */
export interface Pose {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000 + 0;

/** The pose of a card `slot` places from the current one (positive is below). */
export function slotPose(slot: number, card: Size): Pose {
  const distance = Math.abs(slot);
  const sign = Math.sign(slot);
  if (distance === 0) return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };
  return {
    x: 0,
    y: slot * WHEEL.offset * card.height,
    rotate: sign * (WHEEL.rotate + WHEEL.rotateStep * (distance - 1)),
    scale: Math.max(WHEEL.minScale, WHEEL.scale - WHEEL.scaleStep * (distance - 1)),
    opacity: distance === 1 ? WHEEL.opacity : 0,
  };
}

export const slotZ = (slot: number): number => 40 - 2 * Math.abs(slot);

function pivot(card: Size): [number, number] {
  return [-WHEEL.pivot * card.width, card.height / 2];
}

/** One function list for every pose, so the browser interpolates each value on its own. */
export function poseTransform(pose: Pose, card: Size): string {
  const [px, py] = pivot(card).map(round);
  return (
    `translate(${round(pose.x)}px, ${round(pose.y)}px) translate(${px}px, ${py}px) ` +
    `rotate(${round(pose.rotate)}deg) scale(${round(pose.scale)}) ` +
    `translate(${round(-px)}px, ${round(-py)}px)`
  );
}

/** The pose that puts a card laid out at `from` exactly on `to` (same aspect ratio). */
export function placePose(from: Rect, to: Rect): Pose {
  const scale = to.width / from.width;
  const [px, py] = pivot(from);
  return {
    x: to.left - from.left - px * (1 - scale) + 0,
    y: to.top - from.top - py * (1 - scale) + 0,
    rotate: 0,
    scale,
    opacity: 1,
  };
}

export const gridColumns = (count: number): number => (count <= 2 ? 2 : 3);

/** The title's words in uppercase, each split into letters. */
export function splitTitle(title: string): string[][] {
  return title
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word]);
}

/** Delays of an info's pieces: each letter, then the status, description, and link. */
export function pieceDelays(letterCount: number): number[] {
  const letters = Array.from({ length: letterCount }, (_, i) => i * PROJECTS_MOTION.letterStagger);
  return [...letters, ...PROJECTS_MOTION.blockDelays];
}

/** A roll piece's clip box, and its kind: 'letter', or the block it is ('status', ...). */
export interface RollBox extends Rect {
  kind: string;
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

/**
 * The incoming info's roll delays, held back so no piece rolls into a box that a different kind
 * of piece is still leaving: when one title wraps to more rows than the other, the extra row
 * would cross the other's status. Like crosses like (letters over letters, status over status),
 * as the roll intends. A held piece holds every piece after it by as much, so the order stays.
 */
export function clearedDelays(
  incoming: RollBox[],
  inDelays: number[],
  outgoing: RollBox[],
  outDelays: number[],
): number[] {
  const clearAt = outDelays.map(
    (delay) => delay + PROJECTS_MOTION.roll * PROJECTS_MOTION.rollClear,
  );
  let hold = 0;
  return incoming.map((box, k) => {
    outgoing.forEach((other, j) => {
      if (other.kind !== box.kind && overlaps(box, other)) {
        hold = Math.max(hold, clearAt[j] - inDelays[k]);
      }
    });
    return inDelays[k] + hold;
  });
}

/** Where rolled-out content goes: up (-110%) when travelling forward, down when back. */
export const rollTo = (direction: 1 | -1): number => (direction > 0 ? -110 : 110);

/** Where rolled-in content comes from. */
export const rollFrom = (direction: 1 | -1): number => (direction > 0 ? 110 : -110);

/** The index `delta` steps from `current`, or null outside the list. */
export function stepTarget(current: number, delta: number, count: number): number | null {
  const target = current + delta;
  return target >= 0 && target < count && target !== current ? target : null;
}

const twoDigits = (n: number) => String(n).padStart(2, '0');

export const counterText = (index: number, count: number): string =>
  `${twoDigits(index + 1)} / ${twoDigits(count)}`;

export const announcement = (title: string, index: number, count: number): string =>
  `${title}, ${index + 1} of ${count}`;

/** The share of a rect's height inside a viewport of the given height. */
export function visibleFraction(rect: { top: number; height: number }, viewportHeight: number) {
  if (!(rect.height > 0)) return 0;
  const inside = Math.min(rect.top + rect.height, viewportHeight) - Math.max(rect.top, 0);
  return Math.max(0, inside) / rect.height;
}
