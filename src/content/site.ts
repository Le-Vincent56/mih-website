import type { Accent } from './schema';

/** Studio-wide facts used across pages. Presentation copy belongs to each section, not here. */
const email = 'madeinhousestudios@gmail.com';

export interface NavLink {
  label: string;
  /** A route ("/devlog"), a homepage section ("/#crew"), or an external/mailto URL. */
  href: string;
}

/** A floating menu item: the homepage ("/") or a homepage section ("/#crew"). */
export interface SectionLink {
  label: string;
  href: string;
  /** Lights the item's ring; null would draw it in paper. */
  accent: Accent | null;
}

/** The production origin without a trailing slash, or '' when the build has none. */
export function siteUrl(raw: string | undefined): string {
  return (raw ?? '').replace(/\/+$/, '');
}

export const site = {
  name: 'Made In House',
  // SITE_URL, else Netlify's URL, set at build time in vite.config.ts (foundation, "Metadata").
  url: siteUrl(import.meta.env.SITE_URL),
  email,
  instagramUrl: 'https://www.instagram.com/madeinhousegames/',
  linkedinUrl: 'https://www.linkedin.com/company/made-in-house-studios',
  // The devlog link returns with the devlog.
  nav: [
    { label: 'Studio', href: '/#studio' },
    { label: 'Projects', href: '/#projects' },
    { label: 'Crew', href: '/#crew' },
  ] satisfies NavLink[],
  // The floating menu's rings, in page order; each section needs its id.
  sections: [
    { label: 'Home', href: '/', accent: 'blue' },
    { label: 'Studio', href: '/#studio', accent: 'red' },
    { label: 'Projects', href: '/#projects', accent: 'gold' },
    { label: 'Crew', href: '/#crew', accent: 'green' },
  ] satisfies SectionLink[],
} as const;
