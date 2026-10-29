import { describe, expect, test } from 'vitest';
import { PLAY, advance, directionOf, progressOf, targetStation } from './playback';
import { EXIT, HOLD, TRANSITION, locate, pinnedScreens } from './stations';

// Six content stations plus the exit, as on the homepage.
const COUNT = 7;
const total = pinnedScreens(COUNT);
/** Scroll progress at `x` screens into the pin. */
const at = (x: number) => x / total;
/** Where transition `k` starts and ends, in screens. */
const start = (k: number) => k * (HOLD + TRANSITION) + HOLD;
const end = (k: number) => start(k) + (k === COUNT - 2 ? EXIT : TRANSITION);

describe('targetStation', () => {
  test('is the held station during a hold, whatever came before', () => {
    expect(targetStation(0, 0, COUNT, 0)).toBe(0);
    expect(targetStation(0, at(start(0)), COUNT, 0)).toBe(0);
    expect(targetStation(0, at(end(2) + HOLD / 2), COUNT, 0)).toBe(3);
    expect(targetStation(1, at(end(2) + HOLD / 2), COUNT, 6)).toBe(3);
  });

  test('moves on as soon as the scroll leaves a hold forward', () => {
    expect(targetStation(at(start(0)), at(start(0) + 0.01), COUNT, 0)).toBe(1);
    expect(targetStation(at(start(3) - 0.1), at(start(3) + 0.01), COUNT, 3)).toBe(4);
  });

  test('moves back as soon as the scroll leaves the next hold backward', () => {
    expect(targetStation(at(end(3)), at(end(3) - 0.01), COUNT, 4)).toBe(3);
    expect(targetStation(at(end(3) + 0.1), at(end(3) - 0.01), COUNT, 4)).toBe(3);
  });

  test('keeps the last target while the scroll moves inside a transition range', () => {
    const [a, b] = [at(start(1) + 0.2), at(start(1) + 0.4)];
    expect(targetStation(a, b, COUNT, 2)).toBe(2);
    expect(targetStation(b, a, COUNT, 2)).toBe(2);
    expect(targetStation(a, b, COUNT, 1)).toBe(1);
    expect(targetStation(b, a, COUNT, 1)).toBe(1);
  });

  test('jumps as far as a big scroll allows', () => {
    expect(targetStation(0, at(start(4) + 0.01), COUNT, 0)).toBe(5);
    expect(targetStation(1, at(start(1) + 0.01), COUNT, 6)).toBe(1);
    expect(targetStation(1, at(end(1) + 0.01), COUNT, 6)).toBe(2);
  });

  test('ends on the exit station', () => {
    expect(targetStation(at(start(5)), at(start(5) + 0.01), COUNT, 5)).toBe(6);
    expect(targetStation(1, 1, COUNT, 0)).toBe(6);
  });
});

describe('advance', () => {
  test('plays one transition in PLAY seconds', () => {
    expect(advance(2, 3, PLAY / 2)).toBeCloseTo(2.5);
    expect(advance(3, 2, PLAY / 4)).toBeCloseTo(2.75);
  });

  test('lands exactly on the target', () => {
    expect(advance(2.9, 3, PLAY)).toBe(3);
    expect(advance(3, 3, 0.016)).toBe(3);
  });

  test('speeds up in proportion to how far behind it is', () => {
    expect(advance(0, 4, PLAY / 10)).toBeCloseTo(0.4);
    expect(advance(5, 1, PLAY / 10)).toBeCloseTo(4.6);
  });
});

describe('progressOf', () => {
  test('inverts locate inside every transition', () => {
    for (let k = 0; k < COUNT - 1; k++) {
      for (const t of [0.25, 0.5, 0.9]) {
        const { k: lk, t: lt } = locate(progressOf(k + t, COUNT), COUNT);
        expect(lk).toBe(k);
        expect(lt).toBeCloseTo(t);
      }
    }
  });

  test('puts each content station at the end of its arrival, and the exit at 1', () => {
    expect(locate(progressOf(0, COUNT), COUNT)).toEqual({ k: 0, t: 0 });
    expect(locate(progressOf(3, COUNT), COUNT)).toEqual({ k: 3, t: 0 });
    expect(progressOf(COUNT - 1, COUNT)).toBe(1);
  });
});

describe('directionOf', () => {
  test('follows the movement when it starts from a station or crosses one', () => {
    expect(directionOf(3, 3.02, -1)).toBe(1);
    expect(directionOf(3, 2.98, 1)).toBe(-1);
    expect(directionOf(2.99, 3.01, -1)).toBe(1);
    expect(directionOf(3.01, 2.99, 1)).toBe(-1);
  });

  test('keeps its direction when a transition reverses midway, so the rolls rewind', () => {
    expect(directionOf(2.5, 2.48, 1)).toBe(1);
    expect(directionOf(2.5, 2.52, -1)).toBe(-1);
  });

  test('keeps its direction at rest', () => {
    expect(directionOf(3, 3, -1)).toBe(-1);
  });
});
