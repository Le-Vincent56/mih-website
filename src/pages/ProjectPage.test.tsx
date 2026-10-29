// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { projects } from '../content';
import { koulenEm } from '../components/project/title';
import { ProjectPage } from './ProjectPage';

// vite-react-ssg's <Head> needs its Helmet provider; here it renders its tags, which React 19
// hoists into document.head.
vi.mock('vite-react-ssg', () => ({
  Head: ({ children }: { children: ReactNode }) => <div data-testid="head">{children}</div>,
}));

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: '/projects/:slug', element: <ProjectPage /> },
      { path: '/', element: <p>Home</p> },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
};

afterEach(cleanup);

const frankie = projects.find((p) => p.slug === 'fast-frankie')!;
const valley = projects.find((p) => p.slug === 'good-luck-valley')!;

describe('ProjectPage', () => {
  test('heads the page with the title, its letters split for the roll, sized by --title-em', () => {
    const { container } = renderAt('/projects/fast-frankie');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain('Fast Frankie');
    const glyphs = [...h1.querySelectorAll('[aria-hidden="true"] [data-glyph]')];
    expect(glyphs.map((g) => g.textContent).join('')).toBe('FastFrankie');
    expect(glyphs.map((g) => (g as HTMLElement).style.getPropertyValue('--i'))).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i)),
    );
    const article = container.querySelector('article')!;
    expect(article.style.getPropertyValue('--title-em')).toBe(String(koulenEm('Fast Frankie')));
    expect(article.style.getPropertyValue('--accent')).toBe('var(--mih-brody-red)');
  });

  test('arrives with its entry when no art flight brought it here', () => {
    const { container } = renderAt('/projects/fast-frankie');
    expect(container.querySelector('article')!.dataset.arrival).toBe('entry');
  });

  test('shows the key art as the morph destination, with its srcset and focus', () => {
    const { container } = renderAt('/projects/good-luck-valley');
    const hero = container.querySelector('[data-art-target]')!;
    const img = hero.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(valley.keyArt);
    expect(img.getAttribute('srcset')).toBe(valley.keyArtSrcset);
    expect(img.getAttribute('sizes')).toBe('100vw');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.dataset.focus).toBe('left');
    expect(container.querySelectorAll('[data-art-target]')).toHaveLength(1);
  });

  test('makes the key art the zone the site header collapses past', () => {
    const { container } = renderAt('/projects/fast-frankie');
    expect(container.querySelector('[data-art-target]')!.hasAttribute('data-bar-zone')).toBe(true);
    expect(container.querySelectorAll('[data-bar-zone]')).toHaveLength(1);
  });

  test('links back to the Projects section and leads with the description', () => {
    renderAt('/projects/fast-frankie');
    expect(screen.getByRole('link', { name: /Projects/ }).getAttribute('href')).toBe('/#projects');
    expect(screen.getByText(frankie.description).tagName).toBe('P');
  });

  test('puts the status, links, and facts in the rail', () => {
    renderAt('/projects/good-luck-valley');
    const rail = screen.getByRole('complementary', { name: 'About Good Luck Valley' });
    expect(within(rail).getByText(valley.status)).toBeTruthy();
    const links = within(rail).getAllByRole('link');
    expect(
      links.map((a) => [a.textContent?.replace('↗', '').trim(), a.getAttribute('href')]),
    ).toEqual(valley.links.map((l) => [l.label, l.url]));
    expect(links[0].dataset.primary).toBe('');
    const terms = [...rail.querySelectorAll('dt')].map((dt) => dt.textContent);
    const values = [...rail.querySelectorAll('dd')].map((dd) => dd.textContent);
    expect(terms).toEqual(valley.facts.map((f) => f.label));
    expect(values).toEqual(valley.facts.map((f) => f.value));
  });

  test('gives outlined buttons the hover fill and leaves the primary filled', () => {
    renderAt('/projects/good-luck-valley');
    const rail = screen.getByRole('complementary');
    const [primary] = within(rail).getAllByRole('link');
    expect(primary.hasAttribute('data-hover-fill')).toBe(false);
  });

  test("renders the MDX body's headings", () => {
    renderAt('/projects/fast-frankie');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain(
      'The game',
    );
  });

  test('ends with the next project, wrapping around', () => {
    renderAt('/projects/good-luck-valley');
    const next = screen.getByRole('navigation', { name: 'Next project' });
    const link = within(next).getByRole('link', { name: 'Next project: Fast Frankie' });
    expect(link.getAttribute('href')).toBe('/projects/fast-frankie');
  });

  test('writes the head tags', () => {
    renderAt('/projects/fast-frankie');
    const head = document.head;
    expect(head.querySelector('title')!.textContent).toBe('Fast Frankie | Made In House');
    expect(head.querySelector('meta[name="description"]')!.getAttribute('content')).toBe(
      frankie.description,
    );
    expect(head.querySelector('meta[property="og:title"]')!.getAttribute('content')).toBe(
      'Fast Frankie',
    );
    expect(head.querySelector('meta[name="twitter:card"]')!.getAttribute('content')).toBe(
      'summary_large_image',
    );
  });

  test('shows the not-found page for an unknown slug', () => {
    renderAt('/projects/nope');
    expect(screen.queryByRole('heading', { level: 1, name: /Fast Frankie/ })).toBeNull();
    expect(document.querySelector('article')).toBeNull();
  });
});
