import { describe, expect, test } from 'vitest';
import {
  CREW_MOTION,
  SLASH,
  alphaMask,
  announcement,
  closeMask,
  dilateMask,
  fitFontSize,
  hoverShape,
  isOpaque,
  leanFor,
  distanceToShape,
  maskOutline,
  nearestRect,
  pickTopmost,
  rollOffset,
  swipeStep,
  visibleFraction,
  wrapIndex,
  type Hit,
  type Mask,
} from './select';

describe('timings', () => {
  test('match the set values', () => {
    expect(CREW_MOTION.name).toEqual({
      in: 560,
      inAt: 120,
      inStagger: 32,
      out: 380,
      outStagger: 22,
    });
    expect(CREW_MOTION.open.slash).toBe(520);
    expect(CREW_MOTION.close.backAt).toBe(720);
    expect(CREW_MOTION.rise).toEqual({ duration: 900, stagger: 70, fadeUntil: 0.3 });
    expect(CREW_MOTION.arrival).toBeCloseTo(1 / 3);
  });

  test('the slash polygons have four points each, so they interpolate', () => {
    for (const polygon of Object.values(SLASH)) expect(polygon.split(',')).toHaveLength(4);
  });
});

describe('fitFontSize', () => {
  test('is bound by width', () => {
    expect(fitFontSize(500, 1000, 450)).toBe(200);
  });

  test('is bound by cap height', () => {
    expect(fitFontSize(200, 1000, 143.4)).toBeCloseTo(200);
  });

  test('falls back to the cap bound when nothing was measured', () => {
    expect(fitFontSize(0, 1000, 71.7)).toBeCloseTo(100);
  });
});

test('wrapIndex wraps both ways', () => {
  expect(wrapIndex(3, 1, 4)).toBe(0);
  expect(wrapIndex(0, -1, 4)).toBe(3);
  expect(wrapIndex(1, 1, 4)).toBe(2);
});

test('swipeStep needs a mostly horizontal move past 40px; left is next', () => {
  expect(swipeStep(-60, 10)).toBe(1);
  expect(swipeStep(60, 10)).toBe(-1);
  expect(swipeStep(30, 0)).toBe(0);
  expect(swipeStep(-60, 80)).toBe(0);
});

describe('alpha masks', () => {
  // A 2×1 image: the left pixel's alpha is 41 (painted), the right one's 40 (not).
  const mask = alphaMask([0, 0, 0, 41, 0, 0, 0, 40], 2, 1);

  test('keep one bit per pixel above the threshold', () => {
    expect([...mask.bits]).toEqual([1, 0]);
  });

  test('isOpaque maps 0..1 coordinates onto pixels', () => {
    expect(isOpaque(mask, 0.25, 0.5)).toBe(true);
    expect(isOpaque(mask, 0.75, 0.5)).toBe(false);
    expect(isOpaque(mask, -0.1, 0.5)).toBe(false);
    expect(isOpaque(mask, 0.25, 1)).toBe(false);
  });
});

describe('pickTopmost', () => {
  // 2×1 masks: painted on the left half only, or on the right half only.
  const left: Mask = { width: 2, height: 1, bits: Uint8Array.from([1, 0]) };
  const right: Mask = { width: 2, height: 1, bits: Uint8Array.from([0, 1]) };
  const hits: Hit[] = [
    { rect: { left: 0, top: 0, width: 100, height: 100 }, mask: left },
    { rect: { left: 50, top: 0, width: 100, height: 100 }, mask: right },
  ];

  test('picks the topmost painted member', () => {
    expect(pickTopmost(hits, 25, 50)).toBe(0);
    expect(pickTopmost(hits, 125, 50)).toBe(1);
  });

  test('passes through transparent pixels to nothing', () => {
    expect(pickTopmost(hits, 75, 50)).toBeNull();
  });

  test('a hit without a mask counts its whole rect', () => {
    const boxes: Hit[] = hits.map(({ rect }) => ({ rect, mask: null }));
    expect(pickTopmost(boxes, 75, 50)).toBe(1);
    expect(pickTopmost(boxes, 200, 50)).toBeNull();
  });
});

test('announcement', () => {
  expect(announcement('Brody', 'Level & Gameplay Designer')).toBe(
    'Brody, Level & Gameplay Designer',
  );
});

test('visibleFraction', () => {
  expect(visibleFraction({ top: 600, height: 900 }, 900)).toBeCloseTo(1 / 3);
  expect(visibleFraction({ top: 1000, height: 900 }, 900)).toBe(0);
  expect(visibleFraction({ top: 0, height: 900 }, 900)).toBe(1);
});

// Builds a mask from rows of '#' (painted) and '.' (empty).
const draw = (...rows: string[]): Mask => ({
  width: rows[0].length,
  height: rows.length,
  bits: Uint8Array.from(rows.join('').split(''), (c) => (c === '#' ? 1 : 0)),
});
const picture = (mask: Mask) =>
  Array.from({ length: mask.height }, (_, y) =>
    Array.from({ length: mask.width }, (_, x) => (mask.bits[y * mask.width + x] ? '#' : '.')).join(
      '',
    ),
  );

