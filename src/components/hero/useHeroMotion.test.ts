// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useHeroMotion } from './useHeroMotion';

// jsdom has no fonts, IntersectionObserver, or matchMedia; each test stubs what it needs.
let observerCallback: IntersectionObserverCallback | undefined;
const disconnect = vi.fn();

function stubBrowser({ reducedMotion = false } = {}) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedMotion && query.includes('reduce'),
  }));
}

function makeHero(halfWidth: number) {
  const root = document.createElement('section');
  const half = document.createElement('span');
  half.dataset.half = '';
  half.getBoundingClientRect = () => ({ width: halfWidth }) as DOMRect;
  root.append(half);
  document.body.append(root);
  return root;
}

const intersect = (isIntersecting: boolean) =>
  act(() =>
    observerCallback!(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );

beforeEach(() => {
  observerCallback = undefined;
  disconnect.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('useHeroMotion', () => {
  test('sets the drift duration from the measured strip once fonts are ready', async () => {
    stubBrowser();
    const root = makeHero(1600);
    renderHook(() => useHeroMotion({ current: root }));
    await act(() => document.fonts.ready);
    expect(root.style.getPropertyValue('--drift-duration')).toBe('200s');
  });

  test('marks the hero asleep while it is off screen', () => {
    stubBrowser();
    const root = makeHero(1600);
    renderHook(() => useHeroMotion({ current: root }));
    intersect(false);
    expect(root.dataset.asleep).toBe('');
    intersect(true);
    expect(root.dataset.asleep).toBeUndefined();
  });

  test('writes the exit progress on start and as the page scrolls', () => {
    stubBrowser();
    const root = makeHero(1600);
    let top = -225;
    root.getBoundingClientRect = () => ({ top, height: 900 }) as DOMRect;
    renderHook(() => useHeroMotion({ current: root }));
    expect(root.style.getPropertyValue('--hero-exit')).toBe('0.5');
    top = -450;
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(root.style.getPropertyValue('--hero-exit')).toBe('1');
  });

  test('writes no exit progress under reduced motion', () => {
    stubBrowser({ reducedMotion: true });
    const root = makeHero(1600);
    root.getBoundingClientRect = () => ({ top: -225, height: 900 }) as DOMRect;
    renderHook(() => useHeroMotion({ current: root }));
    expect(root.style.getPropertyValue('--hero-exit')).toBe('');
  });

  test('removes the exit progress on unmount', () => {
    stubBrowser();
    const root = makeHero(1600);
    root.getBoundingClientRect = () => ({ top: -225, height: 900 }) as DOMRect;
    const { unmount } = renderHook(() => useHeroMotion({ current: root }));
    unmount();
    expect(root.style.getPropertyValue('--hero-exit')).toBe('');
  });

  test('does not listen to scrolling under reduced motion', () => {
    stubBrowser({ reducedMotion: true });
    const listen = vi.spyOn(window, 'addEventListener');
    renderHook(() => useHeroMotion({ current: makeHero(1600) }));
    expect(listen.mock.calls.some(([type]) => type === 'scroll')).toBe(false);
  });

  test('cleans up its observer and listeners on unmount', () => {
    stubBrowser();
    const unlisten = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useHeroMotion({ current: makeHero(1600) }));
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(unlisten.mock.calls.some(([type]) => type === 'scroll')).toBe(true);
  });
});
