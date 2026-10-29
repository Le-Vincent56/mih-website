import { describe, expect, test } from 'vitest';
import { nextBarMode } from './barState';

// The zone ends at 500: past it, the bar has given way to the circle.
describe('nextBarMode', () => {
  test('is the bar at the very top', () => {
    expect(nextBarMode('circle', 0, 500)).toBe('bar');
  });

  test('swaps to the circle once the zone has passed', () => {
    expect(nextBarMode('bar', 501, 500)).toBe('circle');
  });

  test('keeps the bar scrolling down through the zone', () => {
    expect(nextBarMode('bar', 300, 500)).toBe('bar');
  });

  test('keeps the circle scrolling back up through the zone, until the very top', () => {
    expect(nextBarMode('circle', 300, 500)).toBe('circle');
    expect(nextBarMode('circle', 2, 500)).toBe('circle');
  });

  test('stays the bar on a page without a zone', () => {
    expect(nextBarMode('bar', 5000, null)).toBe('bar');
  });

  test('holds while frozen (the menu is open), even at the top', () => {
    expect(nextBarMode('circle', 0, 500, true)).toBe('circle');
    expect(nextBarMode('bar', 3000, 500, true)).toBe('bar');
  });
});