describe('hover shapes', () => {
  test('alphaMask groups pixels into cells, painted if any pixel is', () => {
    // A 4×2 image whose only painted pixel is (3, 1).
    const rgba = new Array(4 * 2 * 4).fill(0);
    rgba[(1 * 4 + 3) * 4 + 3] = 255;
    const mask = alphaMask(rgba, 4, 2, 2);
    expect([mask.width, mask.height]).toEqual([2, 1]);
    expect([...mask.bits]).toEqual([0, 1]);
  });

  test('dilateMask grows every painted cell by the radius', () => {
    expect(picture(dilateMask(draw('.....', '.....', '..#..', '.....', '.....'), 1))).toEqual([
      '.....',
      '.###.',
      '.###.',
      '.###.',
      '.....',
    ]);
  });

  test('closeMask fills gaps and holes narrower than twice the radius without growing', () => {
    expect(picture(closeMask(draw('.......', '.##.##.', '.##.##.', '.......'), 1))).toEqual([
      '.......',
      '.#####.',
      '.#####.',
      '.......',
    ]);
    expect(picture(closeMask(draw('.....', '.###.', '.#.#.', '.###.', '.....'), 1))).toEqual([
      '.....',
      '.###.',
      '.###.',
      '.###.',
      '.....',
    ]);
  });

  test('hoverShape closes the gaps, then pads the edge', () => {
    const shape = hoverShape(
      draw('.........', '.........', '...#.#...', '.........', '.........'),
      {
        close: 1,
        pad: 1,
      },
    );
    expect(picture(shape)).toEqual([
      '.........',
      '..#####..',
      '..#####..',
      '..#####..',
      '.........',
    ]);
  });
});

describe('rollOffset', () => {
  test('reads a letter roll from a computed or inline transform', () => {
    expect(rollOffset('none', 100)).toBe(0);
    expect(rollOffset('', 100)).toBe(0);
    expect(rollOffset('translateY(-40%)', 100)).toBe(-40);
    expect(rollOffset('matrix(1, 0, 0, 1, 0, -55)', 100)).toBeCloseTo(-55);
    expect(rollOffset('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 30, 0, 1)', 60)).toBeCloseTo(
      50,
    );
  });

  test('is null when it cannot tell', () => {
    expect(rollOffset('matrix(1, 0, 0, 1, 0, -55)', 0)).toBeNull();
    expect(rollOffset('rotate(10deg)', 100)).toBeNull();
  });
});

describe('proximity lean', () => {
  const rects = [
    { left: 0, top: 600, width: 100, height: 150 },
    { left: 100, top: 600, width: 100, height: 150 },
  ];

  test('nearestRect finds the closest rect and its distance (0 inside)', () => {
    expect(nearestRect(rects, 150, 400)).toEqual({ index: 1, distance: 200 });
    expect(nearestRect(rects, 40, 700)).toEqual({ index: 0, distance: 0 });
    expect(nearestRect(rects, 260, 600 - 80)).toEqual({ index: 1, distance: 100 });
    expect(nearestRect([], 0, 0)).toBeNull();
  });

  test('nearestRect breaks a tie by the nearer center', () => {
    const wide = [
      { left: 0, top: 600, width: 200, height: 100 },
      { left: 100, top: 600, width: 200, height: 100 },
    ];
    expect(nearestRect(wide, 180, 400)?.index).toBe(1);
    expect(nearestRect(wide, 120, 400)?.index).toBe(0);
  });

  test('maskOutline keeps the centers of the painted cells on the edge', () => {
    const outline = maskOutline(draw('.....', '.###.', '.###.', '.###.', '.....'));
    // The 3×3 block's middle cell is surrounded, so 8 of its 9 cells are edge cells.
    expect(outline.length / 2).toBe(8);
    expect(outline[0]).toBeCloseTo(0.3);
    expect(outline[1]).toBeCloseTo(0.3);
  });

  test('distanceToShape measures from a point to the nearest painted edge on screen', () => {
    // A 4×4 mask on a 400px square: cells x 1-2, y 1-2 are painted (100-300px).
    const mask = draw('....', '.##.', '.##.', '....');
    const outline = maskOutline(mask);
    const rect = { left: 0, top: 0, width: 400, height: 400 };
    expect(distanceToShape(mask, outline, rect, 200, 200)).toBe(0);
    expect(distanceToShape(mask, outline, rect, 150, -100)).toBeCloseTo(250);
    expect(distanceToShape(mask, outline, rect, 550, 250)).toBeCloseTo(300);
  });

  test('leanFor grows from nothing at the range to the full lean at the figure', () => {
    const { max, range } = CREW_MOTION.lean;
    expect(leanFor(0)).toBeCloseTo(max);
    expect(leanFor(range / 2)).toBeCloseTo(max / 2);
    expect(leanFor(range)).toBe(0);
    expect(leanFor(range * 2)).toBe(0);
  });
});
