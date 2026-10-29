// Where choosing a menu item goes: a target on this page
// is scrolled to in place; anything else is reached by route, then scrolled to once it renders.

export type JumpTarget = { kind: 'scroll'; top: number } | { kind: 'route'; to: string };

/** How long to wait for a new page to render the target before giving up. */
const WAIT_FOR_PAGE = 1500;

const hashId = (href: string) => (href.includes('#') ? href.slice(href.indexOf('#') + 1) : null);

/** Home (`/`) is the top of the homepage; `/#id` is that element, wherever it is. */
export function jumpTarget(
  href: string,
  pathname: string,
  byId: (id: string) => Element | null,
  scrollY: number,
): JumpTarget {
  const id = hashId(href);
  if (id === null)
    return pathname === '/' ? { kind: 'scroll', top: 0 } : { kind: 'route', to: href };
  const el = byId(id);
  return el
    ? { kind: 'scroll', top: el.getBoundingClientRect().top + scrollY }
    : { kind: 'route', to: href };
}

const twoFrames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

function waitForId(id: string, timeout: number): Promise<HTMLElement | null> {
  const present = document.getElementById(id);
  if (present) return Promise.resolve(present);
  return new Promise((resolve) => {
    const done = (found: HTMLElement | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(found);
    };
    const observer = new MutationObserver(() => {
      const found = document.getElementById(id);
      if (found) done(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => done(null), timeout);
  });
}

const scrollToTop = (top: number) => window.scrollTo({ top, behavior: 'auto' });

/**
 * Jumps instantly (it runs under the menu's ink) and resolves two frames later, once the page
 * has settled where it landed.
 */
export async function jumpTo(
  href: string,
  pathname: string,
  navigate: (to: string) => void,
): Promise<void> {
  const target = jumpTarget(href, pathname, (id) => document.getElementById(id), window.scrollY);
  if (target.kind === 'scroll') {
    scrollToTop(target.top);
  } else {
    navigate(target.to);
    const id = hashId(target.to);
    const el = id === null ? null : await waitForId(id, WAIT_FOR_PAGE);
    scrollToTop(el ? el.getBoundingClientRect().top + window.scrollY : 0);
  }
  await twoFrames();
}
