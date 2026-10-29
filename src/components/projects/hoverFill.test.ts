// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { attachHoverFill, inkCircle, scaleOf } from './hoverFill';
import { PROJECTS_MOTION } from './wheel';

const { hoverFill } = PROJECTS_MOTION;

describe('inkCircle', () => {
  test('centers a circle on the point that just covers the round button at full size', () => {
    // From the left edge of a 40px circle, the farthest point is the right edge: 40px away.
    expect(inkCircle(0, 20, { width: 40, height: 40 })).toEqual({ left: -40, top: -20, size: 80 });
    // From the center, it's the rim: 20px away.
    expect(inkCircle(20, 20, { width: 40, height: 40 })).toEqual({ left: 0, top: 0, size: 40 });
  });

  test('covers a capsule from its far end (project page capsule buttons)', () => {
    // A 200x52 capsule: its ends are circles of radius 26 centered at x = 26 and x = 174. From the
    // left end's center, the farthest point is the right end's rim: 148 + 26 = 174px away.
    expect(inkCircle(26, 26, { width: 200, height: 52 })).toEqual({
      left: 26 - 174,
      top: 26 - 174,
      size: 348,
    });
  });
});

describe('scaleOf', () => {
  test('reads the scale from a computed transform', () => {
    expect(scaleOf('matrix(0.5, 0, 0, 0.5, 0, 0)')).toBeCloseTo(0.5);
    expect(scaleOf('matrix(0, 0, 0, 0, 0, 0)')).toBe(0);
  });

  test('treats no transform as fully grown', () => {
    expect(scaleOf('none')).toBe(1);
    expect(scaleOf('')).toBe(1);
  });
});

interface Call {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
}
let calls: Call[] = [];

function build() {
  const button = document.createElement('button');
  const ink = document.createElement('span');
  button.append(ink);
  document.body.append(button);
  button.getBoundingClientRect = () => ({ left: 100, top: 200, width: 44, height: 44 }) as DOMRect;
  Object.defineProperties(button, {
    clientLeft: { value: 2 },
    clientTop: { value: 2 },
    clientWidth: { value: 40 },
    clientHeight: { value: 40 },
  });
  ink.animate = (keyframes, options) => {
    const cancel = vi.fn();
    calls.push({
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
      cancel,
    });
    return { cancel } as unknown as Animation;
  };
  return { button, ink, detach: attachHoverFill(button, ink) };
}

const pointer = (type: string, x: number, y: number, pointerType = 'mouse') =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerType });

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('attachHoverFill', () => {
  test('grows the ink from where the pointer enters, and marks the button filled', () => {
    const { button, ink } = build();
    // Entering at the left edge, halfway down: (2, 22) inside the 2px border.
    button.dispatchEvent(pointer('pointerenter', 104, 224));
    const R = Math.hypot(2 - 20, 22 - 20) + 20;
    expect(ink.style.left).toBe(`${2 - R}px`);
    expect(ink.style.top).toBe(`${22 - R}px`);
    expect(ink.style.width).toBe(`${2 * R}px`);
    expect(calls[0].keyframes.map((k) => k.transform)).toEqual(['scale(0)', 'scale(1)']);
    expect(calls[0].options).toMatchObject({ duration: hoverFill.in, fill: 'forwards' });
    expect(calls[0].options.easing).toBe('cubic-bezier(0.25, 1, 0.5, 1)');
    expect(button.hasAttribute('data-filled')).toBe(true);
  });

  test('drains the ink into where the pointer leaves', () => {
    const { button, ink } = build();
    button.dispatchEvent(pointer('pointerenter', 104, 224));
    button.dispatchEvent(pointer('pointerleave', 142, 210));
    const R = Math.hypot(40 - 20, 8 - 20) + 20;
    expect(calls[0].cancel).toHaveBeenCalled();
    expect(ink.style.left).toBe(`${40 - R}px`);
    expect(ink.style.top).toBe(`${8 - R}px`);
    expect(calls[1].keyframes.map((k) => k.transform)).toEqual(['scale(1)', 'scale(0)']);
    expect(calls[1].options).toMatchObject({ duration: hoverFill.out, fill: 'forwards' });
    expect(button.hasAttribute('data-filled')).toBe(false);
  });

  test('ignores touch and disabled buttons', () => {
    const { button } = build();
    button.dispatchEvent(pointer('pointerenter', 104, 224, 'touch'));
    button.setAttribute('aria-disabled', 'true');
    button.dispatchEvent(pointer('pointerenter', 104, 224));
    button.dispatchEvent(pointer('pointerleave', 104, 224));
    expect(calls).toHaveLength(0);
    expect(button.hasAttribute('data-filled')).toBe(false);
  });

  test('drains when the button becomes disabled under the pointer, then stays empty', () => {
    const { button } = build();
    button.dispatchEvent(pointer('pointerenter', 104, 224));
    button.setAttribute('aria-disabled', 'true');
    button.dispatchEvent(pointer('pointerleave', 104, 224));
    expect(calls).toHaveLength(2);
    expect(button.hasAttribute('data-filled')).toBe(false);
  });

  test('detaching stops listening and clears the ink', () => {
    const { button, ink, detach } = build();
    button.dispatchEvent(pointer('pointerenter', 104, 224));
    detach();
    expect(calls[0].cancel).toHaveBeenCalled();
    expect(ink.getAttribute('style') ?? '').toBe('');
    expect(button.hasAttribute('data-filled')).toBe(false);
    button.dispatchEvent(pointer('pointerenter', 104, 224));
    expect(calls).toHaveLength(1);
  });
});
