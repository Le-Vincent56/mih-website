// The hero's rows and intro timing (hero, "Intro sequence"). Components pass these values to
// CSS as custom properties, so each number lives only here.

export const ROW_TEXT = 'MADE IN HOUSE';

/** Copies of ROW_TEXT in each of a strip's two identical halves; a half must be at least one
 *  viewport wide, including on ultrawide screens. */
export const REPEATS_PER_HALF = 3;

/** Rows rendered. Desktop shows the first four; phones show all seven. */
export const ROW_COUNT = 7;

/** Seconds between consecutive rows, equal from top to bottom. */
export const ROW_STAGGER = 0.15;

/** The solid row that crosses in front of the crew as an outline, per breakpoint. */
export const FRONT_ROW = { desktop: 2, phone: 4 } as const;

/** Seconds until the header bar slides in. */
export const HEADER_DELAY = 1.7;

export interface HeroRow {
  index: number;
  style: 'solid' | 'outline';
  /** Solid rows are thrown in from the right and drift left; outline rows the reverse. */
  enters: 'right' | 'left';
  /** Seconds from the start of the intro. */
  delay: number;
}

export function heroRows(count = ROW_COUNT): HeroRow[] {
  return Array.from({ length: count }, (_, index) => {
    const solid = index % 2 === 0;
    return {
      index,
      style: solid ? 'solid' : 'outline',
      enters: solid ? 'right' : 'left',
      delay: Math.round(index * ROW_STAGGER * 100) / 100,
    };
  });
}
