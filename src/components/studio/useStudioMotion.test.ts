// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PLAY, progressOf } from './playback';
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
// Six stations plus the exit: 7 screens of pin, so `scroll` below is in screens.
const stations = Array.from({ length: 6 }, () => ({}) as Station);
const COUNT = 7;
/** Screens scrolled into the pin; the section is 8 screens of 1000px. */
let scroll = 0;
let clock = 0;

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
  section.getBoundingClientRect = () => ({ top: -scroll * 1000, height: 8000 }) as DOMRect;
  const frame = document.createElement('div');
  document.body.append(section, frame);
  return renderHook(() =>
    useStudioMotion({ current: section }, { current: frame }, stations, classes),
  );
}

const visible = (isIntersecting: boolean) =>
  act(() => observe([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

const flushFrame = (seconds = 1 / 60) => {
  clock += seconds * 1000;
  const pending = frames;
  frames = [];
  act(() => pending.forEach((callback) => callback(clock)));
};

/** Runs frames for `seconds` of wall time. */
const play = (seconds: number) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 1 / 60) flushFrame();
};

const lastRender = () => stage.render.mock.calls.at(-1);

beforeEach(() => {
  frames = [];
  scroll = 0;
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  Object.values(stage).forEach((fn) => fn.mockClear());
  disconnect.mockClear();
  document.documentElement.classList.add('mih-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('mih-motion');
  document.body.replaceChildren();
});

describe('useStudioMotion', () => {
  test('draws the station the scroll is on when it mounts', () => {
    stubBrowser();
    scroll = 3.8;
    mountHook();
    expect(stage.create).toHaveBeenCalledTimes(1);
    expect(stage.render.mock.calls[0]).toEqual([progressOf(3, COUNT), 1, 0]);
  });

  test('plays a triggered transition over time, not with the scroll', () => {
    stubBrowser();
    mountHook();
    visible(true);
    scroll = 0.6;
    flushFrame();
    play(PLAY / 2 - 1 / 60);
    expect(lastRender()?.[0]).toBeCloseTo(progressOf(0.5, COUNT));
    expect(lastRender()?.[1]).toBe(1);
    play(PLAY);
    expect(lastRender()?.[0]).toBeCloseTo(progressOf(1, COUNT));
  });

  test('plays backward when the scroll goes back out of a hold', () => {
    stubBrowser();
    scroll = 1.3;
    mountHook();
    visible(true);
    scroll = 1.1;
    flushFrame();
    play(PLAY / 4 - 1 / 60);
    expect(lastRender()?.[0]).toBeCloseTo(progressOf(0.75, COUNT));
    expect(lastRender()?.[1]).toBe(-1);
  });

  test('rewinds a transition the scroll reverses midway, keeping its roll direction', () => {
    stubBrowser();
    mountHook();
    visible(true);
    scroll = 0.6;
    flushFrame();
    play(PLAY / 2);
    scroll = 0.4;
    flushFrame();
    play(PLAY / 4);
    expect(lastRender()?.[0]).toBeLessThan(progressOf(0.5, COUNT));
    expect(lastRender()?.[1]).toBe(1);
  });

  test('jumps to the target while the section is off screen', () => {
    stubBrowser();
    mountHook();
    scroll = 3.8;
    visible(true);
    flushFrame();
    expect(lastRender()?.[0]).toBeCloseTo(progressOf(3, COUNT));
  });

  test('jumps to the target on coming back, even before a pending frame has run', () => {
    stubBrowser();
    mountHook();
    visible(true);
    flushFrame();
    visible(false);
    scroll = 3.8;
    visible(true);
    expect(lastRender()?.[0]).toBeCloseTo(progressOf(3, COUNT));
  });

  test('settles the stage at once when it jumps, so no words are left mid-slide', () => {
    stubBrowser();
    mountHook();
    scroll = 1.4;
    visible(true);
    expect(stage.render).toHaveBeenLastCalledWith(progressOf(1, COUNT), 1, Infinity);
  });

  test('finishes the exit at once when the frame starts to let go', () => {
    stubBrowser();
    scroll = 6.2;
    mountHook();
    visible(true);
    scroll = 7.2;
    flushFrame();
    expect(lastRender()?.[0]).toBe(1);
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
