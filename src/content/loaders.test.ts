import { describe, expect, it } from 'vitest';
import {
  ContentError,
  imageLookup,
  loadContent,
  nextProject,
  postsForProject,
  staticPaths,
  type ContentSources,
  type MdxModule,
} from './loaders';

const Body = () => null;
const mdx = (frontmatter: Record<string, unknown>): MdxModule => ({ default: Body, frontmatter });

const project = (overrides: Record<string, unknown> = {}) =>
  mdx({
    title: 'Fast Frankie',
    status: 'In development',
    accent: 'red',
    keyArt: './keyart.png',
    order: 1,
    description: 'A runner.',
    ...overrides,
  });

const post = (overrides: Record<string, unknown> = {}) =>
  mdx({ title: 'Post', date: '2026-10-01', summary: 'Hello.', ...overrides });

const member = (overrides: Record<string, unknown> = {}) =>
  mdx({
    name: 'Brody',
    role: 'Design',
    accent: 'red',
    photo: 'photo.jpg',
    silhouette: 'silhouette.png',
    order: 1,
    ...overrides,
  });

const studioCopy = (overrides: Record<string, unknown> = {}) =>
  mdx({
    vision: 'Vision text.',
    mission: 'Mission text.',
    values: [
      { title: 'Ambition', text: 'One.', accent: 'red' },
      { title: 'Confidence', text: 'Two.', accent: 'gold' },
      { title: 'Process', text: 'Three.', accent: 'green' },
      { title: 'Transparency', text: 'Four.', accent: 'blue' },
    ],
    ...overrides,
  });

// What vite-imagetools gives each raster project image: a srcset and an OG crop.
function variants(images: Record<string, string>, make: (url: string) => string) {
  return Object.fromEntries(
    Object.entries(images)
      .filter(([path]) => /^\.\/projects\/.*\.(png|jpe?g|webp|avif)$/.test(path))
      .map(([path, url]) => [path, make(url)]),
  );
}

function sources(overrides: Partial<ContentSources> = {}): ContentSources {
  const base = baseSources(overrides);
  return {
    ...base,
    keyArtSrcsets: overrides.keyArtSrcsets ?? variants(base.images, (url) => `${url} 960w`),
    ogImages: overrides.ogImages ?? variants(base.images, (url) => `${url}.og.jpg`),
  };
}

function baseSources(overrides: Partial<ContentSources>): ContentSources {
  return {
    projects: { './projects/fast-frankie/index.mdx': project() },
    devlog: {},
    crew: { './crew/brody/index.md': member() },
    studio: { './studio/index.md': studioCopy() },
    images: {
      './projects/fast-frankie/keyart.png': '/assets/keyart.hash.png',
      './crew/brody/photo.jpg': '/assets/photo.hash.jpg',
      './crew/brody/silhouette.png': '/assets/silhouette.hash.png',
    },
    keyArtSrcsets: {},
    ogImages: {},
    ...overrides,
  };
}

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ContentError);
    return (error as ContentError).issues;
  }
  throw new Error('expected a ContentError');
}

const all = { includeDrafts: true };
const published = { includeDrafts: false };

