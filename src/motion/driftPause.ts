// The drift pause lives on <html> as data-drift="paused", so the header's toggle and the hero's
// CSS share it without React state.

type Root = Pick<HTMLElement, 'dataset'>;

const root = (): Root => document.documentElement;

export function isDriftPaused(target: Root = root()): boolean {
  return target.dataset.drift === 'paused';
}

export function setDriftPaused(paused: boolean, target: Root = root()): void {
  if (paused) target.dataset.drift = 'paused';
  else delete target.dataset.drift;
}

/** Flips the pause and returns the new state. */
export function toggleDriftPaused(target: Root = root()): boolean {
  const paused = !isDriftPaused(target);
  setDriftPaused(paused, target);
  return paused;
}
