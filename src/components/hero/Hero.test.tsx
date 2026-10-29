// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { crewLayers } from './crew';
import { Hero } from './Hero';
import { FRONT_ROW, REPEATS_PER_HALF, ROW_TEXT, heroRows } from './rows';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.drift;
});

const renderHero = () => render(<Hero />).container;
const rowsIn = (scope: ParentNode) => [...scope.querySelectorAll<HTMLElement>('[data-row]')];

describe('Hero', () => {
  test('has one heading naming the studio', () => {
    renderHero();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Made In House');
  });

  test('is the zone the site header collapses past', () => {
    const container = renderHero();
    expect(container.querySelector('section')!.hasAttribute('data-bar-zone')).toBe(true);
  });

  test('hides the decorative rows from assistive tech', () => {
    const container = renderHero();
    const rows = rowsIn(container);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  test('renders every row from the model with its style and delay', () => {
    const container = renderHero();
    const rows = rowsIn(container);
    expect(
      rows.map((row) => [
        row.dataset.row,
        row.dataset.style,
        row.style.getPropertyValue('--delay'),
      ]),
    ).toEqual(heroRows().map((row) => [String(row.index), row.style, `${row.delay}s`]));
  });

  test('gives each row a strip of two identical halves inside an entry and a drift layer', () => {
    const container = renderHero();
    for (const row of rowsIn(container)) {
      const drift = row.querySelector('[data-drift-layer]');
      expect(drift).not.toBeNull();
      expect(drift!.parentElement).not.toBe(row);
      const halves = [...drift!.querySelectorAll('[data-half]')];
      expect(halves).toHaveLength(2);
      expect(halves[0].textContent).toBe(halves[1].textContent);
      expect(halves[0].textContent).toBe(ROW_TEXT.repeat(REPEATS_PER_HALF));
    }
  });

  test('marks the row that passes in front of the crew at each breakpoint, with no copies', () => {
    const container = renderHero();
    const rows = rowsIn(container);
    expect(rows).toHaveLength(heroRows().length);
    expect(
      rows.filter((row) => row.dataset.front).map((row) => [row.dataset.front, row.dataset.row]),
    ).toEqual([
      ['desktop', String(FRONT_ROW.desktop)],
      ['phone', String(FRONT_ROW.phone)],
    ]);
  });

  test('renders the crew layers with their alt text and rise delays', () => {
    const container = renderHero();
    const images = [...container.querySelectorAll<HTMLImageElement>('img[data-crew]')];
    expect(
      images.map((img) => [
        img.dataset.crew,
        img.getAttribute('src'),
        img.getAttribute('alt'),
        img.style.getPropertyValue('--delay'),
      ]),
    ).toEqual(crewLayers.map((layer) => [layer.key, layer.src, layer.alt, `${layer.delay}s`]));
  });

  test('offers a pause toggle for the drift, outside the hidden decoration', () => {
    renderHero();
    const pause = screen.getByRole('button', { name: 'Pause the moving text' });
    expect(pause.closest('[aria-hidden="true"]')).toBeNull();
    fireEvent.click(pause);
    expect(document.documentElement.dataset.drift).toBe('paused');
    const play = screen.getByRole('button', { name: 'Play the moving text' });
    fireEvent.click(play);
    expect(document.documentElement.dataset.drift).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Pause the moving text' })).toBe(play);
  });

  test('starts paused when the drift was already paused (returning to the homepage)', () => {
    document.documentElement.dataset.drift = 'paused';
    renderHero();
    expect(screen.getByRole('button', { name: 'Play the moving text' })).not.toBeNull();
  });
});