describe('loadContent', () => {
  it('takes slugs from folder names and resolves images to URLs', () => {
    const content = loadContent(sources(), all);

    expect(content.projects).toHaveLength(1);
    expect(content.projects[0]).toMatchObject({
      slug: 'fast-frankie',
      title: 'Fast Frankie',
      keyArt: '/assets/keyart.hash.png',
      draft: false,
    });
    expect(content.projects[0].icon).toBeUndefined();
    expect(content.projects[0].keyArtFocus).toBe('center');
    expect(content.projects[0].Content).toBe(Body);
    expect(content.crew[0]).toMatchObject({
      slug: 'brody',
      photo: '/assets/photo.hash.jpg',
      silhouette: '/assets/silhouette.hash.png',
    });
    expect(content.crew[0].Bio).toBe(Body);
  });

  it('keeps a project key art focus', () => {
    const content = loadContent(
      sources({
        projects: { './projects/fast-frankie/index.mdx': project({ keyArtFocus: 'left' }) },
      }),
      all,
    );
    expect(content.projects[0].keyArtFocus).toBe('left');
  });

  it('resolves image paths with and without ./ relative to the item folder', () => {
    const content = loadContent(
      sources({
        projects: {
          './projects/fast-frankie/index.mdx': project({
            keyArt: 'keyart.png',
            icon: './img/icon.png',
          }),
        },
        images: {
          './projects/fast-frankie/keyart.png': '/k.png',
          './projects/fast-frankie/img/icon.png': '/i.png',
          './crew/brody/photo.jpg': '/p.jpg',
          './crew/brody/silhouette.png': '/s.png',
        },
      }),
      all,
    );

    expect(content.projects[0]).toMatchObject({ keyArt: '/k.png', icon: '/i.png' });
  });

  it('reports a missing image with its file and field', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({
          projects: { './projects/fast-frankie/index.mdx': project({ icon: './nope.png' }) },
        }),
        all,
      ),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('projects/fast-frankie/index.mdx');
    expect(issues[0]).toContain('icon');
    expect(issues[0]).toContain('nope.png');
  });

  it('rejects absolute image paths', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({
          projects: { './projects/fast-frankie/index.mdx': project({ keyArt: '/keyart.png' }) },
        }),
        all,
      ),
    );

    expect(issues[0]).toContain('keyArt');
    expect(issues[0]).toContain('relative');
  });

  it('reports folders that are not kebab-case', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({
          projects: { './projects/Fast_Frankie/index.mdx': project() },
          images: {
            './projects/Fast_Frankie/keyart.png': '/k.png',
            './crew/brody/photo.jpg': '/p.jpg',
            './crew/brody/silhouette.png': '/s.png',
          },
        }),
        all,
      ),
    );

    expect(issues[0]).toContain('Fast_Frankie');
    expect(issues[0]).toContain('kebab-case');
  });

  it('reports invalid frontmatter with the file and field', () => {
    const issues = issuesOf(() =>
      loadContent(sources({ crew: { './crew/brody/index.md': member({ accent: 'pink' }) } }), all),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('crew/brody/index.md');
    expect(issues[0]).toContain('accent');
  });

  it('reports a module with no frontmatter', () => {
    const issues = issuesOf(() =>
      loadContent(sources({ crew: { './crew/brody/index.md': { default: Body } } }), all),
    );

    expect(issues[0]).toContain('crew/brody/index.md');
    expect(issues[0]).toContain('frontmatter');
  });

  it('reports a missing crew silhouette', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({ crew: { './crew/brody/index.md': member({ silhouette: './missing.png' }) } }),
        all,
      ),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('crew/brody/index.md');
    expect(issues[0]).toContain('silhouette "./missing.png" does not exist');
  });

  it('collects every problem across files into one error', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({
          projects: { './projects/fast-frankie/index.mdx': project({ order: 'first' }) },
          devlog: { './devlog/a-post/index.mdx': post({ date: 'soon' }) },
          crew: { './crew/brody/index.md': member({ photo: './missing.jpg' }) },
        }),
        all,
      ),
    );

    expect(issues).toHaveLength(3);
    const error = (() => {
      try {
        loadContent(
          sources({ devlog: { './devlog/a-post/index.mdx': post({ date: 'soon' }) } }),
          all,
        );
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error?.message).toContain('devlog/a-post/index.mdx');
  });

  describe('drafts', () => {
    const withDrafts = () =>
      sources({
        projects: {
          './projects/fast-frankie/index.mdx': project(),
          './projects/secret/index.mdx': project({ title: 'Secret', draft: true }),
        },
        devlog: {
          './devlog/live/index.mdx': post(),
          './devlog/wip/index.mdx': post({ draft: true }),
        },
        images: {
          './projects/fast-frankie/keyart.png': '/k.png',
          './projects/secret/keyart.png': '/s.png',
          './crew/brody/photo.jpg': '/p.jpg',
          './crew/brody/silhouette.png': '/s.png',
        },
      });

    it('drops drafts when includeDrafts is false', () => {
      const content = loadContent(withDrafts(), published);

      expect(content.projects.map((p) => p.slug)).toEqual(['fast-frankie']);
      expect(content.devlog.map((p) => p.slug)).toEqual(['live']);
    });

    it('keeps drafts when includeDrafts is true', () => {
      const content = loadContent(withDrafts(), all);

      expect(content.projects.map((p) => p.slug)).toEqual(['fast-frankie', 'secret']);
      expect(content.projects[1].draft).toBe(true);
      expect(content.devlog.map((p) => p.slug).sort()).toEqual(['live', 'wip']);
    });

    it('still validates drafts when dropping them', () => {
      const issues = issuesOf(() =>
        loadContent(
          sources({
            devlog: { './devlog/wip/index.mdx': post({ draft: true, date: 'soon' }) },
          }),
          published,
        ),
      );

      expect(issues[0]).toContain('devlog/wip/index.mdx');
    });
  });

  describe('devlog project references', () => {
    it('keeps a valid reference', () => {
      const content = loadContent(
        sources({ devlog: { './devlog/a/index.mdx': post({ project: 'fast-frankie' }) } }),
        all,
      );

      expect(content.devlog[0].project).toBe('fast-frankie');
    });

    it('reports an unknown project', () => {
      const issues = issuesOf(() =>
        loadContent(
          sources({ devlog: { './devlog/a/index.mdx': post({ project: 'nope' }) } }),
          all,
        ),
      );

      expect(issues[0]).toContain('devlog/a/index.mdx');
      expect(issues[0]).toContain('nope');
    });

    it('does not pile a reference error onto an invalid project', () => {
      const issues = issuesOf(() =>
        loadContent(
          sources({
            projects: { './projects/fast-frankie/index.mdx': project({ accent: 'purple' }) },
            devlog: { './devlog/a/index.mdx': post({ project: 'fast-frankie' }) },
          }),
          all,
        ),
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('projects/fast-frankie/index.mdx');
    });

    it('reports a published post tagged to a draft project when drafts are excluded', () => {
      const draftProject = sources({
        projects: { './projects/secret/index.mdx': project({ draft: true }) },
        devlog: { './devlog/a/index.mdx': post({ project: 'secret' }) },
        images: {
          './projects/secret/keyart.png': '/s.png',
          './crew/brody/photo.jpg': '/p.jpg',
          './crew/brody/silhouette.png': '/sil.png',
        },
      });

      expect(issuesOf(() => loadContent(draftProject, published))[0]).toContain('draft');
      expect(() => loadContent(draftProject, all)).not.toThrow();
    });
  });

  describe('sorting', () => {
    it('sorts projects by order, then title', () => {
      const content = loadContent(
        sources({
          projects: {
            './projects/c/index.mdx': project({ title: 'C', order: 2 }),
            './projects/b/index.mdx': project({ title: 'B', order: 1 }),
            './projects/a/index.mdx': project({ title: 'A', order: 2 }),
          },
          images: {
            './projects/a/keyart.png': '/a.png',
            './projects/b/keyart.png': '/b.png',
            './projects/c/keyart.png': '/c.png',
            './crew/brody/photo.jpg': '/p.jpg',
            './crew/brody/silhouette.png': '/s.png',
          },
        }),
        all,
      );

      expect(content.projects.map((p) => p.slug)).toEqual(['b', 'a', 'c']);
    });

    it('sorts devlog posts newest first, then by slug', () => {
      const content = loadContent(
        sources({
          devlog: {
            './devlog/old/index.mdx': post({ date: '2026-01-05' }),
            './devlog/new-b/index.mdx': post({ date: '2026-10-01' }),
            './devlog/new-a/index.mdx': post({ date: '2026-10-01' }),
          },
        }),
        all,
      );

      expect(content.devlog.map((p) => p.slug)).toEqual(['new-a', 'new-b', 'old']);
    });

    it('sorts crew by order, then name', () => {
      const content = loadContent(
        sources({
          crew: {
            './crew/owen/index.md': member({ name: 'Owen', order: 4, photo: './p.jpg' }),
            './crew/brody/index.md': member({ name: 'Brody', order: 1 }),
            './crew/bella/index.md': member({ name: 'Bella', order: 3, photo: './p.jpg' }),
          },
          images: {
            './projects/fast-frankie/keyart.png': '/k.png',
            './crew/brody/photo.jpg': '/b.jpg',
            './crew/bella/p.jpg': '/be.jpg',
            './crew/owen/p.jpg': '/o.jpg',
            './crew/brody/silhouette.png': '/bs.png',
            './crew/bella/silhouette.png': '/bes.png',
            './crew/owen/silhouette.png': '/os.png',
          },
        }),
        all,
      );

      expect(content.crew.map((c) => c.slug)).toEqual(['brody', 'bella', 'owen']);
    });
  });
});

