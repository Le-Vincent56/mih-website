import { describe, expect, it } from 'vitest';
import { contentImage, crew, devlog, paths, projects, studio } from './index';

// Loads the real files under src/content/, so a broken content file fails this test too.
describe('site content', () => {
  it('has the Fast Frankie project with resolved images', () => {
    const frankie = projects.find((p) => p.slug === 'fast-frankie');

    expect(frankie).toBeDefined();
    expect(frankie!.keyArt).toMatch(/keyart\.png/);
    expect(frankie!.icon).toMatch(/icon\.png/);
    expect(typeof frankie!.Content).toBe('function');
  });

  it('has Good Luck Valley after Fast Frankie', () => {
    expect(projects.map((p) => p.slug).slice(0, 2)).toEqual(['fast-frankie', 'good-luck-valley']);
    const valley = projects[1];
    expect(valley.accent).toBe('green');
    expect(valley.status).toBe('In development');
    expect(valley.keyArt).toMatch(/keyart\.jpg/);
    expect(valley.keyArtFocus).toBe('left');
  });

  it('has the four crew members in hero order with resolved art', () => {
    expect(crew.map((c) => c.slug)).toEqual(['bella', 'brody', 'owen', 'vincent']);
    expect(crew.map((c) => c.accent)).toEqual(['green', 'red', 'blue', 'gold']);
    for (const member of crew) {
      expect(member.photo).toMatch(/photo\.jpg/);
      expect(member.silhouette).toMatch(/silhouette\.png/);
    }
  });

  it('has a key art srcset (never upscaled) and an OG crop for every project', () => {
    for (const project of projects) {
      const widths = [...project.keyArtSrcset.matchAll(/\s(\d+)w/g)].map((m) => Number(m[1]));
      expect(widths.length).toBeGreaterThan(0);
      expect(widths.length).toBeLessThanOrEqual(3);
      expect(Math.max(...widths)).toBeLessThanOrEqual(2560);
      expect(project.ogImage).not.toBe('');
    }
  });

  it('has placeholder facts for both games and a link for Good Luck Valley', () => {
    for (const project of projects) {
      expect(project.facts.map((f) => f.label)).toEqual(['Genre', 'Platforms', 'Release']);
    }
    const valley = projects.find((p) => p.slug === 'good-luck-valley')!;
    expect(valley.links[0].url).toMatch(/^https:\/\//);
  });

  it('resolves body images relative to a project folder', () => {
    expect(contentImage('projects/fast-frankie', './icon.png')).toMatch(/icon\.png/);
    expect(contentImage('projects/fast-frankie', './nope.png')).toBeUndefined();
  });

  it('lists a prerender path for every project and post', () => {
    expect(paths.projects).toEqual(projects.map((p) => `/projects/${p.slug}`));
    expect(paths.devlog).toEqual(devlog.map((p) => `/devlog/${p.slug}`));
  });

  it('has the studio vision, mission, and four values with their accents', () => {
    expect(studio.vision.startsWith('Blend genre and aesthetics')).toBe(true);
    expect(studio.values.map((v) => v.title)).toEqual([
      'Ambition',
      'Confidence',
      'Process',
      'Transparency',
    ]);
    expect(studio.values.map((v) => v.accent)).toEqual(['red', 'gold', 'green', 'blue']);
  });
});
