import { describe, expect, test } from 'vitest';
import { isDriftPaused, setDriftPaused, toggleDriftPaused } from './driftPause';

const fakeRoot = () => ({ dataset: {} as DOMStringMap });

describe('drift pause', () => {
  test('is off until set', () => {
    expect(isDriftPaused(fakeRoot())).toBe(false);
  });

  test('is stored as data-drift="paused" and cleared when resumed', () => {
    const root = fakeRoot();
    setDriftPaused(true, root);
    expect(root.dataset.drift).toBe('paused');
    expect(isDriftPaused(root)).toBe(true);
    setDriftPaused(false, root);
    expect(root.dataset.drift).toBeUndefined();
  });

  test('toggles and returns the new state', () => {
    const root = fakeRoot();
    expect(toggleDriftPaused(root)).toBe(true);
    expect(toggleDriftPaused(root)).toBe(false);
    expect(isDriftPaused(root)).toBe(false);
  });
});
