import { describe, expect, test } from 'vitest';
import { heroExit } from './exit';

describe('hero exit', () => {
  test('is 0 while the hero is at or below the top of the screen', () => {
    expect(heroExit(0, 900)).toBe(0);
    expect(heroExit(100, 900)).toBe(0);
  });

  test('runs linearly to 1 as the hero scrolls half its height away', () => {
    expect(heroExit(-225, 900)).toBe(0.5);
    expect(heroExit(-450, 900)).toBe(1);
  });

  test('stays 1 once the hero is further away', () => {
    expect(heroExit(-2000, 900)).toBe(1);
  });
});
