// Bar or circle: the bar at the very top of the page, the circle
// once the page's zone has passed under the bar, and whichever it was in between.

export type Mode = 'bar' | 'circle';

/** Below this scroll position the page is at its very top. */
const TOP = 1;

/**
 * `zoneEnd` is the scroll position where the zone's bottom edge meets the bar's bottom edge, or
 * null on a page without a zone. While `frozen` (the menu is open), the mode holds, so the menu's
 * own jumps never count.
 */
export function nextBarMode(mode: Mode, y: number, zoneEnd: number | null, frozen = false): Mode {
  if (frozen) return mode;
  if (zoneEnd === null || y < TOP) return 'bar';
  return y > zoneEnd ? 'circle' : mode;
}
