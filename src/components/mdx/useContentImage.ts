import { createContext, useContext } from 'react';
import { contentImage } from '../../content';

/** The content folder (`projects/fast-frankie`) of the MDX body being rendered. */
export const ContentFolderContext = createContext<string | null>(null);

/**
 * A body image's URL from its path relative to the page's content folder (`./shot.png`).
 * A missing image throws, which fails the prerender and so the build.
 */
export function useContentImage(src: string): string;
/** An optional image (a video poster): `undefined` stays `undefined`. */
export function useContentImage(src: string | undefined): string | undefined;
export function useContentImage(src: string | undefined): string | undefined {
  const folder = useContext(ContentFolderContext);
  if (src === undefined) return undefined;
  if (folder === null) throw new Error(`MDX image "${src}" needs a content folder to resolve in`);
  const url = contentImage(folder, src);
  if (url === undefined) throw new Error(`Image "${src}" not found in src/content/${folder}`);
  return url;
}
