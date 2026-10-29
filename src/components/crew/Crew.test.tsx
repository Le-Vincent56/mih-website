// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type CrewMember, accentVar, crew } from '../../content';
import { Crew } from './Crew';

// The motion is tested in its own modules; here it only records the ref it was given.
const motion = vi.hoisted(() => ({ ref: null as { current: HTMLElement | null } | null }));
vi.mock('./useCrewMotion', () => ({
  useCrewMotion: (ref: { current: HTMLElement | null }) => {
    motion.ref = ref;
  },
}));

// The real content by default; a test can swap in its own list.
const content = vi.hoisted(() => ({ override: null as CrewMember[] | null }));
vi.mock('../../content', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../content')>();
  return {
    ...real,
    get crew() {
      return content.override ?? real.crew;
    },
  };
});

const fake = (slug: string): CrewMember => ({
  slug,
  name: slug,
  role: 'Role',
  accent: 'blue',
  photo: `/${slug}.jpg`,
  silhouette: `/${slug}.png`,
  order: 1,
  Bio: () => <p>Bio of {slug}.</p>,
});

beforeEach(() => {
  content.override = null;
  motion.ref = null;
});

afterEach(cleanup);

const section = () => screen.getByRole('region', { name: 'Crew' });

describe('Crew', () => {
  test('is the #crew section, labelled by its heading, with its ref given to the motion', () => {
    render(<Crew />);
    expect(section().id).toBe('crew');
    expect(screen.getByRole('heading', { level: 2, name: 'Crew' })).toBeTruthy();
    expect(motion.ref?.current).toBe(section());
  });

  test('sits alone in the scroll hold wrapper', () => {
    render(<Crew />);
    const hold = section().parentElement!;
    expect(hold.hasAttribute('data-hold')).toBe(true);
    expect(hold.children).toHaveLength(1);
  });

  test('lists a button per member in order, each controlling its article', () => {
    render(<Crew />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(crew.length);
    items.forEach((item, i) => {
      const button = within(item).getByRole('button', { name: crew[i].name });
      expect(button.getAttribute('aria-expanded')).toBe('false');
      const article = document.getElementById(button.getAttribute('aria-controls')!);
      expect(article?.tagName).toBe('ARTICLE');
      expect(article?.getAttribute('aria-labelledby')).toBe(
        within(article!).getByRole('heading', { level: 3 }).id,
      );
      expect(item.querySelector('img[data-silhouette]')?.getAttribute('src')).toBe(
        crew[i].silhouette,
      );
    });
  });

  test('each article holds the name, portrait, role, and rendered bio', () => {
    content.override = [fake('ada'), fake('lin')];
    render(<Crew />);
    const article = document.getElementById('crew-lin')!;
    expect(within(article).getByRole('heading', { level: 3, name: 'lin' })).toBeTruthy();
    expect(within(article).getByRole('img').getAttribute('alt')).toBe(
      'Illustrated portrait of lin',
    );
    expect(within(article).getByText('Role')).toBeTruthy();
    expect(within(article).getByText('Bio of lin.')).toBeTruthy();
  });

  test('the Koulen names are aria-hidden and split into letters', () => {
    render(<Crew />);
    const hoverNames = section().querySelectorAll('[data-hover-name]');
    const names = section().querySelectorAll('[data-name]');
    expect(hoverNames).toHaveLength(crew.length);
    expect(names).toHaveLength(crew.length);
    crew.forEach((member, i) => {
      for (const name of [hoverNames[i], names[i]]) {
        expect(name.getAttribute('aria-hidden')).toBe('true');
        expect(name.querySelectorAll('[data-letter]')).toHaveLength(member.name.length);
        expect(name.textContent).toBe(member.name.toUpperCase());
      }
    });
  });

  test('carries each accent and the member count', () => {
    render(<Crew />);
    expect(section().style.getPropertyValue('--count')).toBe(String(crew.length));
    const items = section().querySelectorAll<HTMLElement>('[data-member]');
    const articles = section().querySelectorAll<HTMLElement>('[data-panel]');
    crew.forEach((member, i) => {
      expect(items[i].style.getPropertyValue('--accent')).toBe(accentVar(member.accent));
      expect(articles[i].style.getPropertyValue('--accent')).toBe(accentVar(member.accent));
    });
  });

  test('the roster renders for two or more members', () => {
    render(<Crew />);
    const roster = screen.getByRole('group', { name: 'Choose a crew member' });
    expect(
      within(roster)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(crew.map((m) => m.name));
  });

  test('Back is a plain arrow: no keycaps or switch hint', () => {
    render(<Crew />);
    const back = screen.getByRole('button', { name: 'Back to the crew' });
    expect(back.hasAttribute('data-back')).toBe(true);
    expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(back.textContent).toBe('');
    expect(section().querySelector('[data-prompts]')).toBeNull();
    expect(section().textContent).not.toMatch(/Switch|Esc/);
  });

  test('one member gets no roster', () => {
    content.override = [fake('ada')];
    render(<Crew />);
    expect(screen.queryByRole('group', { name: 'Choose a crew member' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to the crew' })).toBeTruthy();
  });

  test('has no text prompt: the roll call invites the hover instead', () => {
    render(<Crew />);
    expect(section().textContent).not.toMatch(/choose your fighter|meet the crew/i);
  });

  test('renders nothing without members', () => {
    content.override = [];
    const { container } = render(<Crew />);
    expect(container.innerHTML).toBe('');
  });
});
