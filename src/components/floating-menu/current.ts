// The "you are here" ring.

import type { SectionLink } from '../../content/site';

const hashId = (href: string) => (href.includes('#') ? href.slice(href.indexOf('#') + 1) : null);

/**
 * The index of the current item, or -1 for none. On the homepage it's the last section whose top
 * (from `topOf`, relative to the screen) is above the middle of the screen: Home if none, the last
 * item at the very bottom of the page. On a project page it's Projects.
 */
export function currentSection(
  sections: readonly SectionLink[],
  pathname: string,
  topOf: (id: string) => number | null,
  viewportHeight: number,
  atBottom: boolean,
): number {
  if (pathname.startsWith('/projects/')) {
    return sections.findIndex((section) => section.href === '/#projects');
  }
  if (pathname !== '/') return -1;
  if (atBottom) return sections.length - 1;
  let current = 0;
  sections.forEach((section, i) => {
    const id = hashId(section.href);
    const top = id === null ? null : topOf(id);
    if (top !== null && top <= viewportHeight / 2) current = i;
  });
  return current;
}
