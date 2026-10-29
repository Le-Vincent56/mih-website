// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type StageClasses } from './stage';
import { EXIT_STATION, type Station } from './stations';
import { useStudioMotion } from './useStudioMotion';

// The stage is drawn by stage.ts (tested separately); here it only records calls.
const stage = vi.hoisted(() => ({
  create: vi.fn(),
  render: vi.fn(),
  remeasure: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('./stage', () => ({
  createStage: (...args: unknown[]) => {
    stage.create(...args);
    return { render: stage.render, remeasure: stage.remeasure, destroy: stage.destroy };
  },
}));

const classes = {} as StageClasses;
const stations = [] as Station[];

let observe: IntersectionObserverCallback;
const disconnect = vi.fn();
let frames: FrameRequestCallback[] = [];
let resolveFonts: () => void;

function stubBrowser({ reducedMotion = false } = {}) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observe = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedMotion && query.includes('reduce'),
  }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: new Promise<void>((resolve) => (resolveFonts = resolve)) },
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
}

function mountHook() {
  const section = document.createElement('section');
  section.getBoundingClientRect = () => ({ top: -500, height: 6000 }) as DOMRect;
  const frame = document.createElement('div');
  document.body.append(section, frame);
  return renderHook(() =>
    useStudioMotion({ current: section }, { current: frame }, stations, classes),
  );
}

const visible = (isIntersecting: boolean) =>
  act(() => observe([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

const flushFrame = () => {
  const pending = frames;
  frames = [];
  act(() => pending.forEach((callback) => callback(performance.now())));
};

beforeEach(() => {
  frames = [];
  Object.values(stage).forEach((fn) => fn.mockClear());
  disconnect.mockClear();
  document.documentElement.classList.add('mih-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('mih-motion');
  document.body.replaceChildren();
});

describe('useStudioMotion', () => {
  test('renders the current progress on mount', () => {
    stubBrowser();
    mountHook();
    expect(stage.create).toHaveBeenCalledTimes(1);
    expect(stage.render.mock.calls[0]).toEqual([0.1, 1, 0]);
  });

  test('plays the stations, then the exit back to paper', () => {
    stubBrowser();
    mountHook();
    expect(stage.create.mock.calls[0][1]).toEqual([...stations, EXIT_STATION]);
  });

  test('draws frames only while the section is on screen', () => {
    stubBrowser();
    mountHook();
    visible(true);
    expect(frames).toHaveLength(1);
    flushFrame();
    expect(frames).toHaveLength(1);
    visible(false);
    flushFrame();
    expect(frames).toHaveLength(0);
  });

  test('re-measures once fonts have loaded, and on resize', async () => {
    stubBrowser();
    mountHook();
    await act(async () => resolveFonts());
    expect(stage.remeasure).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(stage.remeasure).toHaveBeenCalledTimes(2);
  });

  test('does nothing under reduced motion', () => {
    stubBrowser({ reducedMotion: true });
    mountHook();
    expect(stage.create).not.toHaveBeenCalled();
  });

  test('starts once the motion gate adds mih-motion', async () => {
    stubBrowser();
    document.documentElement.classList.remove('mih-motion');
    mountHook();
    expect(stage.create).not.toHaveBeenCalled();
    await act(async () => document.documentElement.classList.add('mih-motion'));
    expect(stage.create).toHaveBeenCalledTimes(1);
  });

  test('destroys the stage and disconnects on unmount', () => {
    stubBrowser();
    const { unmount } = mountHook();
    unmount();
    expect(stage.destroy).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
