// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { useBarMode, useCircleLift } from './useBarMode';

const scrollTo = (y: number) =>
  act(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
  });

// A zone whose bottom edge sits 900px down the page.
const addZone = () => {
  const zone = document.createElement('section');
  zone.dataset.barZone = '';
  zone.getBoundingClientRect = () => ({ bottom: 900 - window.scrollY }) as DOMRect;
  document.body.append(zone);
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

describe('useBarMode', () => {
  test('swaps to the circle past the zone, and back to the bar only at the very top', () => {
    addZone();
    const { result } = renderHook(() => useBarMode(false, 'a'));
    expect(result.current).toBe('bar');
    scrollTo(600);
    expect(result.current).toBe('bar');
    scrollTo(1200);
    expect(result.current).toBe('circle');
    scrollTo(300);
    expect(result.current).toBe('circle');
    scrollTo(0);
    expect(result.current).toBe('bar');
  });

  test('stays the bar on a page without a zone', () => {
    const { result } = renderHook(() => useBarMode(false, 'a'));
    scrollTo(5000);
    expect(result.current).toBe('bar');
  });

  test('holds while frozen, then decides from where the page is', () => {
    addZone();
    const { result, rerender } = renderHook(({ frozen }) => useBarMode(frozen, 'a'), {
      initialProps: { frozen: false },
    });
    scrollTo(3000);
    expect(result.current).toBe('circle');
    rerender({ frozen: true });
    scrollTo(0);
    expect(result.current).toBe('circle');
    rerender({ frozen: false });
    expect(result.current).toBe('bar');
  });
});

describe('useCircleLift', () => {
  test('writes how far the footer has come up as --lift', () => {
    const floor = document.createElement('footer');
    floor.dataset.floor = '';
    floor.getBoundingClientRect = () => ({ top: window.innerHeight - 200 }) as DOMRect;
    document.body.append(floor);
    const circle = document.createElement('button');
    renderHook(() => useCircleLift({ current: circle }));
    scrollTo(100);
    expect(circle.style.getPropertyValue('--lift')).toBe('200px');
  });
});
