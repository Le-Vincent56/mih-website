// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { studio } from '../../content';
import { buildStations } from './stations';
import { StudioIntro } from './StudioIntro';

afterEach(cleanup);

describe('StudioIntro', () => {
  test('carries the real content as headings and paragraphs', () => {
    render(<StudioIntro />);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Vision', 'Mission', 'Values']);
    expect(screen.getByText(studio.vision)).not.toBeNull();
    expect(screen.getByText(studio.mission)).not.toBeNull();
  });

  test("is the floating menu's Studio target", () => {
    const { container } = render(<StudioIntro />);
    expect(container.querySelector('section')!.id).toBe('studio');
  });

  test('lists the four values, each with its title and one-liner', () => {
    render(<StudioIntro />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(
      items.map((item) => [
        within(item).getByRole('heading', { level: 3 }).textContent,
        within(item).getByText(studio.values[items.indexOf(item)].text).textContent,
      ]),
    ).toEqual(studio.values.map((value) => [value.title, value.text]));
  });

  test('renders a panel per station in its colors and alignment for the fallback', () => {
    const { container } = render(<StudioIntro />);
    const panels = [...container.querySelectorAll<HTMLElement>('[data-station]')];
    expect(
      panels.map((panel) => [
        panel.dataset.station,
        panel.dataset.align,
        panel.style.getPropertyValue('--panel-bg'),
        panel.style.getPropertyValue('--panel-fg'),
      ]),
    ).toEqual(
      buildStations(studio).map((station, i) => [
        String(i),
        station.align,
        station.background,
        station.foreground,
      ]),
    );
  });

  test('leaves the animated frame empty and hidden from assistive tech', () => {
    const { container } = render(<StudioIntro />);
    const frame = container.querySelector<HTMLElement>('[data-studio-frame]')!;
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.children).toHaveLength(0);
  });
});
