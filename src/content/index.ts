import { imageLookup, loadContent, staticPaths, type MdxModule } from './loaders';

const images = import.meta.glob<string>('./**/*.{png,jpg,jpeg,webp,avif,gif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

// The only place that reads the content folders. Globs are eager and resolved by Vite at build
// time, so a content error throws while prerendering and fails `npm run build`.
const content = loadContent(
  {
    projects: import.meta.glob<MdxModule>('./projects/*/index.mdx', { eager: true }),
    devlog: import.meta.glob<MdxModule>('./devlog/*/index.mdx', { eager: true }),
    crew: import.meta.glob<MdxModule>('./crew/*/index.md', { eager: true }),
    studio: import.meta.glob<MdxModule>('./studio/index.md', { eager: true }),
    images,
    // Key art variants through vite-imagetools. Every raster image
    // in a project folder gets them; the loader picks the key art's.
    keyArtSrcsets: import.meta.glob<string>('./projects/*/*.{png,jpg,jpeg,webp,avif}', {
      eager: true,
      query: { w: '960;1600;2560', format: 'webp', as: 'srcset' },
      import: 'default',
    }),
    ogImages: import.meta.glob<string>('./projects/*/*.{png,jpg,jpeg,webp,avif}', {
      eager: true,
      query: { w: '1200', h: '630', fit: 'cover', format: 'jpg' },
      import: 'default',
    }),
  },
  // Drafts are visible in `npm run dev` for previewing and left out of production builds.
  { includeDrafts: !import.meta.env.PROD },
);

export const { projects, devlog, crew, studio } = content;

/** Prerender paths for `/projects/:slug` and `/devlog/:slug`. */
export const paths = staticPaths(content);

/** A body image's URL by its path relative to a content folder (`./shot.png`), if it exists. */
export const contentImage = imageLookup(images);

export { nextProject, postsForProject } from './loaders';
export type { CrewMember, DevlogPost, Project, Studio } from './loaders';
export {
  ACCENTS,
  accentVar,
  type Accent,
  type KeyArtFocus,
  type ProjectFact,
  type ProjectLink,
} from './schema';
