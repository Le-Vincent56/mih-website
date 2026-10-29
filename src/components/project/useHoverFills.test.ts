// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useHoverFills } from './useHoverFills';

const fill = vi.hoisted(() => ({ attach: vi.fn(), detach: vi.fn() }));
vi.mock('../projects/hoverFill', () => ({
  attachHoverFill: (...args: unknown[]) => {
    fill.attach(...args);
    return fill.detach;
  },
}));

let media: Record<string, boolean>;

beforeEach(() => {
  media = { reduce: false, fine: true };
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduce')
        ? media.reduce
        : query.includes('fine')
          ? media.fine
          : false,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  fill.attach.mockClear();
  fill.detach.mockClear();
});

function root() {
  const el = document.createElement('div');
  el.innerHTML = `
    <a data-hover-fill id="one"><span data-ink id="ink-one"></span>Play</a>
    <a data-hover-fill id="two"><span data-ink id="ink-two"></span>Wishlist</a>
    <a id="plain">Primary</a>`;
  return el;
}

describe('useHoverFills', () => {
  test('attaches the radial fill to every [data-hover-fill] with its ink, and detaches', () => {
    const el = root();
    const { unmount } = renderHook(() => useHoverFills({ current: el }));
    expect(fill.attach.mock.calls.map(([button, ink]) => [button.id, ink.id])).toEqual([
      ['one', 'ink-one'],
      ['two', 'ink-two'],
    ]);
    unmount();
    expect(fill.detach).toHaveBeenCalledTimes(2);
  });

  test('does nothing under reduced motion or without a fine pointer', () => {
    media.reduce = true;
    renderHook(() => useHoverFills({ current: root() }));
    media.reduce = false;
    media.fine = false;
    renderHook(() => useHoverFills({ current: root() }));
    expect(fill.attach).not.toHaveBeenCalled();
  });
});
