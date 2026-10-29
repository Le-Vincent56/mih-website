import { type RefObject, useEffect } from 'react';
import { createLightbox } from './lightbox';

// Mounts the gallery lightbox. It's how the full images are
// reached, so it runs with or without motion; reduced motion only makes it instant.
export function useLightbox(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return createLightbox(root, { reduced }).destroy;
  }, [rootRef]);
}
