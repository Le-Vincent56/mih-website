// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BAR_SWAP, type BarParts, createBarMorph, swapFrames } from './barMorph';

const ease = { throw: 'THROW', lift: 'LIFT' };

describe('swapFrames', () => {
  test('lifts the bar off the top over the first 320ms', () => {
    expect(BAR_SWAP.duration).toBe(720);
    expect(swapFrames(120, ease).bar).toEqual([
      { transform: 'none', offset: 0, easing: 'THROW' },
      { transform: 'translateY(-100%)', offset: 320 / 720 },
      { transform: 'translateY(-100%)', offset: 1 },
    ]);
  });

  test('raises the circle from below the bottom edge, from 120ms to the end', () => {
    expect(swapFrames(120, ease).circle).toEqual([
      { transform: 'translateY(120px)', offset: 0 },
      { transform: 'translateY(120px)', offset: 120 / 720, easing: 'LIFT' },
      { transform: 'none', offset: 1 },
    ]);
  });
});

// A stand-in for Web Animations: each animation finishes when the test says so.
function fakeAnimations() {
  const made: { reverse: ReturnType<typeof vi.fn>; finish: () => void }[] = [];
  const animate = vi.fn<(keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation>(
    function () {
      let finish = () => {};
      const finished = new Promise<void>((resolve) => (finish = resolve));
      const animation = { finished, reverse: vi.fn(), cancel: vi.fn() };
      made.push({ reverse: animation.reverse, finish });
      return animation as unknown as Animation;
    },
  );
  return { animate, made };
}

const parts = (): BarParts => ({
  bar: document.createElement('header'),
  circle: document.createElement('button'),
});

describe('createBarMorph', () => {
  afterEach(() => {
    delete (Element.prototype as { animate?: unknown }).animate;
    delete document.documentElement.dataset.barSwap;
  });

  test('without Web Animations, resolves at once and never marks a swap', async () => {
    await createBarMorph().fly('circle', parts());
    expect(document.documentElement.dataset.barSwap).toBeUndefined();
  });

  test('marks the page as swapping until the swap lands', async () => {
    const { animate, made } = fakeAnimations();
    Element.prototype.animate = animate;
    const landed = createBarMorph().fly('circle', parts());
    expect(document.documentElement.dataset.barSwap).toBe('');
    expect(animate).toHaveBeenCalledTimes(2);
    made.forEach((m) => m.finish());
    await landed;
    expect(document.documentElement.dataset.barSwap).toBeUndefined();
  });

  test('reverses the running swap instead of starting another', async () => {
    const { animate, made } = fakeAnimations();
    Element.prototype.animate = animate;
    const morph = createBarMorph();
    const first = morph.fly('circle', parts());
    const back = morph.fly('bar', parts());
    expect(animate).toHaveBeenCalledTimes(2);
    expect(made.every((m) => m.reverse.mock.calls.length === 1)).toBe(true);
    made.forEach((m) => m.finish());
    await Promise.all([first, back]);
    expect(document.documentElement.dataset.barSwap).toBeUndefined();
  });

  test('plays toward the bar in reverse', async () => {
    const { animate, made } = fakeAnimations();
    Element.prototype.animate = animate;
    const morph = createBarMorph();
    const out = morph.fly('circle', parts());
    made.forEach((m) => m.finish());
    await out;
    void morph.fly('bar', parts());
    expect(animate.mock.calls[2][1]).toMatchObject({ direction: 'reverse', duration: 720 });
  });

  test('does nothing when it is already where it is asked to go', async () => {
    const { animate } = fakeAnimations();
    Element.prototype.animate = animate;
    await createBarMorph().fly('bar', parts());
    expect(animate).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.barSwap).toBeUndefined();
  });
});
