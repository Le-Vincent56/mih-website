// The studio intro's stations and timeline.
import type { Studio } from '../../content';
import { accentVar } from '../../content/schema';

export type Align = 'left' | 'right' | 'center';

export interface Station {
  title: string;
  text: string;
  /** Small label above the title; empty when there is none. */
  label: string;
  /** CSS colors, e.g. `var(--mih-paper)`. */
  background: string;
  foreground: string;
  align: Align;
}

const PAPER = 'var(--mih-paper)';
const INK = 'var(--mih-ink)';

export function buildStations(studio: Studio): Station[] {
  return [
    {
      title: 'VISION',
      text: studio.vision,
      label: '',
      background: PAPER,
      foreground: INK,
      align: 'left',
    },
    {
      title: 'MISSION',
      text: studio.mission,
      label: '',
      background: INK,
      foreground: PAPER,
      align: 'right',
    },
    ...studio.values.map((value): Station => ({
      title: value.title.toUpperCase(),
      text: value.text,
      label: 'VALUES',
      background: accentVar(value.accent),
      foreground: INK,
      align: 'center',
    })),
  ];
}

/** The empty paper station the stage ends on, so the frame lets go on paper (section handovers). */
export const EXIT_STATION: Station = {
  title: '',
  text: '',
  label: '',
  background: PAPER,
  foreground: INK,
  align: 'center',
};

/** The stations the stage plays: the content's, then the exit. The panels don't get it. */
export const withExit = (stations: Station[]): Station[] => [...stations, EXIT_STATION];

/** Screens of scroll each station holds still. */
export const HOLD = 0.5;

/** Screens of scroll each transition takes. */
export const TRANSITION = 0.7;

/** Screens of scroll the exit takes: shorter, since nothing new rolls in, and no hold follows. */
export const EXIT = 0.5;

/** The pinned scroll in screens for `count` stations, the exit included. */
export const pinnedScreens = (count: number): number =>
  (count - 1) * HOLD + (count - 2) * TRANSITION + EXIT;

/**
 * The transition `k` (0..count-2) and its local progress `t` (0..1) at scroll progress `p`.
 * The last transition is the exit. During a hold it is the start of the next transition.
 */
export function locate(p: number, count: number): { k: number; t: number } {
  const last = count - 2;
  if (p >= 1) return { k: last, t: 1 };
  let x = p * pinnedScreens(count) - HOLD;
  if (x <= 0) return { k: 0, t: 0 };
  for (let k = 0; k < last; k++) {
    if (x < TRANSITION) return { k, t: x / TRANSITION };
    x -= TRANSITION;
    if (x < HOLD) return { k: k + 1, t: 0 };
    x -= HOLD;
  }
  return { k: last, t: Math.min(x / EXIT, 1) };
}

/** Into Mission and into the first value the title slides; between values it swaps in place. */
export function kindOf(k: number): 'slide' | 'swap' {
  return k <= 1 ? 'slide' : 'swap';
}
