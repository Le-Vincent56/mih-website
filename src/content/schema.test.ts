import { describe, expect, it } from 'vitest';
import {
  accentVar,
  crewFrontmatter,
  devlogFrontmatter,
  projectFrontmatter,
  studioFrontmatter,
  type Accent,
} from './schema';

const validProject = {
  title: 'Fast Frankie',
  status: 'In development',
  accent: 'red',
  keyArt: './keyart.png',
  icon: './icon.png',
  order: 1,
  description: 'A runner.',
};

const validPost = {
  title: 'First look',
  date: '2026-10-28',
  summary: 'Hello.',
  project: 'fast-frankie',
  cover: './cover.png',
};

const validCrew = {
  name: 'Brody',
  role: 'Level & Gameplay Designer',
  accent: 'red',
  photo: './photo.jpg',
  silhouette: './silhouette.png',
  order: 1,
};

const validStudio = {
  vision:
    'Blend genre and aesthetics in ways that excite, inspire, and push the boundary of game development. To create art that is player-first.',
  mission:
    'Use ambition and a refined production process to drive independent development forward through the engine of art. Maintain our process to sustain success.',
  values: [
    {
      title: 'Ambition',
      text: 'Set new and greater standards for ourselves, constantly',
      accent: 'red',
    },
    {
      title: 'Confidence',
      text: 'Take initiative, believe in the art, and welcome feedback',
      accent: 'gold',
    },
    {
      title: 'Process',
      text: 'Scrutinize our shared process for long-term sustainability',
      accent: 'green',
    },
    { title: 'Transparency', text: 'Own our flaws and communicate openly', accent: 'blue' },
  ],
};

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => issue.path.join('.'));
}

describe('projectFrontmatter', () => {
  it('accepts valid frontmatter, with optional fields omitted', () => {
    expect(projectFrontmatter.safeParse(validProject).success).toBe(true);
    const { icon: _icon, ...withoutIcon } = validProject;
    expect(projectFrontmatter.safeParse(withoutIcon).success).toBe(true);
    expect(projectFrontmatter.safeParse({ ...validProject, draft: true }).success).toBe(true);
  });

  it('reports missing required fields by name', () => {
    const { title: _title, keyArt: _keyArt, ...rest } = validProject;
    expect(issuePaths(projectFrontmatter.safeParse(rest))).toEqual(
      expect.arrayContaining(['title', 'keyArt']),
    );
  });

  it('rejects unknown keys so typos are caught', () => {
    const result = projectFrontmatter.safeParse({ ...validProject, keyart: './keyart.png' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error!.issues)).toContain('keyart');
  });

  it('accepts a key art focus keyword and rejects anything else', () => {
    for (const keyArtFocus of ['center', 'left', 'right', 'top', 'bottom']) {
      expect(projectFrontmatter.safeParse({ ...validProject, keyArtFocus }).success).toBe(true);
    }
    expect(
      issuePaths(projectFrontmatter.safeParse({ ...validProject, keyArtFocus: '20% 50%' })),
    ).toEqual(['keyArtFocus']);
  });

  it('rejects accents outside the four crew colors', () => {
    expect(issuePaths(projectFrontmatter.safeParse({ ...validProject, accent: 'purple' }))).toEqual(
      ['accent'],
    );
  });

  it('requires an integer order', () => {
    expect(issuePaths(projectFrontmatter.safeParse({ ...validProject, order: 1.5 }))).toEqual([
      'order',
    ]);
  });

  it('rejects empty strings', () => {
    expect(issuePaths(projectFrontmatter.safeParse({ ...validProject, title: '' }))).toEqual([
      'title',
    ]);
  });
});

