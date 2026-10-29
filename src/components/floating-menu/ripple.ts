// The ripple menu's geometry. One ring per item around the
// hub (the circle's center), outermost first, each label written along its ring's arc.

export const RIPPLE = {
  desktop: { fontSize: 96, inner: 170, step: 128, angle: 222 },
  phone: { fontSize: 50, inner: 128, step: 78, angle: 241 },
  /** Below this width, the phone sizes. */
  phoneBelow: 768,
  /** The arc each label is written on, in screen degrees (180 is left of the hub, 270 up). */
  arc: [140, 310],
  /** How far the outermost label stays from the screen's top and left edges. */
  margin: 24,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface Ring {
  radius: number;
  fontSize: number;
  /** An SVG path along the ring, clockwise from `RIPPLE.arc[0]` to `RIPPLE.arc[1]`. */
  path: string;
  /** Where the label's middle sits along `path` (with `text-anchor: middle`). */
  startOffset: number;
}

export interface RippleLayout {
  rings: Ring[];
  /** The flood's radius: the hub's distance to the farthest screen corner. */
  flood: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const round = (n: number) => Math.round(n * 100) / 100;

export function rippleLayout(
  { width, height, hub }: { width: number; height: number; hub: Point },
  count: number,
): RippleLayout {
  const size = width < RIPPLE.phoneBelow ? RIPPLE.phone : RIPPLE.desktop;
  const outer = size.inner + (count - 1) * size.step;

  // The outermost label's far edge, along its angle, must clear the top and left edges.
  const reach = outer + size.fontSize;
  const angle = rad(size.angle);
  const k = Math.min(
    1,
    (hub.y - RIPPLE.margin) / (reach * Math.abs(Math.sin(angle))),
    (hub.x - RIPPLE.margin) / (reach * Math.abs(Math.cos(angle))),
  );

  const [from, to] = RIPPLE.arc;
  const at = (r: number, deg: number) =>
    `${round(hub.x + r * Math.cos(rad(deg)))} ${round(hub.y + r * Math.sin(rad(deg)))}`;
  const rings = Array.from({ length: count }, (_, i) => {
    const radius = round((size.inner + (count - 1 - i) * size.step) * k);
    return {
      radius,
      fontSize: round(size.fontSize * k),
      path: `M ${at(radius, from)} A ${radius} ${radius} 0 0 1 ${at(radius, to)}`,
      startOffset: round(radius * rad(size.angle - from)),
    };
  });

  return { rings, flood: floodRadius(hub, width, height) };
}

/** The hub's distance to the farthest corner of a `width` × `height` screen. */
export function floodRadius(hub: Point, width: number, height: number): number {
  return Math.hypot(Math.max(hub.x, width - hub.x), Math.max(hub.y, height - hub.y));
}

/** How far the circle rises to stay above the footer: as far as the footer has come up. */
export function circleLift(viewportHeight: number, floorTop: number | null): number {
  return floorTop === null ? 0 : Math.max(0, viewportHeight - floorTop);
}
