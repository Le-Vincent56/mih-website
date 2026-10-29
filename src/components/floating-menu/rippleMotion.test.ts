// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { type RippleParts, createRippleMotion, floodClip } from './rippleMotion';

describe('floodClip', () => {
  test('is a circle of the given radius around the hub', () => {
    expect(floodClip(300, { x: 10, y: 20.5 })).toBe('circle(300px at 10px 20.5px)');
  });
});

const parts = (rings = 5): RippleParts => {
  const el = () => document.createElement('div');
  const svg = () => document.createElementNS('http://www.w3.org/2000/svg', 'g');
  return {
    flood: el(),
    rings: Array.from({ length: rings }, svg),
    close: el(),
    closeMark: el(),
    strokes: [el(), el()],
  };
};

const target = () => ({ left: 1352, top: 812, width: 64, height: 64 }) as DOMRect;

describe('createRippleMotion', () => {
  afterEach(() => {
    delete (Element.prototype as { animate?: unknown }).animate;
  });

  test('without Web Animations, closing still runs the jump in between', async () => {
    const between = vi.fn(() => Promise.resolve());
    await createRippleMotion().close(parts(), { hub: { x: 1384, y: 844 }, between, target });
    expect(between).toHaveBeenCalledOnce();
  });

  test('opening swings the rings in innermost first, 55ms apart from 200ms', () => {
    const animate = vi.fn(
      () => ({ finished: Promise.resolve(), cancel() {} }) as unknown as Animation,
    );
    Element.prototype.animate = animate;
    const p = parts();
    createRippleMotion().open(p, { x: 1384, y: 844 }, 1620);
    const delayOf = (el: Element) =>
      (animate.mock.contexts.indexOf(el) >= 0
        ? (animate.mock.calls[animate.mock.contexts.indexOf(el)] as unknown[])[1]
        : null) as KeyframeAnimationOptions | null;
    expect(p.rings.map((ring) => delayOf(ring)?.delay)).toEqual([420, 365, 310, 255, 200]);
  });

  test('a chosen ring leaves 80ms after the others', async () => {
    const animate = vi.fn(
      () => ({ finished: Promise.resolve(), cancel() {} }) as unknown as Animation,
    );
    Element.prototype.animate = animate;
    const p = parts();
    await createRippleMotion().close(p, { hub: { x: 1384, y: 844 }, chosen: 3, target });
    const delays = p.rings.map((ring) => {
      const i = animate.mock.contexts.indexOf(ring);
      return ((animate.mock.calls[i] as unknown[])[1] as KeyframeAnimationOptions).delay;
    });
    expect(delays).toEqual([0, 0, 0, 80, 0]);
  });
});
