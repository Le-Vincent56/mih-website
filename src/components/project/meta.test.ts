import { describe, expect, it } from 'vitest';
import { projectHead } from './meta';

const project = {
  slug: 'fast-frankie',
  title: 'Fast Frankie',
  description: 'A runner.',
  ogImage: '/assets/keyart-og.jpg',
};

describe('projectHead', () => {
  it('builds absolute canonical and image URLs from the site URL', () => {
    expect(projectHead(project, 'https://madeinhouse.dev')).toEqual({
      title: 'Fast Frankie | Made In House',
      description: 'A runner.',
      ogTitle: 'Fast Frankie',
      canonical: 'https://madeinhouse.dev/projects/fast-frankie',
      image: 'https://madeinhouse.dev/assets/keyart-og.jpg',
      imageAlt: 'Fast Frankie key art',
    });
  });

  it('leaves the URLs out without a site URL', () => {
    const head = projectHead(project, '');
    expect(head.canonical).toBeUndefined();
    expect(head.image).toBeUndefined();
    expect(head.title).toBe('Fast Frankie | Made In House');
  });

  it('keeps an already absolute image URL', () => {
    const head = projectHead({ ...project, ogImage: 'https://cdn.x/og.jpg' }, 'https://a.dev');
    expect(head.image).toBe('https://cdn.x/og.jpg');
  });
});
