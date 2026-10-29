import { describe, expect, test } from 'vitest';
import {
  DRIFT_FALLBACK_SECONDS,
  DRIFT_SPEED,
  MAX_BOOST,
  boostedRate,
  decayRate,
  driftDuration,
} from './drift';

describe('driftDuration', () => {
  test('is one half-strip at the drift speed', () => {
    expect(DRIFT_SPEED).toBe(8);
    expect(driftDuration(1600)).toBe(200);
    expect(driftDuration(1600, 16)).toBe(100);
  });

  test('falls back when the strip has not been measured', () => {
    expect(driftDuration(0)).toBe(DRIFT_FALLBACK_SECONDS);
    expect(driftDuration(-5)).toBe(DRIFT_FALLBACK_SECONDS);
    expect(driftDuration(Number.NaN)).toBe(DRIFT_FALLBACK_SECONDS);
  });
});

describe('boostedRate', () => {
  test('is 1 at rest and rises with scroll speed in either direction', () => {
    expect(boostedRate(0)).toBe(1);
    expect(boostedRate(400)).toBe(2);
    expect(boostedRate(-400)).toBe(2);
  });

  test('is clamped', () => {
    expect(MAX_BOOST).toBe(6);
    expect(boostedRate(100_000)).toBe(MAX_BOOST);
  });
});

describe('decayRate', () => {
  test('moves toward 1 and never past it', () => {
    const next = decayRate(6, 1 / 60);
    expect(next).toBeLessThan(6);
    expect(next).toBeGreaterThan(1);
    expect(decayRate(1, 1 / 60)).toBe(1);
  });

  test('settles within 2% of normal speed after 0.6s', () => {
    let rate = MAX_BOOST;
    for (let frame = 0; frame < 36; frame++) rate = decayRate(rate, 1 / 60);
    expect(rate).toBeLessThan(1.02);
  });
});
