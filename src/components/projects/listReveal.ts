// The phone list reveal (projects, "Phone list reveal"): each item that starts below the
// viewport waits with its art below its accent card and its text rolled out, then reveals the
// first time a quarter of it is on screen.

import { createRunner, easings, shifted, write } from '../motion/animation';
import { PROJECTS_MOTION } from './wheel';

const PIECES = ['title', 'status', 'description', 'link'];

export interface ListReveal {
  destroy(): void;
}

export function createListReveal(section: HTMLElement): ListReveal {
  const { phone } = PROJECTS_MOTION;
  const runner = createRunner();
  const ease = easings();
  const items = [...section.querySelectorAll<HTMLElement>('[data-project]')].map((root) => ({
    root,
    art: root.querySelector<HTMLElement>('[data-art]'),
    pieces: PIECES.map((name) => root.querySelector<HTMLElement>(`[data-piece="${name}"]`)),
  }));
  const touched = new Set<HTMLElement>();

  const reveal = (item: (typeof items)[number]) => {
    if (item.art) {
      runner.run(item.art, shifted(110), shifted(0), {
        duration: phone.rise,
        delay: 0,
        easing: ease.lift,
      });
    }
    item.pieces.forEach((el, i) => {
      if (!el) return;
      runner.run(el, shifted(110), shifted(0), {
        duration: phone.roll,
        delay: phone.textDelays[i],
        easing: ease.throw,
      });
    });
  };

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.intersectionRatio < phone.threshold) continue;
              const item = items.find(({ root }) => root === entry.target);
              if (!item) continue;
              observer?.unobserve(item.root);
              reveal(item);
            }
          },
          { threshold: phone.threshold },
        );

  if (observer) {
    for (const item of items) {
      if (item.root.getBoundingClientRect().top < window.innerHeight) continue;
      for (const el of [item.art, ...item.pieces]) {
        if (!el) continue;
        write(el, shifted(110));
        touched.add(el);
      }
      observer.observe(item.root);
    }
  }

  return {
    destroy() {
      observer?.disconnect();
      runner.cancelAll();
      for (const el of touched) el.style.removeProperty('transform');
    },
  };
}
