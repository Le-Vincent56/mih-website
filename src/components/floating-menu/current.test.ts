import { describe, expect, test } from 'vitest';
import { site } from '../../content/site';
import { currentSection } from './current';

// Section tops relative to the screen, by id; a 900px screen, so the middle is at 450.
const tops = (map: Record<string, number>) => (id: string) => map[id] ?? null;

describe('currentSection', () => {
  test('on the homepage, is the last section whose top is above the middle of the screen', () => {
    const topOf = tops({ studio: -2000, projects: 300, crew: 1200 });
    expect(currentSection(site.sections, '/', topOf, 900, false)).toBe(2);
  });

  test('is Home while no section has reached the middle', () => {
    const topOf = tops({ studio: 700, projects: 3000, crew: 4000 });
    expect(currentSection(site.sections, '/', topOf, 900, false)).toBe(0);
  });

  test('is the last item, Crew, at the very bottom of the page', () => {
    const topOf = tops({ studio: -5000, projects: -3000, crew: -800 });
    expect(currentSection(site.sections, '/', topOf, 900, true)).toBe(3);
  });

  test('is Projects on a project page', () => {
    expect(currentSection(site.sections, '/projects/fast-frankie', tops({}), 900, false)).toBe(2);
  });

  test('is none anywhere else', () => {
    expect(currentSection(site.sections, '/nope', tops({}), 900, false)).toBe(-1);
  });
});
