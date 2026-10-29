// @vitest-environment jsdom
// Coming back from a project page, the wheel opens on that project. Kept apart
// from useProjectsMotion.test.ts, which the Projects section owns.
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useProjectsMotion } from './useProjectsMotion';

const wheel = vi.hoisted(() => ({
  create: vi.fn(),
  returning: null as string | null,
  view: 'wheel' as 'wheel' | 'grid',
}));
vi.mock('./projectsWheel', () => ({
  createProjectsWheel: (...args: unknown[]) => {
    wheel.create(...args);
    return { destroy() {} };
  },
}));
vi.mock('./listReveal', () => ({ createListReveal: () => ({ destroy() {} }) }));
vi.mock('../project/artMorph', () => ({ returningTo: () => wheel.returning }));
vi.mock('./projectsView', () => ({ rememberedView: () => wheel.view }));

beforeEach(() => {
  wheel.create.mockClear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('960px'),
    addEventListener() {},
    removeEventListener() {},
  }));
  document.documentElement.classList.add('mih-motion');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  wheel.returning = null;
  wheel.view = 'wheel';
  document.documentElement.classList.remove('mih-motion');
});

describe('useProjectsMotion, coming back', () => {
  test('starts the wheel on the card a hero is flying back into', () => {
    wheel.returning = '/projects/good-luck-valley';
    const section = document.createElement('section');
    renderHook(() => useProjectsMotion({ current: section }));
    expect(wheel.create).toHaveBeenCalledWith(section, {
      start: '/projects/good-luck-valley',
      view: 'wheel',
    });
  });

  test('starts it on the first project otherwise', () => {
    const section = document.createElement('section');
    renderHook(() => useProjectsMotion({ current: section }));
    expect(wheel.create).toHaveBeenCalledWith(section, { start: undefined, view: 'wheel' });
  });

  test('opens in the view the visitor last chose', () => {
    wheel.view = 'grid';
    const section = document.createElement('section');
    renderHook(() => useProjectsMotion({ current: section }));
    expect(wheel.create).toHaveBeenCalledWith(section, { start: undefined, view: 'grid' });
  });
});
