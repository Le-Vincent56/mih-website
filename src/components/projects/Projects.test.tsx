// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type Project, accentVar, projects } from '../../content';
import { Projects } from './Projects';
import { counterText, gridColumns, splitTitle } from './wheel';

// The motion is tested in its own modules; here it only records the ref it was given.
const motion = vi.hoisted(() => ({ ref: null as { current: HTMLElement | null } | null }));
vi.mock('./useProjectsMotion', () => ({
  useProjectsMotion: (ref: { current: HTMLElement | null }) => {
    motion.ref = ref;
  },
}));

// The real content by default; a test can swap in its own list.
const content = vi.hoisted(() => ({ override: null as Project[] | null }));
vi.mock('../../content', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../content')>();
  return {
    ...real,
    get projects() {
      return content.override ?? real.projects;
    },
  };
});

const fake = (slug: string, overrides: Partial<Project> = {}): Project => ({
  slug,
  title: slug,
  status: 'Concept',
  accent: 'gold',
  folder: `projects/${slug}`,
  keyArt: `/${slug}.png`,
  keyArtSrcset: `/${slug}-960.webp 960w`,
  ogImage: `/${slug}-og.jpg`,
  keyArtFocus: 'center',
  order: 1,
  draft: false,
  description: `About ${slug}.`,
  links: [],
  facts: [],
  Content: () => null,
  ...overrides,
});

const renderProjects = () =>
  render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>,
  );

beforeEach(() => {
  content.override = null;
  motion.ref = null;
});

afterEach(cleanup);

describe('Projects', () => {
  test('is the #projects section, labelled by its heading', () => {
    renderProjects();
    const section = screen.getByRole('region', { name: 'Projects' });
    expect(section.id).toBe('projects');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Projects');
    expect(motion.ref?.current).toBe(section);
  });

  test('sits alone in the scroll hold wrapper', () => {
    renderProjects();
    const section = screen.getByRole('region', { name: 'Projects' });
    const hold = section.parentElement!;
    expect(hold.hasAttribute('data-hold')).toBe(true);
    expect(hold.children).toHaveLength(1);
  });

  test('lists every project in order with its title, status, description, and links', () => {
    renderProjects();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(
      items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['Fast Frankie', 'Good Luck Valley']);
    const [frankie, valley] = items;
    expect(within(valley).getByText('In development')).not.toBeNull();
    // Read from the content, so copy edits don't break the test.
    expect(within(frankie).getByText(projects[0].description)).not.toBeNull();
    const card = within(frankie).getByRole('link', { name: 'Fast Frankie' });
    expect(card.getAttribute('href')).toBe('/projects/fast-frankie');
    expect(card.querySelector('img')!.getAttribute('alt')).toBe('');
    const more = within(frankie).getByRole('link', { name: 'View project' });
    expect(more.getAttribute('href')).toBe('/projects/fast-frankie');
  });

  test('splits each title into hidden letters for the roll', () => {
    renderProjects();
    const [, valley] = within(screen.getByRole('list')).getAllByRole('listitem');
    const letters = [...valley.querySelectorAll('[data-letter]')].map((el) => el.textContent);
    expect(letters).toEqual(splitTitle('Good Luck Valley').flat());
    expect(valley.querySelector('[data-letter]')!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  test('carries the data attributes the motion reads', () => {
    const { container } = renderProjects();
    expect(container.querySelector('[data-wheel-spot]')!.getAttribute('aria-hidden')).toBe('true');
    const item = container.querySelector('[data-project]')!;
    for (const selector of [
      '[data-card]',
      '[data-art]',
      '[data-info]',
      '[data-piece="title"]',
      '[data-piece="status"]',
      '[data-piece="description"]',
      '[data-piece="link"]',
    ]) {
      expect(item.querySelector(selector), selector).not.toBeNull();
    }
    expect(container.querySelector('[data-announce]')!.getAttribute('aria-live')).toBe('polite');
  });

  test('sets the grid columns and each project accent', () => {
    renderProjects();
    const list = screen.getByRole('list');
    expect(list.style.getPropertyValue('--cols')).toBe(String(gridColumns(2)));
    const [frankie, valley] = within(list).getAllByRole('listitem');
    expect(frankie.style.getPropertyValue('--accent')).toBe(accentVar('red'));
    expect(valley.style.getPropertyValue('--accent')).toBe(accentVar('green'));
  });

  test('offers the view toggle and wheel controls for two or more projects', () => {
    renderProjects();
    const toggle = screen.getByRole('group', { name: 'View' });
    const wheel = within(toggle).getByRole('button', { name: 'Wheel view' });
    const grid = within(toggle).getByRole('button', { name: 'Grid view' });
    expect([wheel.dataset.viewButton, wheel.getAttribute('aria-pressed')]).toEqual([
      'wheel',
      'true',
    ]);
    expect([grid.dataset.viewButton, grid.getAttribute('aria-pressed')]).toEqual(['grid', 'false']);
    // Icons only: the names come from aria-label, and the capsule's thumb is decoration.
    expect(wheel.textContent).toBe('');
    expect(wheel.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(toggle.querySelector('[data-thumb]')!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Previous project' }).dataset.step).toBe('-1');
    for (const name of ['Previous project', 'Next project']) {
      const ink = screen.getByRole('button', { name }).querySelector('[data-ink]');
      expect(ink?.getAttribute('aria-hidden'), name).toBe('true');
    }
    expect(screen.getByRole('button', { name: 'Next project' }).dataset.step).toBe('1');
    const counter = document.querySelector('[data-counter]')!;
    expect(counter.textContent).toBe(counterText(0, 2));
    expect(counter.getAttribute('aria-hidden')).toBe('true');
  });

  test('has no toggle or controls for a single project', () => {
    content.override = [fake('solo')];
    renderProjects();
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('[data-counter]')).toBeNull();
  });

  test('crops each key art toward its focus', () => {
    content.override = [fake('centered'), fake('leaning', { keyArtFocus: 'left' })];
    renderProjects();
    const art = [...document.querySelectorAll('[data-art]')];
    expect(art.map((img) => img.getAttribute('data-focus'))).toEqual(['center', 'left']);
  });

  test('marks a draft project', () => {
    content.override = [fake('shipping'), fake('secret', { draft: true })];
    renderProjects();
    const [shipping, secret] = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(within(secret).getByText('Draft')).not.toBeNull();
    expect(within(shipping).queryByText('Draft')).toBeNull();
  });

  test('renders nothing without projects', () => {
    content.override = [];
    const { container } = renderProjects();
    expect(container.innerHTML).toBe('');
  });
});
