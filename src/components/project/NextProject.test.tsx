// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test } from 'vitest';
import { projects } from '../../content';
import { NextProject } from './NextProject';
import { koulenEm } from './title';

afterEach(cleanup);

const valley = projects.find((p) => p.slug === 'good-luck-valley')!;

const renderBanner = () => {
  const router = createMemoryRouter([{ path: '/', element: <NextProject project={valley} /> }]);
  return render(<RouterProvider router={router} />);
};

describe('NextProject', () => {
  test('is a labelled nav with one link to the next project', () => {
    renderBanner();
    const nav = screen.getByRole('navigation', { name: 'Next project' });
    const link = screen.getByRole('link', { name: 'Next project: Good Luck Valley' });
    expect(nav.contains(link)).toBe(true);
    expect(link.getAttribute('href')).toBe('/projects/good-luck-valley');
  });

  test('is a morph source: an art scope holding one art frame with the srcset', () => {
    renderBanner();
    const nav = screen.getByRole('navigation');
    expect(nav.hasAttribute('data-art-scope')).toBe(true);
    const frame = nav.querySelector('[data-art-frame]')!;
    const img = frame.querySelector('img')!;
    expect(img.getAttribute('srcset')).toBe(valley.keyArtSrcset);
    expect(img.getAttribute('sizes')).toBe('100vw');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.dataset.focus).toBe('left');
  });

  test("captions the art with the next title's letters, sized by --title-em", () => {
    renderBanner();
    const link = screen.getByRole('link');
    expect(link.style.getPropertyValue('--title-em')).toBe(String(koulenEm('Good Luck Valley')));
    expect(link.style.getPropertyValue('--accent')).toBe('var(--mih-bella-green)');
    expect(link.textContent).toContain('Next project');
  });
});
