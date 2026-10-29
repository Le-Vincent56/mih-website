import { describe, expect, it } from 'vitest';
import { KOULEN_ADVANCE, koulenEm, titleWords } from './title';

describe('koulenEm', () => {
  it("sums Koulen's advance widths plus 0.2em between words", () => {
    expect(koulenEm('Fast Frankie')).toBe(4.7754);
    expect(koulenEm('Good Luck Valley')).toBe(6.4875);
  });

  it('reads lower case as the upper case it renders as', () => {
    expect(koulenEm('frankie')).toBe(koulenEm('FRANKIE'));
  });

  it('counts unknown characters as 0.46em and collapses repeated spaces', () => {
    expect(koulenEm('É')).toBe(0.46);
    expect(koulenEm('A  B')).toBe(koulenEm('A B'));
  });

  it('has an advance for every letter and digit', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      expect(KOULEN_ADVANCE[ch]).toBeGreaterThan(0);
    }
  });
});

describe('titleWords', () => {
  it("splits a title into words of letters, each with its first letter's index", () => {
    expect(titleWords('Good Luck  Valley')).toEqual([
      { letters: ['G', 'o', 'o', 'd'], start: 0 },
      { letters: ['L', 'u', 'c', 'k'], start: 4 },
      { letters: ['V', 'a', 'l', 'l', 'e', 'y'], start: 8 },
    ]);
  });
});
