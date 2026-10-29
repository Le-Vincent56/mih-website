// Drift speed and scroll boost for endlessly drifting rows.

/** Drift speed in px/s. */
export const DRIFT_SPEED = 8;

/** Loop duration used until the strip has been measured. Matches the CSS fallback. */
export const DRIFT_FALLBACK_SECONDS = 120;

/** Highest playback rate while scrolling. */
export const MAX_BOOST = 6;

/** Scroll speed (px/s) that adds 1× to the playback rate. */
const PX_PER_BOOST = 400;

/** Time constant of the return to normal speed: settles within ~0.6s. */
const DECAY_SECONDS = 0.1;

/** Seconds for one drift loop, which moves the strip by one of its two identical halves. */
export function driftDuration(halfWidthPx: number, pxPerSecond = DRIFT_SPEED): number {
  if (!(halfWidthPx > 0) || !(pxPerSecond > 0)) return DRIFT_FALLBACK_SECONDS;
  return halfWidthPx / pxPerSecond;
}

/** Playback rate for the current scroll speed, in either direction. */
export function boostedRate(scrollPxPerSecond: number): number {
  return Math.min(MAX_BOOST, 1 + Math.abs(scrollPxPerSecond) / PX_PER_BOOST);
}

/** Eases a boosted rate back toward 1 over one frame of `dtSeconds`. */
export function decayRate(rate: number, dtSeconds: number): number {
  return 1 + (rate - 1) * Math.exp(-dtSeconds / DECAY_SECONDS);
}
