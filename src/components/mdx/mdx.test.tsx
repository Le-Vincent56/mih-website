// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Figure } from './Figure';
import { Gallery } from './Gallery';
import { Prose } from './Prose';
import { Video } from './Video';
import { ContentFolderContext } from './useContentImage';

const inFrankie = (children: ReactNode) => (
  <ContentFolderContext.Provider value="projects/fast-frankie">
    {children}
  </ContentFolderContext.Provider>
);

beforeEach(() => {
  // Errors thrown while rendering are expected in some tests; keep React's report quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Figure', () => {
  test('resolves its image in the content folder and shows the caption', () => {
    render(inFrankie(<Figure src="./icon.png" alt="Frankie" caption="Frankie, mid-escape." />));
    const img = screen.getByRole('img', { name: 'Frankie' });
    expect(img.getAttribute('src')).toMatch(/icon\.png/);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(screen.getByText('Frankie, mid-escape.').tagName).toBe('FIGCAPTION');
  });

  test('has no caption element without a caption', () => {
    const { container } = render(inFrankie(<Figure src="./icon.png" alt="Frankie" />));
    expect(container.querySelector('figcaption')).toBeNull();
  });

  test('throws for a missing image or missing alt text, failing the build', () => {
    expect(() => render(inFrankie(<Figure src="./missing.png" alt="x" />))).toThrow(
      /not found in src\/content\/projects\/fast-frankie/,
    );
    expect(() => render(inFrankie(<Figure src="./icon.png" alt="" />))).toThrow(/alt/);
  });
});

describe('Gallery', () => {
  const gallery = (count: number) =>
    inFrankie(
      <Gallery>
        {Array.from({ length: count }, (_, i) => (
          <Figure
            key={i}
            src="./icon.png"
            alt={`Shot ${i}`}
            caption={i === 0 ? 'First' : undefined}
          />
        ))}
      </Gallery>,
    );

  test('links each thumbnail to its full image, carrying its caption for the lightbox', () => {
    const { container } = render(gallery(3));
    const items = [...container.querySelectorAll<HTMLAnchorElement>('[data-gallery-item]')];
    expect(items).toHaveLength(3);
    expect(items[0].getAttribute('href')).toMatch(/icon\.png/);
    expect(items[0].dataset.caption).toBe('First');
    expect(items[1].dataset.caption).toBe('');
    expect(items[2].querySelector('img')!.alt).toBe('Shot 2');
    expect(container.querySelector('ul figcaption')).toBeNull();
  });

  test('sets its columns by count', () => {
    for (const [count, cols] of [
      [2, '2'],
      [3, '3'],
      [4, '2'],
    ] as const) {
      const { container, unmount } = render(gallery(count));
      expect(
        container.querySelector<HTMLElement>('[data-gallery]')!.style.getPropertyValue('--cols'),
      ).toBe(cols);
      unmount();
    }
  });

  test('has a labelled lightbox dialog with named controls', () => {
    const { container } = render(gallery(3));
    const dialog = container.querySelector('dialog[data-lightbox]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Image viewer');
    const names = [...dialog.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Close', 'Previous image', 'Next image']);
  });

  test('a single image has no step buttons', () => {
    const { container } = render(gallery(1));
    expect(container.querySelectorAll('dialog button')).toHaveLength(1);
  });
});

describe('Video', () => {
  test('is a facade linking to YouTube until pressed, then the nocookie player', () => {
    render(inFrankie(<Video id="dQw4w9WgXcQ" title="Launch trailer" />));
    const facade = screen.getByRole('link', { name: 'Play video: Launch trailer' });
    expect(facade.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(document.querySelector('iframe')).toBeNull();

    fireEvent.click(facade);

    const player = document.querySelector('iframe')!;
    expect(player.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
    );
    expect(player.getAttribute('title')).toBe('Launch trailer');
    expect(screen.queryByRole('link')).toBeNull();
  });

  test('shows a poster from the content folder', () => {
    const { container } = render(
      inFrankie(<Video id="dQw4w9WgXcQ" title="Trailer" poster="./icon.png" />),
    );
    expect(container.querySelector('img')!.getAttribute('src')).toMatch(/icon\.png/);
  });

  test('throws for a bad id or a missing title, failing the build', () => {
    expect(() => render(inFrankie(<Video id="https://youtu.be/x" title="T" />))).toThrow(/id/);
    expect(() => render(inFrankie(<Video id="dQw4w9WgXcQ" title="" />))).toThrow(/title/);
  });
});

describe('Prose', () => {
  test('renders an MDX body with the components, in the given content folder', () => {
    const Body = ({ components }: { components?: Record<string, unknown> }) => {
      const F = components!.Figure as typeof Figure;
      return (
        <>
          <h2>The game</h2>
          <F src="./icon.png" alt="Frankie" />
        </>
      );
    };
    render(<Prose folder="projects/fast-frankie" Content={Body} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('The game');
    expect(screen.getByRole('img', { name: 'Frankie' }).getAttribute('src')).toMatch(/icon\.png/);
  });
});
