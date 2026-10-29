// The hero's exit as it scrolls away: the crew sinks and the rows fade.

/** Share of the hero's height it scrolls away over while the exit plays. */
const EXIT_DISTANCE = 0.5;

/** Exit progress, 0 to 1, linear in scroll, from the hero's rect top and height. */
export function heroExit(top: number, height: number): number {
  return Math.min(1, Math.max(0, -top / (EXIT_DISTANCE * height)));
}
