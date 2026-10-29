// Easing, rolls, and letter windows for the studio intro (studio intro, "Motion").

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Local progress of `x` through `[start, end]`, clamped to 0..1. */
export const segment = (x: number, start: number, end: number): number =>
  clamp01((x - start) / (end - start));

/** Quart in-out: the `--ease-lift` curve, cubic-bezier(0.76, 0, 0.24, 1). */
export const easeLift = (t: number): number => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

/**
 * `translateY` percentages for the old and next content of a roll at progress `r`. Letters
 * always roll upward: forward, the old content leaves upward and the next rises in; backward,
 * the next content leaves upward and the old rises back in from below.
 */
export function rollOffsets(r: number, direction: 1 | -1): { old: number; next: number } {
  // `+ 0` normalises -0, so a resting offset is always exactly 0.
  return direction > 0
    ? { old: -r * 110 + 0, next: (1 - r) * 110 }
    : { old: r * 110, next: -(1 - r) * 110 + 0 };
}

type Window = [number, number];
const window = (start: number, end: number): Window => [
  Math.round(start * 1e6) / 1e6,
  Math.round(end * 1e6) / 1e6,
];

/** Slot `i` of `n` in a sliding title. */
export const slideTitleWindow = (i: number, n: number): Window =>
  window(0.08 + (0.45 * i) / n, 0.38 + (0.45 * i) / n);

/** A swap's letter at reading-order position `x` (0..1); title slots use `i / n`. */
export const swapWindow = (x: number): Window => window(0.06 + 0.55 * x, 0.36 + 0.55 * x);

/** Letter `i` of a `length`-letter traveling word, against the word's eased progress. */
export const wordLetterWindow = (i: number, length: number): Window =>
  window(0.25 + (0.25 * i) / length, 0.55 + (0.25 * i) / length);

/** Letter `j` of the six-letter VALUES label. */
export const labelWindow = (j: number): Window => window(0.3 + (0.2 * j) / 6, 0.62 + (0.2 * j) / 6);

export type Rgb = [number, number, number];

export function mixRgb(from: Rgb, to: Rgb, t: number): string {
  const [r, g, b] = from.map((channel, i) => Math.round(channel + (to[i] - channel) * t));
  return `rgb(${r}, ${g}, ${b})`;
}