describe('postsForProject', () => {
  it("returns that project's posts, newest first", () => {
    const content = loadContent(
      sources({
        devlog: {
          './devlog/a/index.mdx': post({ project: 'fast-frankie', date: '2026-01-01' }),
          './devlog/b/index.mdx': post({ date: '2026-05-01' }),
          './devlog/c/index.mdx': post({ project: 'fast-frankie', date: '2026-09-01' }),
        },
      }),
      all,
    );

    expect(postsForProject(content.devlog, 'fast-frankie').map((p) => p.slug)).toEqual(['c', 'a']);
    expect(postsForProject(content.devlog, 'other')).toEqual([]);
  });
});

describe('staticPaths', () => {
  it('lists a route for every loaded project and post', () => {
    const content = loadContent(
      sources({ devlog: { './devlog/a/index.mdx': post(), './devlog/b/index.mdx': post() } }),
      all,
    );

    expect(staticPaths(content)).toEqual({
      projects: ['/projects/fast-frankie'],
      devlog: ['/devlog/a', '/devlog/b'],
    });
  });
});

describe('studio copy', () => {
  it('loads the studio file into content.studio', () => {
    const { studio } = loadContent(sources(), all);
    expect(studio.vision).toBe('Vision text.');
    expect(studio.values.map((v) => [v.title, v.accent])).toEqual([
      ['Ambition', 'red'],
      ['Confidence', 'gold'],
      ['Process', 'green'],
      ['Transparency', 'blue'],
    ]);
  });

  it('reports a missing studio file', () => {
    expect(issuesOf(() => loadContent(sources({ studio: {} }), all))).toEqual([
      'studio/index.md: file is missing',
    ]);
  });

  it('reports invalid studio frontmatter alongside other problems', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({
          studio: { './studio/index.md': studioCopy({ mission: undefined }) },
          crew: { './crew/brody/index.md': member({ accent: 'purple' }) },
        }),
        all,
      ),
    );
    expect(issues).toHaveLength(2);
    expect(issues.some((issue) => issue.includes('mission'))).toBe(true);
    expect(issues.some((issue) => issue.includes('accent'))).toBe(true);
  });
});

