// The accent hover on the header and footer links. Each time the pointer enters a link inside the root, the link pulls a random
// accent into `--hover-accent`, never the one it showed last. The CSS Modules decide which links
// use it (and only under `@media (hover: hover)`), so the row menu inside the header ignores it.

import { type RefObject, useEffect } from 'react';
import { ACCENTS, type Accent, accentVar } from '../../content';

/** A random accent other than `previous` (the link's last one). */
export function pickAccent(previous: Accent | undefined, random: () => number = Math.random) {
  const options = ACCENTS.filter((accent) => accent !== previous);
  return options[Math.floor(random() * options.length)];
}

/** Wires the accent pull to every link inside the root, for as long as it's mounted. */
export function useAccentHover(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const last = new WeakMap<HTMLElement, Accent>();

    const onOver = (event: PointerEvent) => {
      const link = (event.target as Element).closest<HTMLElement>('a');
      if (!link || !root.contains(link)) return;
      // Moving between the link's own parts (icon, label) isn't a new hover.
      if (event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) return;
      const accent = pickAccent(last.get(link));
      last.set(link, accent);
      link.style.setProperty('--hover-accent', accentVar(accent));
    };

    root.addEventListener('pointerover', onOver);
    return () => root.removeEventListener('pointerover', onOver);
  }, [ref]);
}
