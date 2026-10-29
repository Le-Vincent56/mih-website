// MDX media helpers.

/** A YouTube video id: 11 characters of letters, digits, `_`, and `-`. */
export const isYouTubeId = (id: string): boolean => /^[A-Za-z0-9_-]{11}$/.test(id);

/** The privacy-enhanced player, autoplaying because it's only loaded once the visitor presses play. */
export const youTubeEmbedUrl = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

/** Where the facade links without JavaScript. */
export const youTubeWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** Gallery columns on desktop: 1 for one image, 2 for 2 or 4, otherwise 3. */
export const galleryColumns = (count: number): number =>
  count <= 1 ? 1 : count === 2 || count === 4 ? 2 : 3;