describe('projectFrontmatter links and facts', () => {
  const link = (url: string, label = 'Play on itch.io') => ({ label, url });
  const fact = (label: string, value = 'Value') => ({ label, value });

  it('accepts one to three https links and one to six facts', () => {
    const withLinks = {
      ...validProject,
      links: [
        link('https://a.itch.io/x'),
        link('https://store.steampowered.com/app/1', 'Wishlist'),
      ],
      facts: [fact('Genre', 'Endless runner'), fact('Platforms', 'PC')],
    };
    expect(projectFrontmatter.safeParse(withLinks).success).toBe(true);
    const six = { ...validProject, facts: [1, 2, 3, 4, 5, 6].map((n) => fact(`F${n}`)) };
    expect(projectFrontmatter.safeParse(six).success).toBe(true);
  });

  it('rejects an http link, a fourth link, and an empty list', () => {
    expect(
      issuePaths(projectFrontmatter.safeParse({ ...validProject, links: [link('http://a.io')] })),
    ).toContain('links.0.url');
    const four = [1, 2, 3, 4].map((n) => link(`https://a.io/${n}`));
    expect(issuePaths(projectFrontmatter.safeParse({ ...validProject, links: four }))).toContain(
      'links',
    );
    expect(issuePaths(projectFrontmatter.safeParse({ ...validProject, links: [] }))).toContain(
      'links',
    );
  });

  it('rejects a seventh fact, an empty value, and unknown keys inside entries', () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => fact(`F${n}`));
    expect(issuePaths(projectFrontmatter.safeParse({ ...validProject, facts: seven }))).toContain(
      'facts',
    );
    expect(
      issuePaths(projectFrontmatter.safeParse({ ...validProject, facts: [fact('Genre', '')] })),
    ).toContain('facts.0.value');
    const typo = { label: 'Play', url: 'https://a.io', target: '_blank' };
    expect(
      issuePaths(projectFrontmatter.safeParse({ ...validProject, links: [typo] })).length,
    ).toBeGreaterThan(0);
  });
});

describe('devlogFrontmatter', () => {
  it('accepts valid frontmatter, with optional fields omitted', () => {
    expect(devlogFrontmatter.safeParse(validPost).success).toBe(true);
    const { project: _project, cover: _cover, ...minimal } = validPost;
    expect(devlogFrontmatter.safeParse(minimal).success).toBe(true);
  });

  it('requires a YYYY-MM-DD date', () => {
    for (const date of ['28/10/2026', '2026-13-01', 'yesterday', 20261028]) {
      expect(issuePaths(devlogFrontmatter.safeParse({ ...validPost, date }))).toEqual(['date']);
    }
  });

  it('requires the project reference to be a slug', () => {
    expect(
      issuePaths(devlogFrontmatter.safeParse({ ...validPost, project: 'Fast Frankie' })),
    ).toEqual(['project']);
  });
});

describe('crewFrontmatter', () => {
  it('accepts valid frontmatter', () => {
    expect(crewFrontmatter.safeParse(validCrew).success).toBe(true);
  });

  it('requires a photo, a silhouette, and an accent', () => {
    const { photo: _photo, silhouette: _silhouette, accent: _accent, ...rest } = validCrew;
    expect(issuePaths(crewFrontmatter.safeParse(rest))).toEqual(
      expect.arrayContaining(['photo', 'silhouette', 'accent']),
    );
  });
});

describe('studioFrontmatter', () => {
  it('accepts the studio copy', () => {
    expect(studioFrontmatter.safeParse(validStudio).success).toBe(true);
  });

  it('requires exactly four values', () => {
    const three = { ...validStudio, values: validStudio.values.slice(0, 3) };
    const five = { ...validStudio, values: [...validStudio.values, validStudio.values[0]] };
    expect(issuePaths(studioFrontmatter.safeParse(three))).toEqual(['values']);
    expect(issuePaths(studioFrontmatter.safeParse(five))).toEqual(['values']);
  });

  it('requires the mission', () => {
    const { mission: _mission, ...rest } = validStudio;
    expect(issuePaths(studioFrontmatter.safeParse(rest))).toEqual(['mission']);
  });

  it('rejects unknown keys and bad accents', () => {
    expect(issuePaths(studioFrontmatter.safeParse({ ...validStudio, tagline: 'x' }))).toEqual(['']);
    const values = validStudio.values.map((v, i) => (i === 1 ? { ...v, accent: 'purple' } : v));
    expect(issuePaths(studioFrontmatter.safeParse({ ...validStudio, values }))).toEqual([
      'values.1.accent',
    ]);
  });
});

describe('accentVar', () => {
  it('maps each accent to its palette token', () => {
    const expected: Record<Accent, string> = {
      red: 'var(--mih-brody-red)',
      gold: 'var(--mih-vincent-gold)',
      green: 'var(--mih-bella-green)',
      blue: 'var(--mih-owen-blue)',
    };
    for (const [accent, token] of Object.entries(expected)) {
      expect(accentVar(accent as Accent)).toBe(token);
    }
  });
});
