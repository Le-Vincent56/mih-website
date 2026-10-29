// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useArtReturn } from './useArtReturn';

const flight = vi.hoisted(() => ({ returnOnBack: vi.fn() }));
vi.mock('./artMorph', () => ({ returnOnBack: flight.returnOnBack }));

const back = (path: string) => {
  window.history.replaceState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

afterEach(() => {
  cleanup();
  flight.returnOnBack.mockClear();
  window.history.replaceState(null, '', '/');
});

describe('useArtReturn', () => {
  test('browser Back to the homepage flies the hero back into its card', () => {
    renderHook(() => useArtReturn('good-luck-valley'));
    back('/');
    expect(flight.returnOnBack).toHaveBeenCalledWith('good-luck-valley');
  });

  test("runs before React Router's listener, added when the app boots after this module loads", () => {
    // React Router re-renders the page synchronously in its popstate listener, so the hero must
    // lift off first. The router's listener is registered after this module has loaded.
    let ranFirst = false;
    const router = () => (ranFirst = flight.returnOnBack.mock.calls.length > 0);
    window.addEventListener('popstate', router);
    renderHook(() => useArtReturn('good-luck-valley'));
    back('/');
    window.removeEventListener('popstate', router);
    expect(ranFirst).toBe(true);
  });

  test('going back anywhere else (another project page) does nothing', () => {
    renderHook(() => useArtReturn('good-luck-valley'));
    back('/projects/fast-frankie');
    expect(flight.returnOnBack).not.toHaveBeenCalled();
  });

  test('stops listening when the page goes', () => {
    const { unmount } = renderHook(() => useArtReturn('good-luck-valley'));
    unmount();
    back('/');
    expect(flight.returnOnBack).not.toHaveBeenCalled();
  });
});
