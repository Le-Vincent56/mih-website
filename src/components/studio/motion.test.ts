import { describe, expect, test } from 'vitest';
import {
  clamp01,
  easeLift,
  labelWindow,
  mixRgb,
  rollOffsets,
  segment,
  slideTitleWindow,
  swapWindow,
  wordLetterWindow,
} from './motion';

describe('easeLift (quart in-out, --ease-lift)', () => {
  test('starts slow, crosses the middle, and lands', () => {
    expect(easeLift(0)).toBe(0);
    expect(easeLift(0.25)).toBeCloseTo(0.03125);
    expect(easeLift(0.5)).toBeCloseTo(0.5);
    expect(easeLift(1)).toBe(1);
  });
});

describe('segment and clamp01', () => {
  test('give clamped local progress', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(segment(0.5, 0.25, 0.75)).toBe(0.5);
    expect(segment(0.1, 0.25, 0.75)).toBe(0);
    expect(segment(0.9, 0.25, 0.75)).toBe(1);
  });
});

describe('rollOffsets', () => {
  test('forward: old rolls up and out, new rises in from below', () => {
    expect(rollOffsets(0, 1)).toEqual({ old: 0, next: 110 });
    expect(rollOffsets(1, 1)).toEqual({ old: -110, next: 0 });
  });

  test('backward: the newer text leaves upward and the older rises in from below', () => {
    expect(rollOffsets(1, -1)).toEqual({ old: 110, next: 0 });
    expect(rollOffsets(0, -1)).toEqual({ old: 0, next: -110 });
  });

  test('shows the same text at both ends in either direction', () => {
    for (const r of [0, 1]) {
      const forward = rollOffsets(r, 1);
      const backward = rollOffsets(r, -1);
      expect(forward.old === 0).toBe(backward.old === 0);
      expect(forward.next === 0).toBe(backward.next === 0);
    }
  });
});

describe('letter windows', () => {
  test('use the set values', () => {
    expect(slideTitleWindow(0, 7)).toEqual([0.08, 0.38]);
    expect(swapWindow(1)[0]).toBeCloseTo(0.61);
    expect(swapWindow(1)[1]).toBeCloseTo(0.91);
    expect(wordLetterWindow(0, 4)).toEqual([0.25, 0.55]);
    expect(labelWindow(0)).toEqual([0.3, 0.62]);
  });
});

describe('mixRgb', () => {
  test('mixes two colors channel by channel', () => {
    expect(mixRgb([251, 254, 255], [29, 22, 15], 0.5)).toBe('rgb(140, 138, 135)');
    expect(mixRgb([251, 254, 255], [29, 22, 15], 0)).toBe('rgb(251, 254, 255)');
  });
});
