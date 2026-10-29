import { describe, expect, test } from 'vitest';
import { type WordBox, chainStep, groupLines, lagOf, pairLines } from './pairing';

const LINE = 30;
// A line of words at row `row`, spaced 100px apart from `x0`.
const line = (row: number, texts: string[], x0 = 0): WordBox[] =>
  texts.map((text, i) => ({ text, x: x0 + i * 100, y: row * LINE }));

describe('groupLines', () => {
  test('splits words into rows by their y, keeping reading order', () => {
    const words = [...line(0, ['a', 'b']), { text: 'c', x: 0, y: 2 }, ...line(1, ['d'])];
    expect(groupLines(words).map((row) => row.map((w) => w.text))).toEqual([
      ['a', 'b', 'c'],
      ['d'],
    ]);
  });
});

describe('pairLines', () => {
  test('keeps every word on its own row, first to first and last to last', () => {
    const from = [line(0, ['a', 'b', 'c']), line(1, ['d', 'e', 'f'])];
    const to = [line(0, ['A', 'B', 'C'], 500), line(1, ['D', 'E', 'F'], 500)];
    const travelers = pairLines(from, to);

    expect(travelers.filter((t) => t.outgoing)).toHaveLength(6);
    expect(travelers.filter((t) => !t.outgoing)).toHaveLength(6);
    for (const t of travelers) expect(t.from.y).toBe(t.to.y);
    const a = travelers.find((t) => t.text === 'a')!;
    const c = travelers.find((t) => t.text === 'c')!;
    expect([a.to.x, c.to.x]).toEqual([500, 700]);
    expect([a.position, c.position]).toEqual([0, 1]);
    const D = travelers.find((t) => t.text === 'D')!;
    expect(D.from).toEqual({ x: 0, y: LINE });
  });

  test('shares partners when a line has more words than its match', () => {
    const travelers = pairLines([line(0, ['a', 'b', 'c', 'd'])], [line(0, ['X', 'Y'], 500)]);
    const out = travelers.filter((t) => t.outgoing).map((t) => t.to.x);
    expect(out).toEqual([500, 500, 600, 600]);
    const incoming = travelers.filter((t) => !t.outgoing).map((t) => t.from.x);
    expect(incoming).toEqual([0, 300]);
  });

  test('maps uneven line counts proportionally, never more than a line apart', () => {
    const from = [line(0, ['a']), line(1, ['b']), line(2, ['c'])];
    const to = [line(0, ['X']), line(1, ['Y'])];
    const travelers = pairLines(from, to);
    expect(travelers.find((t) => t.text === 'b')!.to.y).toBe(LINE);
    for (const t of travelers) expect(Math.abs(t.from.y - t.to.y)).toBeLessThanOrEqual(LINE);
  });

  test('never crosses paths within a line', () => {
    const travelers = pairLines(
      [line(0, ['a', 'b', 'c', 'd', 'e'])],
      [line(0, ['V', 'W', 'X'], 300)],
    );
    const targets = travelers.filter((t) => t.outgoing).map((t) => t.to.x);
    expect(targets).toEqual([...targets].sort((p, q) => p - q));
  });
});

describe('lagOf', () => {
  test('lets the end facing the travel lead', () => {
    expect(lagOf(1, true)).toBe(0);
    expect(lagOf(0, true)).toBe(1);
    expect(lagOf(1, false)).toBe(1);
    expect(lagOf(0, false)).toBe(0);
  });
});

describe('chainStep', () => {
  test('chases the target, faster for the leading word', () => {
    expect(chainStep(0, 1, 0.1, 0)).toBeCloseTo(1 - Math.exp(-1.6));
    expect(chainStep(0, 1, 0.1, 1)).toBeCloseTo(1 - Math.exp(-0.4));
  });

  test('stays put once it has caught up', () => {
    expect(chainStep(0.5, 0.5, 1, 0.3)).toBe(0.5);
  });
});
