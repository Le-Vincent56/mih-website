import { describe, expect, test } from 'vitest';
import { RIPPLE, circleLift, rippleLayout } from './ripple';

const desktop = { width: 1440, height: 900, hub: { x: 1384, y: 844 } };
const phone = { width: 375, height: 812, hub: { x: 331, y: 768 } };

describe('rippleLayout', () => {
  test('one ring per item, outermost first, at the desktop sizes', () => {
    const { rings } = rippleLayout(desktop, 5);
    expect(rings.map((r) => r.radius)).toEqual([682, 554, 426, 298, 170]);
    expect(rings.every((r) => r.fontSize === RIPPLE.desktop.fontSize)).toBe(true);
  });

  test('uses the phone sizes below 768px', () => {
    const { rings } = rippleLayout(phone, 5);
    expect(rings.map((r) => r.radius)).toEqual([440, 362, 284, 206, 128]);
    expect(rings[0].fontSize).toBe(50);
  });

  test('scales everything down so the outermost label clears a short screen', () => {
    const short = { width: 1280, height: 500, hub: { x: 1224, y: 444 } };
    const { rings } = rippleLayout(short, 5);
    const k = rings[0].fontSize / 96;
    expect(k).toBeLessThan(1);
    expect(rings[4].radius).toBeCloseTo(170 * k, 1);
    // The outermost label's far edge, along its angle, stops 24px under the top edge.
    const reach = (rings[0].radius + rings[0].fontSize) * Math.sin((222 - 180) * (Math.PI / 180));
    expect(short.hub.y - reach).toBeCloseTo(24, 0);
  });

  test("draws each label's arc from 140° to 310° around the hub, clockwise", () => {
    const { rings } = rippleLayout(desktop, 5);
    const r = rings[4].radius;
    const point = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return [desktop.hub.x + r * Math.cos(a), desktop.hub.y + r * Math.sin(a)];
    };
    const [x0, y0] = point(140);
    const [x1, y1] = point(310);
    const n = (v: number) => String(Math.round(v * 100) / 100);
    expect(rings[4].path).toBe(`M ${n(x0)} ${n(y0)} A ${r} ${r} 0 0 1 ${n(x1)} ${n(y1)}`);
  });

  test('centers each label at its angle along the arc', () => {
    const { rings } = rippleLayout(desktop, 5);
    const expected = rings[0].radius * ((222 - 140) * (Math.PI / 180));
    expect(rings[0].startOffset).toBeCloseTo(expected, 1);
  });

  test('floods out to the farthest screen corner', () => {
    expect(rippleLayout(desktop, 5).flood).toBeCloseTo(Math.hypot(1384, 844), 0);
    const middle = { width: 400, height: 400, hub: { x: 100, y: 300 } };
    expect(rippleLayout(middle, 5).flood).toBeCloseTo(Math.hypot(300, 300), 0);
  });
});

describe('circleLift', () => {
  test('is zero while the floor is below the screen', () => {
    expect(circleLift(900, 2400)).toBe(0);
    expect(circleLift(900, null)).toBe(0);
  });

  test('lifts the circle by as much as the floor has come up', () => {
    expect(circleLift(900, 700)).toBe(200);
  });
});
