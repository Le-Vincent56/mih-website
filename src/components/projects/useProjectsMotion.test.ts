// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useProjectsMotion } from './useProjectsMotion';

// The controllers are tested on their own; here they only record their lifecycle.
const controllers = vi.hoisted(() => ({
  wheel: vi.fn(),
  wheelDestroy: vi.fn(),
  list: vi.fn(),
  listDestroy: vi.fn(),
}));
vi.mock('./projectsWheel', () => ({
  createProjectsWheel: (section: HTMLElement) => {
    controllers.wheel(section);
    return { destroy: controllers.wheelDestroy };
  },
}));
vi.mock('./listReveal', () => ({
  createListReveal: (section: HTMLElement) => {
    controllers.list(section);
    return { destroy: controllers.listDestroy };
  },
}));

let wide = true;
let onChange: (() => void) | undefined;
const removeListener = vi.fn();

function stubMedia({ reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query.includes('reduce')) return reducedMotion;
      return query.includes('960px') ? wide : false;
    },
    addEventListener: (_: string, listener: () => void) => (onChange = listener),
    removeEventListener: removeListener,
  }));
}

function mountHook() {
  const section = document.createElement('section');
  document.body.append(section);
  return { section, ...renderHook(() => useProjectsMotion({ current: section })) };
}

beforeEach(() => {
  wide = true;
  onChange = undefined;
  Object.values(controllers).forEach((fn) => fn.mockClear());
  removeListener.mockClear();
  document.documentElement.classList.add('mih-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('mih-motion');
  document.body.replaceChildren();
});

describe('useProjectsMotion', () => {
  test('runs the wheel at 960px and wider', () => {
    stubMedia();
    const { section } = mountHook();
    expect(controllers.wheel).toHaveBeenCalledWith(section);
    expect(controllers.list).not.toHaveBeenCalled();
  });

  test('runs the list reveal below 960px', () => {
    wide = false;
    stubMedia();
    mountHook();
    expect(controllers.list).toHaveBeenCalledTimes(1);
    expect(controllers.wheel).not.toHaveBeenCalled();
  });

  test('does nothing under reduced motion', () => {
    stubMedia({ reducedMotion: true });
    mountHook();
    expect(controllers.wheel).not.toHaveBeenCalled();
    expect(controllers.list).not.toHaveBeenCalled();
  });

  test('waits for the motion gate to add mih-motion', async () => {
    stubMedia();
    document.documentElement.classList.remove('mih-motion');
    mountHook();
    expect(controllers.wheel).not.toHaveBeenCalled();
    await act(async () => document.documentElement.classList.add('mih-motion'));
    expect(controllers.wheel).toHaveBeenCalledTimes(1);
  });

  test('swaps controllers when the width crosses 960px', () => {
    stubMedia();
    mountHook();
    wide = false;
    act(() => onChange?.());
    expect(controllers.wheelDestroy).toHaveBeenCalledTimes(1);
    expect(controllers.list).toHaveBeenCalledTimes(1);
    wide = true;
    act(() => onChange?.());
    expect(controllers.listDestroy).toHaveBeenCalledTimes(1);
    expect(controllers.wheel).toHaveBeenCalledTimes(2);
  });

  test('destroys the controller and stops listening on unmount', () => {
    stubMedia();
    const { unmount } = mountHook();
    unmount();
    expect(controllers.wheelDestroy).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalled();
  });
});
