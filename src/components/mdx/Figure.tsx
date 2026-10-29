import { useContentImage } from './useContentImage';
import styles from './Figure.module.css';

export interface FigureProps {
  /** A path relative to the content folder, e.g. `./shot.png`. */
  src: string;
  alt: string;
  caption?: string;
}

// <Figure src alt caption>. A missing image or alt text throws while
// prerendering, which fails the build.
export function Figure({ src, alt, caption }: FigureProps) {
  const url = useContentImage(src);
  if (!alt) throw new Error(`<Figure src="${src}"> needs alt text`);
  return (
    <figure className={styles.figure}>
      <img className={styles.image} src={url} alt={alt} loading="lazy" decoding="async" />
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
