// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useLightbox } from './useLightbox';

const lightbox = vi.hoisted(() => ({ create: vi.fn(), destroy: vi.fn() }));
vi.mock('./lightbox', () => ({
  createLightbox: (...args: unknown[]) => {
    lightbox.create(...args);
    return { destroy: lightbox.destroy };
  },
}));

const stubReduced = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  lightbox.create.mockClear();
  lightbox.destroy.mockClear();
});

describe('useLightbox', () => {
  test('starts the controller on the gallery and stops it on unmount', () => {
    stubReduced(false);
    const root = document.createElement('div');
    const { unmount } = renderHook(() => useLightbox({ current: root }));
    expect(lightbox.create).toHaveBeenCalledWith(root, { reduced: false });
    unmount();
    expect(lightbox.destroy).toHaveBeenCalled();
  });

  test('tells the controller about reduced motion', () => {
    stubReduced(true);
    renderHook(() => useLightbox({ current: document.createElement('div') }));
    expect(lightbox.create).toHaveBeenCalledWith(expect.anything(), { reduced: true });
  });
});
