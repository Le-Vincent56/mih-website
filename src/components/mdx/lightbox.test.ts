// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LIGHTBOX_MOTION, createLightbox } from './lightbox';

interface Played {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let played: Played[] = [];

function build(count = 3) {
  const items = Array.from(
    { length: count },
    (_, i) => `
      <li><a data-gallery-item href="/full-${i}.png" data-caption="${i === 1 ? '' : `Caption ${i}`}">
        <img src="/thumb-${i}.png" alt="Shot ${i}"></a></li>`,
  ).join('');
  document.body.innerHTML = `
    <div id="gallery">
      <ul>${items}</ul>
      <dialog data-lightbox>
        <p data-lightbox-counter></p>
        <button data-lightbox-close>Close</button>
        <figure data-lightbox-stage>
          <img data-lightbox-image alt="">
          <figcaption data-lightbox-caption></figcaption>
        </figure>
        <button data-lightbox-step="-1">Previous</button>
        <button data-lightbox-step="1">Next</button>
      </dialog>
    </div>`;
  const dialog = document.querySelector('dialog')!;
  // jsdom has no showModal/close.
  dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
  dialog.close = vi.fn(() => dialog.removeAttribute('open'));
  Element.prototype.animate = vi.fn(function (this: Element, keyframes, options) {
    played.push({
      el: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    return { finished: Promise.resolve(), cancel: vi.fn() } as unknown as Animation;
  });
  return { root: document.getElementById('gallery')!, dialog };
}

const image = () => document.querySelector<HTMLImageElement>('[data-lightbox-image]')!;
const caption = () => document.querySelector<HTMLElement>('[data-lightbox-caption]')!;
const counter = () => document.querySelector('[data-lightbox-counter]')!.textContent;
const thumb = (i: number) => document.querySelectorAll<HTMLElement>('[data-gallery-item]')[i];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let destroy: () => void = () => {};

beforeEach(() => {
  played = [];
});

afterEach(() => {
  destroy();
  document.body.replaceChildren();
});

describe('createLightbox', () => {
  test('a click on a thumbnail opens that image with its caption and counter', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    thumb(2).querySelector('img')!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.showModal).toHaveBeenCalled();
    expect(image().getAttribute('src')).toBe('/full-2.png');
    expect(image().alt).toBe('Shot 2');
    expect(caption().textContent).toBe('Caption 2');
    expect(caption().hidden).toBe(false);
    expect(counter()).toBe('3 / 3');
    expect(document.activeElement).toBe(document.querySelector('[data-lightbox-close]'));
  });

  test('opening fades the dialog in and grows the image', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;
    thumb(0).click();

    const fade = played.find((p) => p.el === dialog)!;
    expect(fade.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(fade.options.duration).toBe(LIGHTBOX_MOTION.open.fade);
    const grow = played.find((p) => p.el === image())!;
    expect(grow.keyframes[0]).toEqual({ opacity: 0, transform: 'scale(0.96)' });
    expect(grow.options.duration).toBe(LIGHTBOX_MOTION.open.image);
  });

  test('the step buttons and arrow keys move through the images, wrapping at both ends', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;
    thumb(2).click();

    document.querySelector<HTMLElement>('[data-lightbox-step="1"]')!.click();
    expect(counter()).toBe('1 / 3');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(counter()).toBe('3 / 3');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(counter()).toBe('1 / 3');
    expect(image().getAttribute('src')).toBe('/full-0.png');
  });

  test('an image without a caption hides the caption line', () => {
    const { root } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;
    thumb(1).click();
    expect(caption().hidden).toBe(true);
  });

  test('a touch swipe to the left steps forward', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;
    thumb(0).click();

    dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 400 }));
    dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 410 }));
    expect(counter()).toBe('2 / 3');
  });

  test('Close, Escape, and a click on the ink fade out, then close the dialog', async () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;

    for (const close of [
      () => document.querySelector<HTMLElement>('[data-lightbox-close]')!.click(),
      () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })),
      () => dialog.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ]) {
      thumb(0).click();
      played = [];
      close();
      expect(played.find((p) => p.el === dialog)!.keyframes).toEqual([
        { opacity: 1 },
        { opacity: 0 },
      ]);
      await flush();
      expect(dialog.hasAttribute('open')).toBe(false);
    }
  });

  test('a click on the image itself keeps it open', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;
    thumb(0).click();
    image().click();
    expect(dialog.close).not.toHaveBeenCalled();
  });

  test('reduced motion opens, steps, and closes without animating', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: true }).destroy;
    thumb(0).click();
    document.querySelector<HTMLElement>('[data-lightbox-step="1"]')!.click();
    document.querySelector<HTMLElement>('[data-lightbox-close]')!.click();

    expect(played).toEqual([]);
    expect(dialog.close).toHaveBeenCalled();
  });

  test('a modified click is left to the browser (open in a new tab)', () => {
    const { root, dialog } = build();
    destroy = createLightbox(root, { reduced: false }).destroy;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    thumb(0).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  test('destroy stops listening', () => {
    const { root, dialog } = build();
    createLightbox(root, { reduced: false }).destroy();
    thumb(0).click();
    expect(dialog.showModal).not.toHaveBeenCalled();
  });
});
