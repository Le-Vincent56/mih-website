import { describe, expect, test } from 'vitest';
import { studio } from '../../content';
import { accentVar } from '../../content/schema';
import {
  EXIT,
  EXIT_STATION,
  HOLD,
  TRANSITION,
  buildStations,
  kindOf,
  locate,
  pinnedScreens,
  withExit,
} from './stations';

describe('buildStations', () => {
  const stations = buildStations(studio);

  test('makes Vision, Mission, then the four values, uppercased', () => {
    expect(stations.map((s) => s.title)).toEqual([
      'VISION',
      'MISSION',
      'AMBITION',
      'CONFIDENCE',
      'PROCESS',
      'TRANSPARENCY',
    ]);
    expect(stations.map((s) => s.text)).toEqual([
      studio.vision,
      studio.mission,
      ...studio.values.map((v) => v.text),
    ]);
  });

  test('labels only the values, and aligns left, right, then center', () => {
    expect(stations.map((s) => s.label)).toEqual(['', '', 'VALUES', 'VALUES', 'VALUES', 'VALUES']);
    expect(stations.map((s) => s.align)).toEqual([
      'left',
      'right',
      'center',
      'center',
      'center',
      'center',
    ]);
  });

  test('colors Vision paper on ink text, Mission the reverse, and each value its accent', () => {
    expect(stations[0]).toMatchObject({
      background: 'var(--mih-paper)',
      foreground: 'var(--mih-ink)',
    });
    expect(stations[1]).toMatchObject({
      background: 'var(--mih-ink)',
      foreground: 'var(--mih-paper)',
    });
    studio.values.forEach((value, i) => {
      expect(stations[i + 2]).toMatchObject({
        background: accentVar(value.accent),
        foreground: 'var(--mih-ink)',
      });
    });
  });
});

describe('withExit', () => {
  test('appends the empty paper exit after the six content stations', () => {
    const stations = buildStations(studio);
    expect(stations).toHaveLength(6);
    const played = withExit(stations);
    expect(played).toHaveLength(7);
    expect(played.slice(0, 6)).toEqual(stations);
    expect(played[6]).toBe(EXIT_STATION);
    expect(EXIT_STATION).toEqual({
      title: '',
      text: '',
      label: '',
      background: 'var(--mih-paper)',
      foreground: 'var(--mih-ink)',
      align: 'center',
    });
  });
});

describe('locate', () => {
  // Six content stations plus the exit; the pinned scroll is 7 screens.
  const at = (screens: number) => screens / pinnedScreens(7);

  test('times holds, transitions, and the exit in screens', () => {
    // Half-screen holds, like the Projects and Crew scroll holds; transitions keep their pace.
    expect([HOLD, TRANSITION, EXIT]).toEqual([0.5, 0.7, 0.5]);
    expect(pinnedScreens(7)).toBe(7);
  });

  test('holds, transitions, then exits with no hold after', () => {
    expect(locate(0, 7)).toEqual({ k: 0, t: 0 });
    expect(locate(at(HOLD), 7)).toEqual({ k: 0, t: 0 });
    const mid = locate(at(HOLD + 0.35), 7);
    expect(mid.k).toBe(0);
    expect(mid.t).toBeCloseTo(0.5);
    expect(locate(at(HOLD + TRANSITION + 0.1), 7)).toEqual({ k: 1, t: 0 });
    // TRANSPARENCY's hold is the end of the last value transition.
    expect(locate(at(7 - EXIT - 0.1), 7)).toEqual({ k: 5, t: 0 });
    const exit = locate(at(7 - 0.25), 7);
    expect(exit.k).toBe(5);
    expect(exit.t).toBeCloseTo(0.5);
    expect(locate(1, 7)).toEqual({ k: 5, t: 1 });
  });

  test('never runs backwards as progress grows', () => {
    let previous = -1;
    for (let step = 0; step <= 1000; step++) {
      const { k, t } = locate(step / 1000, 7);
      expect(k + t).toBeGreaterThanOrEqual(previous);
      previous = k + t;
    }
  });
});

describe('kindOf', () => {
  test('slides into Mission and into the first value, then swaps between values', () => {
    expect([0, 1, 2, 3, 4].map(kindOf)).toEqual(['slide', 'slide', 'swap', 'swap', 'swap']);
  });
});
