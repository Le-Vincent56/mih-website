import { describe, expect, test } from 'vitest';
import { WHEEL_GESTURE as G, createWheelGesture } from './wheelGesture';

/** Feeds deltas 16ms apart from `from`, returning which ones started a gesture. */
const feed = (gesture: ReturnType<typeof createWheelGesture>, deltas: number[], from = 0) =>
  deltas.map((delta, i) => gesture.next(delta, from + i * 16));

describe('createWheelGesture', () => {
  test('the first event starts a gesture and the rest of the run continues it', () => {
    expect(feed(createWheelGesture(), [4, 12, 30, 40, 38])).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  test('a pause longer than the quiet gap starts a new gesture', () => {
    const gesture = createWheelGesture();
    gesture.next(100, 0);
    expect(gesture.next(100, G.quiet)).toBe(false);
    expect(gesture.next(100, 2 * G.quiet + 1)).toBe(true);
  });

  test('turning the other way starts a new gesture', () => {
    const gesture = createWheelGesture();
    feed(gesture, [20, 30, 25]);
    expect(gesture.next(-10, 64)).toBe(true);
  });

  test('a long decaying momentum stays one gesture', () => {
    const decay = Array.from({ length: 120 }, (_, i) => Math.max(1, Math.round(60 * 0.97 ** i)));
    expect(feed(createWheelGesture(), decay).filter(Boolean)).toHaveLength(1);
  });

  test('a new swipe during the momentum starts a new gesture once it may re-arm', () => {
    const gesture = createWheelGesture();
    const momentum = Array.from({ length: 50 }, (_, i) => Math.round(40 * 0.96 ** i));
    feed(gesture, momentum);
    const time = momentum.length * 16;
    expect(time).toBeGreaterThan(G.rearm);
    expect(gesture.next(40, time)).toBe(true);
  });

  test('a surge before the gesture may re-arm continues it', () => {
    const gesture = createWheelGesture();
    feed(gesture, [40, 20, 10]);
    expect(gesture.next(40, 48)).toBe(false);
  });

  test('small wobbles in the momentum tail are not a surge', () => {
    const gesture = createWheelGesture();
    const tail = Array.from({ length: Math.ceil(G.rearm / 16) + 1 }, () => 1);
    feed(gesture, tail);
    expect(gesture.next(G.floor - 1, tail.length * 16)).toBe(false);
  });
});
