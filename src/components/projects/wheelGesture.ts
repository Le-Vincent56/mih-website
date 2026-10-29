// Groups wheel and trackpad events into gestures, so one swipe (with its momentum) or one run of
// wheel notches turns the projects wheel by one step (projects, "Links and interaction").

/** Times in ms, sizes in px of deltaY. */
export const WHEEL_GESTURE = {
  /** A longer pause between events ends the gesture. */
  quiet: 200,
  /** How long a gesture runs before a surge can start a new one: a swipe's own ramp-up
   * isn't a new swipe. */
  rearm: 600,
  /** A surge: an event this many times larger than the recent ones, and at least `floor`. */
  surge: 2,
  floor: 10,
  /** How many recent events a surge is measured against. */
  recent: 5,
} as const;

export interface WheelGesture {
  /** Feeds one event's deltaY (non-zero) and time; true when it starts a new gesture. */
  next(deltaY: number, time: number): boolean;
}

export function createWheelGesture(): WheelGesture {
  const G = WHEEL_GESTURE;
  let started = -Infinity;
  let last = -Infinity;
  let sign = 0;
  let recent: number[] = [];

  return {
    next(deltaY, time) {
      const size = Math.abs(deltaY);
      const surged =
        time - started >= G.rearm && size >= G.floor && size > G.surge * Math.max(...recent);
      const fresh = time - last > G.quiet || Math.sign(deltaY) !== sign || surged;
      if (fresh) {
        started = time;
        sign = Math.sign(deltaY);
        recent = [];
      }
      last = time;
      recent = [...recent, size].slice(-G.recent);
      return fresh;
    },
  };
}
