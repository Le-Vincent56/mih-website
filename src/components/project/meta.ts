// The project page's head tags.

export interface ProjectHead {
  title: string;
  description: string;
  ogTitle: string;
  /** Absolute; left out when the build has no site URL. */
  canonical?: string;
  /** The absolute OG crop URL; left out when the build has no site URL. */
  image?: string;
  imageAlt: string;
}

const absolute = (url: string, origin: string) => (/^https?:\/\//.test(url) ? url : origin + url);

export function projectHead(
  project: { slug: string; title: string; description: string; ogImage: string },
  siteUrl: string,
): ProjectHead {
  return {
    title: `${project.title} | Made In House`,
    description: project.description,
    ogTitle: project.title,
    canonical: siteUrl ? `${siteUrl}/projects/${project.slug}` : undefined,
    image: siteUrl && project.ogImage ? absolute(project.ogImage, siteUrl) : undefined,
    imageAlt: `${project.title} key art`,
  };
}
