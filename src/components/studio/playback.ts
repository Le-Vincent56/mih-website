// Triggered playback for the studio intro: the scroll picks a station, and time plays the
// transitions toward it (studio intro, "Timeline"). Positions are in stations: 2.4 is 40% of
// the way from station 2 to station 3.
import { EXIT, HOLD, TRANSITION, pinnedScreens } from './stations';

/** Seconds one transition plays. */
export const PLAY = 1.1;

/** Where transition `k` starts, and how long it is, in screens of scroll. */
const startOf = (k: number) => k * (HOLD + TRANSITION) + HOLD;
const lengthOf = (k: number, count: number) => (k === count - 2 ? EXIT : TRANSITION);

/**
 * The station asked for once the scroll moves from progress `from` to `to`. Crossing a
 * transition's start forward asks for the next station; crossing its end backward asks for the
 * one before. Moving inside a transition's range keeps the `previous` target.
 */
export function targetStation(from: number, to: number, count: number, previous: number): number {
  const [a, b] = [from, to].map((p) => p * pinnedScreens(count));
  let target = previous;
  // The stations the scroll allows: up to a transition's start, at most the one before; from
  // its end, at least the next one. Inside its range, either.
  let lowest = 0;
  let highest = count - 1;
  for (let k = count - 2; k >= 0; k--) {
    const start = startOf(k);
    const end = start + lengthOf(k, count);
    if (a <= start && b > start) target = Math.max(target, k + 1);
    if (a >= end && b < end) target = Math.min(target, k);
    if (b >= end) lowest = Math.max(lowest, k + 1);
    if (b <= start) highest = k;
  }
  return Math.min(highest, Math.max(lowest, target));
}

/** One frame of playback: a transition per PLAY seconds, faster the further behind it is. */
export function advance(played: number, target: number, dt: number): number {
  const distance = Math.abs(target - played);
  const step = (Math.max(1, distance) / PLAY) * dt;
  if (step >= distance) return target;
  return played + Math.sign(target - played) * step;
}

/**
 * The scroll progress the stage draws for a played position. A whole station sits mid-hold,
 * which the stage draws as that station; the exit, which has no hold, is the end.
 */
export function progressOf(played: number, count: number): number {
  const last = count - 2;
  if (played >= last + 1) return 1;
  const k = Math.floor(played);
  const t = played - k;
  const x = t === 0 ? startOf(k) - HOLD / 2 : startOf(k) + t * lengthOf(k, count);
  return x / pinnedScreens(count);
}

/**
 * The roll direction after playback moves from `played` to `next`. It follows the movement
 * when it leaves a station or crosses one; a transition reversed midway keeps its direction,
 * so its rolls rewind instead of jumping to the other side.
 */
export function directionOf(played: number, next: number, direction: 1 | -1): 1 | -1 {
  if (next === played) return direction;
  if (Number.isInteger(played) || Math.floor(played) !== Math.floor(next)) {
    return next > played ? 1 : -1;
  }
  return direction;
}
