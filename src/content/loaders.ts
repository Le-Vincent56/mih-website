import type { MDXContent } from 'mdx/types';
import type { z } from 'zod';
import {
  SLUG_PATTERN,
  crewFrontmatter,
  devlogFrontmatter,
  projectFrontmatter,
  studioFrontmatter,
  type Accent,
  type KeyArtFocus,
  type ProjectFact,
  type ProjectLink,
} from './schema';

/** A compiled MDX/Markdown module as produced by @mdx-js/rollup + remark-mdx-frontmatter. */
export interface MdxModule {
  default: MDXContent;
  frontmatter?: unknown;
}

/** Glob results: file path (e.g. `./projects/fast-frankie/index.mdx`) to module or URL. */
export interface ContentSources {
  projects: Record<string, MdxModule>;
  devlog: Record<string, MdxModule>;
  crew: Record<string, MdxModule>;
  /** The single studio intro file, `./studio/index.md`. */
  studio: Record<string, MdxModule>;
  images: Record<string, string>;
  /** Project images as a WebP `srcset` (vite-imagetools). */
  keyArtSrcsets: Record<string, string>;
  /** Project images as a 1200×630 JPEG crop for Open Graph. */
  ogImages: Record<string, string>;
}

export interface LoadOptions {
  includeDrafts: boolean;
}

export interface Project {
  slug: string;
  /** The content folder, e.g. `projects/fast-frankie`, for resolving body images. */
  folder: string;
  title: string;
  status: string;
  accent: Accent;
  keyArt: string;
  /** The key art as a WebP srcset (960/1600/2560, never upscaled). */
  keyArtSrcset: string;
  /** The key art's 1200×630 Open Graph crop. */
  ogImage: string;
  /** Which part of the key art a cropped card keeps. */
  keyArtFocus: KeyArtFocus;
  icon?: string;
  order: number;
  draft: boolean;
  description: string;
  /** Play/store buttons, the first one primary (empty when the project has none). */
  links: ProjectLink[];
  /** The rail's spec sheet rows (empty when the project has none). */
  facts: ProjectFact[];
  Content: MDXContent;
}

export interface DevlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  project?: string;
  cover?: string;
  draft: boolean;
  Content: MDXContent;
}

export interface CrewMember {
  slug: string;
  name: string;
  role: string;
  accent: Accent;
  /** The painted portrait, on the member's accent. */
  photo: string;
  /** The cut-out figure on the shared 743×1110 canvas. */
  silhouette: string;
  order: number;
  /** The markdown body: the bio, rendered by the Crew section. */
  Bio: MDXContent;
}

/** The homepage studio intro's copy. */
export interface Studio {
  vision: string;
  mission: string;
  values: { title: string; text: string; accent: Accent }[];
}

export interface Content {
  projects: Project[];
  devlog: DevlogPost[];
  crew: CrewMember[];
  studio: Studio;
}

