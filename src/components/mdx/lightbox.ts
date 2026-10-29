// The gallery lightbox: a native modal <dialog> on ink that shows
// one full image at a time. Expects the gallery root to contain:
//   [data-gallery-item]       links to the full images (href), with data-caption, holding the
//                             thumbnail <img> whose alt the full image reuses
//   <dialog data-lightbox>    holding [data-lightbox-counter], [data-lightbox-close],
//                             [data-lightbox-stage] > [data-lightbox-image] + [data-lightbox-caption],
//                             and [data-lightbox-step="-1"] / [data-lightbox-step="1"]
// Without JS the thumbnails are plain links to the full images.

import { swipeStep, wrapIndex } from '../crew/select';
import { createRunner, easings } from '../motion/animation';

export const LIGHTBOX_MOTION = {
  open: { fade: 200, image: 300, scale: 0.96 },
  step: 200,
  close: 150,
};

export interface LightboxOptions {
  /** Reduced motion: open, step, and close instantly. */
  reduced: boolean;
}

export function createLightbox(root: HTMLElement, { reduced }: LightboxOptions) {
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-lightbox]');
  const image = dialog?.querySelector<HTMLImageElement>('[data-lightbox-image]');
  const caption = dialog?.querySelector<HTMLElement>('[data-lightbox-caption]');
  const counter = dialog?.querySelector<HTMLElement>('[data-lightbox-counter]');
  const closeButton = dialog?.querySelector<HTMLElement>('[data-lightbox-close]');
  const stage = dialog?.querySelector<HTMLElement>('[data-lightbox-stage]');
  if (!dialog || !image || !caption || !counter) return { destroy() {} };

  const items = [...root.querySelectorAll<HTMLAnchorElement>('[data-gallery-item]')];
  const runner = createRunner();
  const ease = easings();
  let index = 0;
  let closing = false;

  const show = (next: number) => {
    index = wrapIndex(next, 0, items.length);
    const item = items[index];
    image.src = item.getAttribute('href') ?? '';
    image.alt = item.querySelector('img')?.alt ?? '';
    const text = item.dataset.caption ?? '';
    caption.textContent = text;
    caption.hidden = text === '';
    counter.textContent = `${index + 1} / ${items.length}`;
  };

  const open = (at: number) => {
    show(at);
    closing = false;
    dialog.showModal();
    closeButton?.focus();
    if (reduced) return;
    const { open: motion } = LIGHTBOX_MOTION;
    runner.run(
      dialog,
      { opacity: 0 },
      { opacity: 1 },
      {
        duration: motion.fade,
        delay: 0,
        easing: ease.lift,
      },
    );
    runner.run(
      image,
      { opacity: 0, transform: `scale(${motion.scale})` },
      { opacity: 1, transform: 'none' },
      { duration: motion.image, delay: 0, easing: ease.throw },
    );
  };

  const step = (delta: number) => {
    show(index + delta);
    if (reduced) return;
    runner.run(
      image,
      { opacity: 0 },
      { opacity: 1 },
      {
        duration: LIGHTBOX_MOTION.step,
        delay: 0,
        easing: ease.throw,
      },
    );
  };

  const close = () => {
    if (closing || !dialog.hasAttribute('open')) return;
    if (reduced) {
      dialog.close();
      return;
    }
    closing = true;
    runner
      .run(
        dialog,
        { opacity: 1 },
        { opacity: 0 },
        {
          duration: LIGHTBOX_MOTION.close,
          delay: 0,
          easing: ease.lift,
        },
      )
      .finished.then(() => {
        closing = false;
        dialog.close();
      });
  };

  // A plain left click on a thumbnail opens the lightbox; modified clicks open the file instead.
  const onRootClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLAnchorElement>('[data-gallery-item]');
    if (!item || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(items.indexOf(item));
  };

  const onDialogClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const stepButton = target?.closest<HTMLElement>('[data-lightbox-step]');
    if (stepButton) step(Number(stepButton.dataset.lightboxStep));
    else if (target?.closest('[data-lightbox-close]')) close();
    // The ink around the image (the dialog itself, or the stage around the image) closes.
    else if (target === dialog || target === stage) close();
  };

  const onKey = (event: KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    step(delta);
  };

  // Escape: fade out instead of the instant native close.
  const onCancel = (event: Event) => {
    event.preventDefault();
    close();
  };

  let press: { x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    press = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!press) return;
    const delta = swipeStep(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (delta !== 0) step(delta);
  };

  root.addEventListener('click', onRootClick);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('keydown', onKey);
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('pointerup', onPointerUp);

  return {
    destroy() {
      root.removeEventListener('click', onRootClick);
      dialog.removeEventListener('click', onDialogClick);
      dialog.removeEventListener('keydown', onKey);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
      runner.cancelAll();
    },
  };
}
