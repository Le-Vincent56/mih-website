import { z } from 'zod';

export const ACCENTS = ['red', 'gold', 'green', 'blue'] as const;

export type Accent = (typeof ACCENTS)[number];

const ACCENT_TOKENS: Record<Accent, string> = {
  red: '--mih-brody-red',
  gold: '--mih-vincent-gold',
  green: '--mih-bella-green',
  blue: '--mih-owen-blue',
};

/** The CSS custom property for an accent, e.g. `var(--mih-brody-red)`. */
export function accentVar(accent: Accent): string {
  return `var(${ACCENT_TOKENS[accent]})`;
}

/** Which part of a project's key art a cropped card keeps. */
export const KEY_ART_FOCUS = ['center', 'left', 'right', 'top', 'bottom'] as const;

export type KeyArtFocus = (typeof KEY_ART_FOCUS)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = z.string().trim().min(1);
const accent = z.enum(ACCENTS);
// Relative to the content item's folder; resolved to a URL by the loaders.
const imagePath = text;
const slug = z.string().regex(SLUG_PATTERN, 'must be a kebab-case slug');

// A project's play/store buttons and spec sheet.
const projectLink = z.strictObject({ label: text, url: z.url({ protocol: /^https$/ }) });
const projectFact = z.strictObject({ label: text, value: text });

// Strict objects: an unknown key is almost always a typo of a real one.
export const projectFrontmatter = z.strictObject({
  title: text,
  status: text,
  accent,
  keyArt: imagePath,
  keyArtFocus: z.enum(KEY_ART_FOCUS).optional(),
  icon: imagePath.optional(),
  order: z.int(),
  draft: z.boolean().optional(),
  description: text,
  links: z.array(projectLink).min(1).max(3).optional(),
  facts: z.array(projectFact).min(1).max(6).optional(),
});

export const devlogFrontmatter = z.strictObject({
  title: text,
  date: z.iso.date(),
  summary: text,
  project: slug.optional(),
  cover: imagePath.optional(),
  draft: z.boolean().optional(),
});

export const crewFrontmatter = z.strictObject({
  name: text,
  role: text,
  accent,
  photo: imagePath,
  silhouette: imagePath,
  order: z.int(),
});

// The homepage studio intro's copy: exactly four values.
export const studioFrontmatter = z.strictObject({
  vision: text,
  mission: text,
  values: z.array(z.strictObject({ title: text, text, accent })).length(4),
});

export type ProjectFrontmatter = z.infer<typeof projectFrontmatter>;
export type ProjectLink = z.infer<typeof projectLink>;
export type ProjectFact = z.infer<typeof projectFact>;
export type DevlogFrontmatter = z.infer<typeof devlogFrontmatter>;
export type CrewFrontmatter = z.infer<typeof crewFrontmatter>;
export type StudioFrontmatter = z.infer<typeof studioFrontmatter>;
