// The crew section's numbers and pure logic.
// The controller (crewSelect.ts) does the DOM work; everything here is unit-tested on its own.

/** Every timing in ms. Delays are from the start of their transition. */
export const CREW_MOTION = {
  /** A name's letters rolling in (from 110%) and out (to -110%). */
  name: { in: 560, inAt: 120, inStagger: 32, out: 380, outStagger: 22 },
  open: {
    slash: 520,
    nameAt: 180,
    portrait: 750,
    portraitAt: 300,
    /** Percent of its width the portrait slides in from (to the right). */
    portraitFrom: 35,
    panel: 650,
    panelAt: 450,
    roster: 450,
    rosterAt: 650,
    rosterStagger: 60,
    /** Percent of its height a roster tile rises from. */
    rosterFrom: 60,
    /** The back arrow fading in. */
    arrow: 300,
    arrowAt: 750,
  },
  /** Switching members on the select screen. Shifts are percents, times the direction. */
  change: {
    out: 260,
    outShift: 20,
    panelOut: 120,
    nameAt: 260,
    portrait: 600,
    portraitAt: 340,
    inShift: 25,
    panel: 450,
    panelAt: 460,
    panelFrom: 12,
  },
  close: {
    out: 380,
    portraitTo: 25,
    fade: 200,
    rosterStagger: 30,
    wipe: 520,
    wipeAt: 200,
    /** When the lineup comes back (the wipe has ended) and starts rising. */
    backAt: 720,
  },
  /** Members rising from the bottom edge; opacity reaches 1 at `fadeUntil` of the rise. */
  rise: { duration: 900, stagger: 70, fadeUntil: 0.3 },
  /**
   * The proximity lean: while the pointer is over the section but on no one, the figure nearest
   * to it scales up by as much as `max` (at 0px) down to nothing at `range` px, to show the
   * lineup responds before anyone is hovered.
   */
  lean: { max: 0.03, range: 360 },
  /** The fraction of the section on screen that plays the arrival. */
  arrival: 1 / 3,
  /** Pixels of horizontal travel that make a swipe. */
  swipe: 40,
  /** Alpha (0-255) above which a silhouette pixel counts as painted. */
  alpha: 40,
  /**
   * The hover shape, in mask cells of `cell` × `cell` canvas pixels: gaps and holes up to
   * 2 × `close` cells wide are filled (between legs, under arms, cut-out eyes and lettering), then
   * the edge is padded by `pad` cells so thin parts are easy to hit.
   */
  hit: { cell: 4, close: 12, pad: 3 },
  /** How long the pointer can be over no one before the hover lets go (crossing a gap). */
  hoverGrace: 150,
  /** A name's largest cap height: a fraction of the section (hover, select) or viewport (phone). */
  caps: { hover: 0.5, select: 0.3, phone: 0.18 },
  /** Koulen's cap height in em. */
  capHeight: 0.717,
} as const;

/** The flood's clip-path: a sliver off the right, the whole section, and gone off the left. */
export const SLASH = {
  start: 'polygon(100% 0, 130% 0, 100% 100%, 70% 100%)',
  full: 'polygon(-30% 0, 130% 0, 100% 100%, -60% 100%)',
  gone: 'polygon(-30% 0, 0% 0, -30% 100%, -60% 100%)',
} as const;

/** The largest font size (px) that fits `maxWidth`, given the text's width at 100px, and `maxCap`. */
export function fitFontSize(widthAt100: number, maxWidth: number, maxCap: number): number {
  const byCap = maxCap / CREW_MOTION.capHeight;
  return widthAt100 > 0 ? Math.min((100 * maxWidth) / widthAt100, byCap) : byCap;
}

export function wrapIndex(index: number, delta: number, count: number): number {
  return (((index + delta) % count) + count) % count;
}

/** 1 for next (a swipe to the left), -1 for previous, 0 for no swipe. */
export function swipeStep(dx: number, dy: number): 1 | -1 | 0 {
  if (Math.abs(dx) <= CREW_MOTION.swipe || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

export interface Mask {
  width: number;
  height: number;
  /** One entry per pixel, row by row: 1 where it's painted. */
  bits: Uint8Array;
}

/** A painted-pixel mask from RGBA image data, in cells of `cell` × `cell` pixels (painted if any is). */
export function alphaMask(rgba: ArrayLike<number>, width: number, height: number, cell = 1): Mask {
  const w = Math.ceil(width / cell);
  const h = Math.ceil(height / cell);
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > CREW_MOTION.alpha)
        bits[Math.floor(y / cell) * w + Math.floor(x / cell)] = 1;
    }
  }
  return { width: w, height: h, bits };
}

// One pass of a square max filter along rows (dx = 1) or columns, through prefix counts.
function spread(mask: Mask, radius: number, alongRows: boolean): Mask {
  const { width, height, bits } = mask;
  const out = new Uint8Array(bits.length);
  const lines = alongRows ? height : width;
  const length = alongRows ? width : height;
  const at = (line: number, i: number) => (alongRows ? line * width + i : i * width + line);
  const counts = new Int32Array(length + 1);
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < length; i++) counts[i + 1] = counts[i] + bits[at(line, i)];
    for (let i = 0; i < length; i++) {
      const from = Math.max(0, i - radius);
      const to = Math.min(length, i + radius + 1);
      out[at(line, i)] = counts[to] - counts[from] > 0 ? 1 : 0;
    }
  }
  return { width, height, bits: out };
}

/** Grows every painted cell into a (2r + 1)-cell square. */
export function dilateMask(mask: Mask, radius: number): Mask {
  return radius > 0 ? spread(spread(mask, radius, true), radius, false) : mask;
}

