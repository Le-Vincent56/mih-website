// The wheel arrows' hover fill: an ink circle grows
// from the point where the pointer enters until it covers the button, and drains into the point
// where it leaves. Mouse and pen only; a disabled (aria-disabled) button stays empty.

import { easings } from '../motion/animation';
import { PROJECTS_MOTION } from './wheel';

interface Box {
  width: number;
  height: number;
}

/**
 * A circle centered on (x, y) that exactly covers the round button or capsule at full size: its
 * radius reaches the button's farthest point (the distance to the farther end's center plus the
 * end's radius; a round button has one center), so the fill completes as its animation ends
 * instead of early. Capsules are the project page's buttons.
 */
export function inkCircle(x: number, y: number, box: Box) {
  const end = Math.min(box.width, box.height) / 2;
  const centers =
    box.width >= box.height
      ? [
          [end, box.height / 2],
          [box.width - end, box.height / 2],
        ]
      : [
          [box.width / 2, end],
          [box.width / 2, box.height - end],
        ];
  const radius = Math.max(...centers.map(([cx, cy]) => Math.hypot(x - cx, y - cy))) + end;
  return { left: x - radius, top: y - radius, size: 2 * radius };
}

/** The scale of a computed `transform` (`matrix(a, b, …)`); none counts as fully grown. */
export function scaleOf(transform: string): number {
  const match = /^matrix\(([^,]+),\s*([^,]+)/.exec(transform);
  return match ? Math.hypot(Number(match[1]), Number(match[2])) : 1;
}

/** Wires the fill to a button and its ink element; returns the detach function. */
export function attachHoverFill(button: HTMLElement, ink: HTMLElement): () => void {
  const { hoverFill } = PROJECTS_MOTION;
  const ease = easings();
  let animation: Animation | undefined;

  const place = (event: PointerEvent) => {
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - button.clientLeft;
    const y = event.clientY - rect.top - button.clientTop;
    const circle = inkCircle(x, y, { width: button.clientWidth, height: button.clientHeight });
    ink.style.left = `${circle.left}px`;
    ink.style.top = `${circle.top}px`;
    ink.style.width = ink.style.height = `${circle.size}px`;
  };

  const onEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || button.getAttribute('aria-disabled') === 'true') return;
    animation?.cancel();
    place(event);
    animation = ink.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
      duration: hoverFill.in,
      easing: ease.throw,
      fill: 'forwards',
    });
    button.setAttribute('data-filled', '');
  };

  const onLeave = (event: PointerEvent) => {
    if (!button.hasAttribute('data-filled')) return;
    // Start the drain from wherever the fill has reached, re-centered on the exit point.
    const from = scaleOf(getComputedStyle(ink).transform);
    animation?.cancel();
    place(event);
    animation = ink.animate([{ transform: `scale(${from})` }, { transform: 'scale(0)' }], {
      duration: hoverFill.out,
      easing: ease.throw,
      fill: 'forwards',
    });
    button.removeAttribute('data-filled');
  };

  button.addEventListener('pointerenter', onEnter);
  button.addEventListener('pointerleave', onLeave);
  return () => {
    button.removeEventListener('pointerenter', onEnter);
    button.removeEventListener('pointerleave', onLeave);
    animation?.cancel();
    button.removeAttribute('data-filled');
    for (const property of ['left', 'top', 'width', 'height']) ink.style.removeProperty(property);
  };
}
