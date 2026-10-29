import { describe, expect, it } from 'vitest';
import { site, siteUrl } from './site';

describe('siteUrl', () => {
  it('drops a trailing slash and keeps an empty value empty', () => {
    expect(siteUrl('https://madeinhouse.dev/')).toBe('https://madeinhouse.dev');
    expect(siteUrl('https://x.netlify.app')).toBe('https://x.netlify.app');
    expect(siteUrl('')).toBe('');
    expect(siteUrl(undefined)).toBe('');
  });
});

describe('site.sections', () => {
  it('lists the homepage sections in page order, Home first', () => {
    expect(site.sections.map((s) => [s.label, s.href, s.accent])).toEqual([
      ['Home', '/', 'blue'],
      ['Studio', '/#studio', 'red'],
      ['Projects', '/#projects', 'gold'],
      ['Crew', '/#crew', 'green'],
    ]);
  });
});
