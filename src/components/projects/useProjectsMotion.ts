import { type RefObject, useEffect } from 'react';
import { returningTo } from '../project/artMorph';
import { createListReveal } from './listReveal';
import { createProjectsWheel } from './projectsWheel';
import { rememberedView } from './projectsView';

/** The width at which the section becomes the wheel (projects, "Desktop layout"). */
export const WHEEL_QUERY = '(min-width: 960px)';

// Runs the projects section's motion (projects, "Runtime"): the wheel at 960px and wider,
// the list reveal below, swapping when the width crosses 960px. Only under the motion gate
// (html.mih-motion) and without reduced motion; otherwise the markup stays the fallback.
export function useProjectsMotion(sectionRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let stop: (() => void) | undefined;
    const html = document.documentElement;

    const start = () => {
      const wide = window.matchMedia(WHEEL_QUERY);
      let controller = { destroy() {} };
      const mount = () => {
        controller.destroy();
        // Coming back from a project page, the section opens on that project, in the view the
        // visitor last chose.
        const start = returningTo() ?? undefined;
        controller = wide.matches
          ? createProjectsWheel(section, { start, view: rememberedView() })
          : createListReveal(section);
      };
      mount();
      wide.addEventListener('change', mount);
      stop = () => {
        wide.removeEventListener('change', mount);
        controller.destroy();
      };
    };

    // The gate adds mih-motion once Koulen loads (up to 1.5s), possibly after this mounts.
    let gate: MutationObserver | undefined;
    if (html.classList.contains('mih-motion')) start();
    else {
      gate = new MutationObserver(() => {
        if (!html.classList.contains('mih-motion')) return;
        gate?.disconnect();
        start();
      });
      gate.observe(html, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      gate?.disconnect();
      stop?.();
    };
  }, [sectionRef]);
}
