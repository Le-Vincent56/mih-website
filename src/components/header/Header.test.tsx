// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ACCENTS, accentVar } from '../../content';
import { site } from '../../content/site';
import { Header } from './Header';

const bar = vi.hoisted(() => ({ mode: 'bar' as 'bar' | 'circle', frozen: [] as boolean[] }));
vi.mock('../floating-menu/useBarMode', () => ({
  useBarMode: (frozen: boolean) => {
    bar.frozen.push(frozen);
    return bar.mode;
  },
  useCircleLift: () => {},
}));

afterEach(() => {
  cleanup();
  bar.mode = 'bar';
  bar.frozen = [];
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  ).container.querySelector('header')!;

// The floating circle: the "Menu" button outside the bar (the bar's own is the phone menu).
const circleOf = (header: HTMLElement) =>
  screen.getAllByRole('button', { name: 'Menu' }).filter((button) => !header.contains(button));

describe('Header', () => {
  test('links the logo home and lists the nav links', () => {
    const header = renderAt('/projects/fast-frankie');
    const home = within(header).getByRole('link', { name: 'Made In House' });
    expect(home.getAttribute('href')).toBe('/');
    const nav = within(header).getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual(site.nav.map((link) => [link.label, link.href]));
  });

  test('pulls a random accent into each hovered link', () => {
    const header = renderAt('/');
    const nav = within(header).getByRole('navigation', { name: 'Main' });
    const links = [
      within(header).getByRole('link', { name: 'Made In House' }),
      ...within(nav).getAllByRole('link'),
    ];
    const accents = ACCENTS.map(accentVar);
    for (const link of links) {
      link.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      expect(accents).toContain(link.style.getPropertyValue('--hover-accent'));
    }
  });

  test('has no devlog link while the devlog is away', () => {
    expect(site.nav.map((link) => link.label)).toEqual(['Studio', 'Projects', 'Crew']);
  });

  test('links Studio to the same target as the floating menu', () => {
    const studio = site.sections.find((section) => section.label === 'Studio')!;
    expect(site.nav[0].href).toBe(studio.href);
  });

  test('shows the house logo beside the wordmark without changing the link name', () => {
    const home = within(renderAt('/')).getByRole('link', { name: 'Made In House' });
    const mark = home.querySelector('[data-logo-mark]');
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute('aria-hidden')).toBe('true');
    expect(home.firstElementChild).toBe(mark);
  });

  test('on the homepage, plays its intro', () => {
    expect(renderAt('/').dataset.intro).toBe('');
  });

  test('elsewhere, has no intro', () => {
    expect(renderAt('/projects/fast-frankie').dataset.intro).toBeUndefined();
  });

  test('has no pause toggle; the hero owns it', () => {
    const header = renderAt('/');
    expect(within(header).queryByRole('button', { name: /moving text/ })).toBeNull();
  });

  test('reflects the bar or circle state as data-mode, on the bar and the circle', () => {
    let header = renderAt('/');
    expect([header.dataset.mode, circleOf(header)[0].dataset.mode]).toEqual(['bar', 'bar']);
    cleanup();
    bar.mode = 'circle';
    header = renderAt('/');
    expect([header.dataset.mode, circleOf(header)[0].dataset.mode]).toEqual(['circle', 'circle']);
  });

  test('renders the floating circle outside the bar, starting unfrozen', () => {
    expect(circleOf(renderAt('/'))).toHaveLength(1);
    expect(bar.frozen.at(-1)).toBe(false);
  });

  test('includes the phone menu button', () => {
    const header = renderAt('/');
    expect(
      screen.getAllByRole('button', { name: 'Menu' }).some((b) => b.closest('header') === header),
    ).toBe(true);
  });
});