/** Every content problem found in one pass, so a build reports them all at once. */
export class ContentError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(
      `Invalid content (${issues.length}):\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
    );
    this.name = 'ContentError';
    this.issues = issues;
  }
}

/** `./a/b/../c.png` -> `a/c.png`: glob keys and frontmatter paths compared in one form. */
function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function folderOf(file: string): string {
  return file.slice(0, file.lastIndexOf('/'));
}

function slugOf(file: string): string {
  const folder = folderOf(file);
  return folder.slice(folder.lastIndexOf('/') + 1);
}

/** Collects issues while loading, scoped to one file at a time. */
class Reporter {
  readonly issues: string[] = [];

  add(file: string, message: string): void {
    this.issues.push(`${normalizePath(file)}: ${message}`);
  }
}

/**
 * Looks up a content image by a path relative to an item's folder (`./shot.png`, `../x/a.png`).
 * Absolute paths and missing files give `undefined`.
 */
export function imageLookup(images: Record<string, string>) {
  const urls = new Map<string, string>();
  for (const [path, url] of Object.entries(images)) urls.set(normalizePath(path), url);
  return (folder: string, path: string): string | undefined =>
    path.startsWith('/') ? undefined : urls.get(normalizePath(`${folder}/${path}`));
}

class ImageResolver {
  private readonly lookup: ReturnType<typeof imageLookup>;

  constructor(images: Record<string, string>) {
    this.lookup = imageLookup(images);
  }

  resolve(file: string, field: string, value: string, report: Reporter): string | undefined {
    if (value.startsWith('/')) {
      report.add(file, `${field} "${value}" must be relative to the content folder`);
      return undefined;
    }
    const url = this.lookup(folderOf(file), value);
    if (url === undefined) report.add(file, `${field} "${value}" does not exist`);
    return url;
  }
}

interface Parsed<T> {
  file: string;
  slug: string;
  data: T;
  Body: MDXContent;
}

function parseAll<S extends z.ZodType>(
  modules: Record<string, MdxModule>,
  schema: S,
  report: Reporter,
): Parsed<z.infer<S>>[] {
  const parsed: Parsed<z.infer<S>>[] = [];
  for (const [file, module] of Object.entries(modules)) {
    const slug = slugOf(file);
    let ok = true;
    if (!SLUG_PATTERN.test(slug)) {
      report.add(file, `folder name "${slug}" must be kebab-case (a-z, 0-9, hyphens)`);
      ok = false;
    }
    if (module.frontmatter === undefined) {
      report.add(file, 'missing frontmatter');
      continue;
    }
    const result = schema.safeParse(module.frontmatter);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'frontmatter';
        report.add(file, `${field}: ${issue.message}`);
      }
      continue;
    }
    if (ok) parsed.push({ file, slug, data: result.data, Body: module.default });
  }
  return parsed;
}

const byOrderThen =
  <T extends { order: number }>(name: (item: T) => string) =>
  (a: T, b: T) =>
    a.order - b.order || name(a).localeCompare(name(b));

/** Validates and assembles all content. Throws one `ContentError` listing every problem. */
export function loadContent(sources: ContentSources, options: LoadOptions): Content {
  const report = new Reporter();
  const images = new ImageResolver(sources.images);
  const srcsets = imageLookup(sources.keyArtSrcsets);
  const ogImages = imageLookup(sources.ogImages);

  const projects: Project[] = parseAll(sources.projects, projectFrontmatter, report).map(
    ({ file, slug, data, Body }) => {
      const folder = normalizePath(folderOf(file));
      const keyArt = images.resolve(file, 'keyArt', data.keyArt, report);
      const keyArtSrcset = srcsets(folder, data.keyArt);
      const ogImage = ogImages(folder, data.keyArt);
      // The pipeline only sees raster images, so an SVG key art exists but has no variants.
      if (keyArt !== undefined && (keyArtSrcset === undefined || ogImage === undefined)) {
        report.add(file, `keyArt "${data.keyArt}" must be a PNG, JPEG, WebP, or AVIF image`);
      }
      return {
        ...data,
        slug,
        folder,
        keyArt: keyArt ?? '',
        keyArtSrcset: keyArtSrcset ?? '',
        ogImage: ogImage ?? '',
        keyArtFocus: data.keyArtFocus ?? 'center',
        icon: data.icon === undefined ? undefined : images.resolve(file, 'icon', data.icon, report),
        draft: data.draft ?? false,
        links: data.links ?? [],
        facts: data.facts ?? [],
        Content: Body,
      };
    },
  );

  const projectDrafts = new Map(projects.map((p) => [p.slug, p.draft]));
  // Folders that exist but failed validation already have their own issue; don't repeat it.
  const projectFolders = new Set(Object.keys(sources.projects).map(slugOf));

  const devlog: DevlogPost[] = parseAll(sources.devlog, devlogFrontmatter, report).map(
    ({ file, slug, data, Body }) => {
      const draft = data.draft ?? false;
      if (data.project !== undefined) {
        const projectIsDraft = projectDrafts.get(data.project);
        if (projectIsDraft === undefined) {
          if (!projectFolders.has(data.project))
            report.add(file, `project "${data.project}" does not match any project folder`);
        } else if (projectIsDraft && !draft && !options.includeDrafts) {
          report.add(file, `project "${data.project}" is a draft, so this post would leak it`);
        }
      }
      return {
        ...data,
        slug,
        cover:
          data.cover === undefined ? undefined : images.resolve(file, 'cover', data.cover, report),
        draft,
        Content: Body,
      };
    },
  );

  const crew: CrewMember[] = parseAll(sources.crew, crewFrontmatter, report).map(
    ({ file, slug, data, Body }) => ({
      ...data,
      slug,
      photo: images.resolve(file, 'photo', data.photo, report) ?? '',
      silhouette: images.resolve(file, 'silhouette', data.silhouette, report) ?? '',
      Bio: Body,
    }),
  );

  const [studioFile] = parseAll(sources.studio, studioFrontmatter, report);
  if (Object.keys(sources.studio).length === 0) report.add('studio/index.md', 'file is missing');

  if (report.issues.length > 0) throw new ContentError(report.issues);

  const visible = <T extends { draft: boolean }>(item: T) => options.includeDrafts || !item.draft;

  return {
    projects: projects.filter(visible).sort(byOrderThen((p) => p.title)),
    devlog: devlog
      .filter(visible)
      .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)),
    crew: crew.sort(byOrderThen((c) => c.name)),
    studio: studioFile.data,
  };
}

/** The project after `slug` in content order, wrapping to the first; none for fewer than two. */
export function nextProject<T extends { slug: string }>(
  projects: T[],
  slug: string,
): T | undefined {
  const index = projects.findIndex((project) => project.slug === slug);
  if (index < 0 || projects.length < 2) return undefined;
  return projects[(index + 1) % projects.length];
}

/** A project's devlog posts, newest first (the input order is preserved). */
export function postsForProject(posts: DevlogPost[], projectSlug: string): DevlogPost[] {
  return posts.filter((post) => post.project === projectSlug);
}

/** Prerender paths for the dynamic routes. */
export function staticPaths(content: Content): { projects: string[]; devlog: string[] } {
  return {
    projects: content.projects.map((p) => `/projects/${p.slug}`),
    devlog: content.devlog.map((p) => `/devlog/${p.slug}`),
  };
}
