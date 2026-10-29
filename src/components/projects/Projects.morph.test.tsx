// @vitest-environment jsdom
// The homepage cards as sources of the card-to-hero morph. Kept apart from Projects.test.tsx,
// which the Projects section owns.
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { projects } from '../../content';
import { Projects } from './Projects';

vi.mock('./useProjectsMotion', () => ({ useProjectsMotion: () => {} }));

afterEach(cleanup);

describe('Projects as morph sources', () => {
  test('each item is an art scope whose card is the art frame, with the key art srcset', () => {
    render(
      <MemoryRouter>
        <Projects />
      </MemoryRouter>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(projects.length);
    items.forEach((item, i) => {
      expect(item.hasAttribute('data-art-scope')).toBe(true);
      const frames = item.querySelectorAll('[data-art-frame]');
      expect(frames).toHaveLength(1);
      expect(frames[0].hasAttribute('data-card')).toBe(true);
      const img = frames[0].querySelector('img')!;
      expect(img.getAttribute('srcset')).toBe(projects[i].keyArtSrcset);
      expect(img.getAttribute('sizes')).toBe('(min-width: 960px) 44vw, 100vw');
    });
  });
});
