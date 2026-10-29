import { describe, expect, test } from 'vitest';
import {
  PROJECTS_MOTION as M,
  type Pose,
  type Rect,
  type Size,
  WHEEL,
  announcement,
  clearedDelays,
  counterText,
  gridColumns,
  pieceDelays,
  placePose,
  poseTransform,
  rollFrom,
  rollTo,
  slotPose,
  slotZ,
  splitTitle,
  stepTarget,
  visibleFraction,
} from './wheel';

const card: Size = { width: 640, height: 480 };

describe('slotPose', () => {
  test('centers the current card', () => {
    expect(slotPose(0, card)).toEqual({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
  });

  test('puts the neighbors one offset away, tilted, smaller, and faint', () => {
    expect(slotPose(1, card)).toMatchObject({ x: 0, rotate: 6, scale: 0.9, opacity: 0.35 });
    expect(slotPose(1, card).y).toBeCloseTo(422.4);
    expect(slotPose(-1, card)).toMatchObject({ x: 0, rotate: -6, scale: 0.9, opacity: 0.35 });
    expect(slotPose(-1, card).y).toBeCloseTo(-422.4);
  });

  test('hides cards further out and keeps tilting and shrinking them', () => {
    const pose = slotPose(-2, card);
    expect(pose.y).toBeCloseTo(-844.8);
    expect(pose.rotate).toBe(-11);
    expect(pose.scale).toBeCloseTo(0.82);
    expect(pose.opacity).toBe(0);
    expect(slotPose(20, card).scale).toBe(0.3);
  });
});

test('slotZ stacks nearer cards higher', () => {
  expect([0, 1, -1, 3].map(slotZ)).toEqual([40, 38, 38, 34]);
});

describe('poseTransform', () => {
  test('writes one function list around the pivot', () => {
    expect(poseTransform(slotPose(0, card), card)).toBe(
      'translate(0px, 0px) translate(-600px, 240px) rotate(0deg) scale(1) translate(600px, -240px)',
    );
    expect(WHEEL.pivot * card.width).toBe(600);
  });

  test('rounds to three decimals', () => {
    const pose: Pose = { x: 1 / 3, y: 0, rotate: 0, scale: 2 / 3, opacity: 1 };
    expect(poseTransform(pose, card)).toContain('translate(0.333px, 0px)');
    expect(poseTransform(pose, card)).toContain('scale(0.667)');
  });
});

// Applies a pose (translate · pivot · rotate · scale · −pivot, origin 0 0) to a point of a card
// laid out at `rect`.
function apply(pose: Pose, rect: Rect, px: number, py: number): [number, number] {
  const pivotX = -WHEEL.pivot * rect.width;
  const pivotY = rect.height / 2;
  const a = (pose.rotate * Math.PI) / 180;
  const dx = (px - pivotX) * pose.scale;
  const dy = (py - pivotY) * pose.scale;
  return [
    rect.left + pose.x + pivotX + dx * Math.cos(a) - dy * Math.sin(a),
    rect.top + pose.y + pivotY + dx * Math.sin(a) + dy * Math.cos(a),
  ];
}

describe('placePose', () => {
  test('puts a card laid out at one rect exactly on another', () => {
    const from: Rect = { left: 64, top: 200, width: 640, height: 480 };
    const to: Rect = { left: 736, top: 210, width: 320, height: 240 };
    const pose = placePose(from, to);
    expect(pose.rotate).toBe(0);
    expect(pose.opacity).toBe(1);
    const [left, top] = apply(pose, from, 0, 0);
    const [right, bottom] = apply(pose, from, from.width, from.height);
    expect(left).toBeCloseTo(to.left);
    expect(top).toBeCloseTo(to.top);
    expect(right).toBeCloseTo(to.left + to.width);
    expect(bottom).toBeCloseTo(to.top + to.height);
  });

  test('is the identity between equal rects', () => {
    const rect: Rect = { left: 10, top: 20, width: 640, height: 480 };
    expect(placePose(rect, rect)).toEqual({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
  });
});

test('gridColumns uses two columns up to two projects, then three', () => {
  expect([1, 2, 3, 7].map(gridColumns)).toEqual([2, 2, 3, 3]);
});

test('splitTitle splits uppercase words into letters', () => {
  expect(splitTitle('Good Luck  Valley')).toEqual([
    ['G', 'O', 'O', 'D'],
    ['L', 'U', 'C', 'K'],
    ['V', 'A', 'L', 'L', 'E', 'Y'],
  ]);
});

test('pieceDelays staggers the letters, then the status, description, and link', () => {
  expect(pieceDelays(3)).toEqual([0, 25, 50, 120, 180, 240]);
});

describe('clearedDelays', () => {
  const box = (top: number, kind: string, left = 0) => ({
    left,
    top,
    width: 100,
    height: 40,
    kind,
  });
  const clear = (delay: number) => delay + M.roll * M.rollClear;

  test('leaves the roll alone when like pieces cross', () => {
    const incoming = [box(0, 'letter'), box(60, 'status')];
    const outgoing = [box(0, 'letter'), box(60, 'status')];
    expect(clearedDelays(incoming, [160, 280], outgoing, [0, 120])).toEqual([160, 280]);
  });

  test('holds a piece until a different kind of piece has left its box', () => {
    // A two-row title leaving: its second row sits where the incoming status lands.
    const outgoing = [box(0, 'letter'), box(60, 'letter'), box(120, 'status')];
    const incoming = [box(0, 'letter'), box(60, 'status'), box(120, 'description')];
    const delays = clearedDelays(incoming, [160, 280, 340], outgoing, [0, 300, 120]);
    expect(delays[0]).toBe(160);
    expect(delays[1]).toBe(clear(300));
  });

  test('holds every later piece by at least as much, so the order stays', () => {
    const outgoing = [box(60, 'letter')];
    const incoming = [box(60, 'status'), box(120, 'description')];
    const [status, description] = clearedDelays(incoming, [280, 340], outgoing, [300]);
    expect(status).toBe(clear(300));
    expect(description).toBe(clear(300) + 60);
  });

  test('ignores boxes that only touch or sit side by side', () => {
    const outgoing = [box(40, 'letter'), box(60, 'letter', 100)];
    expect(clearedDelays([box(0, 'status')], [280], outgoing, [300, 300])).toEqual([280]);
    expect(clearedDelays([box(60, 'status')], [280], [box(60, 'letter', 100)], [300])).toEqual([
      280,
    ]);
  });
});

test('rolls follow the direction of travel', () => {
  expect([rollTo(1), rollFrom(1), rollTo(-1), rollFrom(-1)]).toEqual([-110, 110, 110, -110]);
});

test('stepTarget stays within the list', () => {
  expect(stepTarget(0, -1, 2)).toBeNull();
  expect(stepTarget(0, 1, 2)).toBe(1);
  expect(stepTarget(1, 1, 2)).toBeNull();
  expect(stepTarget(0, 2, 3)).toBe(2);
});

test('counter and announcement texts', () => {
  expect(counterText(1, 2)).toBe('02 / 02');
  expect(counterText(0, 12)).toBe('01 / 12');
  expect(announcement('Good Luck Valley', 1, 2)).toBe('Good Luck Valley, 2 of 2');
});

describe('visibleFraction', () => {
  test('is the share of the rect inside the viewport', () => {
    expect(visibleFraction({ top: 600, height: 900 }, 900)).toBeCloseTo(1 / 3);
    expect(visibleFraction({ top: -300, height: 900 }, 900)).toBeCloseTo(2 / 3);
  });

  test('is 0 outside the viewport and 1 fully inside', () => {
    expect(visibleFraction({ top: 900, height: 900 }, 900)).toBe(0);
    expect(visibleFraction({ top: -900, height: 900 }, 900)).toBe(0);
    expect(visibleFraction({ top: 100, height: 500 }, 900)).toBe(1);
    expect(visibleFraction({ top: 0, height: 0 }, 900)).toBe(0);
  });
});