const invert = (mask: Mask): Mask => ({ ...mask, bits: mask.bits.map((bit) => 1 - bit) });

/**
 * Fills gaps and holes narrower than 2r cells without growing the outline (a morphological
 * closing). It works on a copy padded by r on every side, so shapes touching the edge keep it.
 */
export function closeMask(mask: Mask, radius: number): Mask {
  if (radius <= 0) return mask;
  const { width, height } = mask;
  const w = width + 2 * radius;
  const h = height + 2 * radius;
  const padded = new Uint8Array(w * h);
  for (let y = 0; y < height; y++)
    padded.set(mask.bits.subarray(y * width, (y + 1) * width), (y + radius) * w + radius);
  const closed = invert(
    dilateMask(invert(dilateMask({ width: w, height: h, bits: padded }, radius)), radius),
  );
  const bits = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    bits.set(
      closed.bits.subarray((y + radius) * w + radius, (y + radius) * w + radius + width),
      y * width,
    );
  return { width, height, bits };
}

/** The forgiving shape a figure is hovered by: its gaps closed, then its edge padded. */
export function hoverShape(
  mask: Mask,
  { close, pad }: { close: number; pad: number } = CREW_MOTION.hit,
): Mask {
  return dilateMask(closeMask(mask, close), pad);
}

/** Whether the pixel at (u, v), each 0..1 across the canvas, is painted. */
export function isOpaque(mask: Mask, u: number, v: number): boolean {
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return false;
  return mask.bits[Math.floor(v * mask.height) * mask.width + Math.floor(u * mask.width)] === 1;
}

export interface Hit {
  rect: { left: number; top: number; width: number; height: number };
  /** Null when the image couldn't be read: the whole rect counts. */
  mask: Mask | null;
}

/** The topmost hit painted at (x, y), as an index into `hits` (in paint order, last on top). */
export function pickTopmost(hits: Hit[], x: number, y: number): number | null {
  for (let i = hits.length - 1; i >= 0; i--) {
    const { rect, mask } = hits[i];
    const u = (x - rect.left) / rect.width;
    const v = (y - rect.top) / rect.height;
    if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) continue;
    if (!mask || isOpaque(mask, u, v)) return i;
  }
  return null;
}

/**
 * Where a rolling letter is, in percent of its height (0 in place, -110 rolled out above), read
 * from its computed or inline transform. Null when the transform isn't a plain vertical shift.
 */
export function rollOffset(transform: string, height: number): number | null {
  if (transform === '' || transform === 'none') return 0;
  const shift = /^translateY\((-?[\d.]+)%\)$/.exec(transform);
  if (shift) return Number(shift[1]);
  const matrix = /^matrix(3d)?\((.*)\)$/.exec(transform);
  if (!matrix || !(height > 0)) return null;
  const values = matrix[2].split(',').map(Number);
  const y = matrix[1] ? values[13] : values[5];
  return Number.isFinite(y) ? (y / height) * 100 : null;
}

type Box = { left: number; top: number; width: number; height: number };

/** The rect nearest to (x, y), and the distance to its edge (0 inside it). Ties go to the rect
 *  whose center is horizontally nearer. */
export function nearestRect(
  rects: Box[],
  x: number,
  y: number,
): { index: number; distance: number } | null {
  let best: { index: number; distance: number } | null = null;
  let bestOff = Infinity;
  for (let index = 0; index < rects.length; index++) {
    const rect = rects[index];
    const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
    const dy = Math.max(rect.top - y, 0, y - (rect.top + rect.height));
    const distance = Math.hypot(dx, dy);
    const off = Math.abs(x - (rect.left + rect.width / 2));
    if (!best || distance < best.distance || (distance === best.distance && off < bestOff)) {
      best = { index, distance };
      bestOff = off;
    }
  }
  return best;
}

/**
 * The painted cells on a mask's edge (a painted cell with an unpainted or missing neighbor), as
 * flat (u, v) pairs of cell centers, each 0..1 across the mask.
 */
export function maskOutline(mask: Mask): Float32Array {
  const { width, height, bits } = mask;
  const painted = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && bits[y * width + x] === 1;
  const points: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!painted(x, y)) continue;
      if (painted(x - 1, y) && painted(x + 1, y) && painted(x, y - 1) && painted(x, y + 1))
        continue;
      points.push((x + 0.5) / width, (y + 0.5) / height);
    }
  }
  return Float32Array.from(points);
}

/** The on-screen distance from (x, y) to a figure's painted shape: 0 on it, else to its outline. */
export function distanceToShape(
  mask: Mask,
  outline: Float32Array,
  rect: Box,
  x: number,
  y: number,
): number {
  if (isOpaque(mask, (x - rect.left) / rect.width, (y - rect.top) / rect.height)) return 0;
  let best = Infinity;
  for (let i = 0; i < outline.length; i += 2) {
    const d = Math.hypot(
      rect.left + outline[i] * rect.width - x,
      rect.top + outline[i + 1] * rect.height - y,
    );
    if (d < best) best = d;
  }
  return best;
}

/** How much the nearest figure leans (extra scale) with the pointer `distance` px away. */
export function leanFor(distance: number): number {
  const { max, range } = CREW_MOTION.lean;
  return distance >= range ? 0 : max * (1 - distance / range);
}

export function announcement(name: string, role: string): string {
  return `${name}, ${role}`;
}

/** How much of a rect is on screen, 0 to 1 (as in the projects wheel). */
export function visibleFraction(rect: { top: number; height: number }, viewportHeight: number) {
  if (!(rect.height > 0)) return 0;
  const inside = Math.min(rect.top + rect.height, viewportHeight) - Math.max(rect.top, 0);
  return Math.max(0, inside) / rect.height;
}