describe('project page fields', () => {
  it('resolves the folder, the key art srcset, and the OG crop, and defaults links and facts', () => {
    const [frankie] = loadContent(sources(), all).projects;

    expect(frankie.folder).toBe('projects/fast-frankie');
    expect(frankie.keyArtSrcset).toBe('/assets/keyart.hash.png 960w');
    expect(frankie.ogImage).toBe('/assets/keyart.hash.png.og.jpg');
    expect(frankie.links).toEqual([]);
    expect(frankie.facts).toEqual([]);
  });

  it('keeps links and facts in order', () => {
    const links = [{ label: 'Play', url: 'https://a.itch.io/x' }];
    const facts = [
      { label: 'Genre', value: 'Runner' },
      { label: 'Platforms', value: 'PC' },
    ];
    const content = loadContent(
      sources({ projects: { './projects/fast-frankie/index.mdx': project({ links, facts }) } }),
      all,
    );

    expect(content.projects[0].links).toEqual(links);
    expect(content.projects[0].facts).toEqual(facts);
  });

  it('reports a key art the pipeline cannot process', () => {
    const issues = issuesOf(() =>
      loadContent(
        sources({
          projects: { './projects/fast-frankie/index.mdx': project({ keyArt: './keyart.svg' }) },
          images: { ...sources().images, './projects/fast-frankie/keyart.svg': '/assets/k.svg' },
        }),
        all,
      ),
    );

    expect(issues).toEqual([
      'projects/fast-frankie/index.mdx: keyArt "./keyart.svg" must be a PNG, JPEG, WebP, or AVIF image',
    ]);
  });
});

describe('nextProject', () => {
  const named = (...slugs: string[]) => slugs.map((slug) => ({ slug }));

  it('returns the following project and wraps from the last to the first', () => {
    const list = named('a', 'b', 'c');
    expect(nextProject(list, 'a')?.slug).toBe('b');
    expect(nextProject(list, 'c')?.slug).toBe('a');
  });

  it('returns nothing for a single project or an unknown slug', () => {
    expect(nextProject(named('a'), 'a')).toBeUndefined();
    expect(nextProject(named('a', 'b'), 'zzz')).toBeUndefined();
  });
});

describe('imageLookup', () => {
  const lookup = imageLookup({
    './projects/a/shot.png': '/assets/shot.png',
    './projects/b/other.png': '/assets/other.png',
  });

  it("resolves a path relative to an item's folder, with or without ./", () => {
    expect(lookup('projects/a', './shot.png')).toBe('/assets/shot.png');
    expect(lookup('projects/a', 'shot.png')).toBe('/assets/shot.png');
    expect(lookup('projects/a', '../b/other.png')).toBe('/assets/other.png');
  });

  it('returns undefined for a missing file or an absolute path', () => {
    expect(lookup('projects/a', './missing.png')).toBeUndefined();
    expect(lookup('projects/a', '/projects/a/shot.png')).toBeUndefined();
  });
});
