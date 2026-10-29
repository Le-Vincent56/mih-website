// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useCrewMotion } from './useCrewMotion';

// The controller is tested on its own; here it only records its lifecycle.
const controller = vi.hoisted(() => ({ create: vi.fn(), destroy: vi.fn() }));
vi.mock('./crewSelect', () => ({
  createCrewSelect: (section: HTMLElement, options: { reduced: boolean }) => {
    controller.create(section, options);
    return { destroy: controller.destroy };
  },
}));

function stubMedia({ reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') ? reducedMotion : true,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function mountHook() {
  const section = document.createElement('section');
  document.body.append(section);
  return { section, ...renderHook(() => useCrewMotion({ current: section })) };
}

beforeEach(() => {
  controller.create.mockClear();
  controller.destroy.mockClear();
  document.documentElement.classList.add('mih-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('mih-motion');
  document.body.replaceChildren();
});

describe('useCrewMotion', () => {
  test('starts the controller under the motion gate', () => {
    stubMedia();
    const { section } = mountHook();
    expect(controller.create).toHaveBeenCalledWith(section, { reduced: false });
  });

  test('still starts it under reduced motion, telling it so', () => {
    stubMedia({ reducedMotion: true });
    const { section } = mountHook();
    expect(controller.create).toHaveBeenCalledWith(section, { reduced: true });
  });

  test('waits for the gate to add mih-motion', async () => {
    stubMedia();
    document.documentElement.classList.remove('mih-motion');
    mountHook();
    expect(controller.create).not.toHaveBeenCalled();
    await act(async () => {
      document.documentElement.classList.add('mih-motion');
      await Promise.resolve();
    });
    expect(controller.create).toHaveBeenCalledTimes(1);
  });

  test('unmounting destroys the controller', () => {
    stubMedia();
    const { unmount } = mountHook();
    unmount();
    expect(controller.destroy).toHaveBeenCalledTimes(1);
  });

  test('unmounting before the gate opens never starts it', async () => {
    stubMedia();
    document.documentElement.classList.remove('mih-motion');
    const { unmount } = mountHook();
    unmount();
    await act(async () => {
      document.documentElement.classList.add('mih-motion');
      await Promise.resolve();
    });
    expect(controller.create).not.toHaveBeenCalled();
  });
});
