import { describe, expect, it } from 'vitest';
import { galleryColumns, isYouTubeId, youTubeEmbedUrl, youTubeWatchUrl } from './media';

describe('YouTube', () => {
  it('accepts 11-character ids only', () => {
    expect(isYouTubeId('dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeId('a_b-c1D2e3F')).toBe(true);
    expect(isYouTubeId('short')).toBe(false);
    expect(isYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe(false);
    expect(isYouTubeId('dQw4w9WgXc!')).toBe(false);
  });

  it('embeds on the privacy-enhanced domain, autoplaying once pressed', () => {
    expect(youTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
    );
    expect(youTubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});

describe('galleryColumns', () => {
  it('uses 2 columns for 2 or 4 images, 1 for one, otherwise 3', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(galleryColumns)).toEqual([1, 2, 3, 2, 3, 3, 3]);
  });
});
