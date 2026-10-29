import {
  Children,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useRef,
} from 'react';
import type { FigureProps } from './Figure';
import { galleryColumns } from './media';
import { useContentImage } from './useContentImage';
import { useLightbox } from './useLightbox';
import styles from './Gallery.module.css';

// <Gallery> of <Figure>s: thumbnails linking to the full images, opened in
// the lightbox with JS (lightbox.ts drives the dialog by its data attributes).
export function Gallery({ children }: { children?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useLightbox(rootRef);
  const figures = Children.toArray(children).filter(
    (child): child is ReactElement<FigureProps> =>
      isValidElement<FigureProps>(child) && typeof child.props.src === 'string',
  );

  return (
    <div
      ref={rootRef}
      className={styles.gallery}
      style={{ '--cols': galleryColumns(figures.length) } as CSSProperties}
      data-gallery=""
    >
      <ul className={styles.grid}>
        {figures.map((figure, i) => (
          <li key={i}>
            <GalleryItem {...figure.props} />
          </li>
        ))}
      </ul>
      <dialog className={styles.lightbox} aria-label="Image viewer" data-lightbox="">
        <p className={styles.counter} data-lightbox-counter="" />
        <button
          type="button"
          className={`${styles.control} ${styles.close}`}
          aria-label="Close"
          data-lightbox-close=""
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <figure className={styles.stage} data-lightbox-stage="">
          <img className={styles.full} alt="" data-lightbox-image="" />
          <figcaption className={styles.fullCaption} data-lightbox-caption="" />
        </figure>
        {figures.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.control} ${styles.prev}`}
              aria-label="Previous image"
              data-lightbox-step="-1"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.control} ${styles.next}`}
              aria-label="Next image"
              data-lightbox-step="1"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}

function GalleryItem({ src, alt, caption }: FigureProps) {
  const url = useContentImage(src);
  if (!alt) throw new Error(`<Figure src="${src}"> in a <Gallery> needs alt text`);
  return (
    <a className={styles.item} href={url} data-gallery-item="" data-caption={caption ?? ''}>
      <img className={styles.thumb} src={url} alt={alt} loading="lazy" decoding="async" />
    </a>
  );
}
