import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type Project, accentVar } from '../../content';
import { startArtMorph } from './artMorph';
import { koulenEm, titleWords } from './title';
import styles from './NextProject.module.css';

// The next project banner: its art frame is a morph source, so clicking it
// grows the art into the next page's hero.
export function NextProject({ project }: { project: Project }) {
  const navigate = useNavigate();
  const href = `/projects/${project.slug}`;
  return (
    <nav className={styles.next} aria-label="Next project" data-art-scope="">
      <Link
        to={href}
        // The art flight takes over the click and navigates once this page is hidden.
        onClick={(event) => startArtMorph(() => navigate(href), event)}
        className={styles.card}
        aria-label={`Next project: ${project.title}`}
        style={
          {
            '--accent': accentVar(project.accent),
            '--title-em': koulenEm(project.title),
          } as CSSProperties
        }
      >
        <span className={styles.frame} data-art-frame="">
          <img
            className={styles.art}
            src={project.keyArt}
            srcSet={project.keyArtSrcset}
            sizes="100vw"
            alt=""
            data-focus={project.keyArtFocus}
            loading="lazy"
            decoding="async"
          />
        </span>
        <span className={styles.caption} aria-hidden="true">
          <span className={styles.label}>Next project →</span>
          <span className={styles.title}>
            {titleWords(project.title).map(({ letters, start }) => (
              <span key={start} className={styles.word}>
                {letters.map((letter, l) => (
                  <span key={l} className={styles.letter}>
                    <span className={styles.glyph}>{letter}</span>
                  </span>
                ))}
              </span>
            ))}
          </span>
        </span>
      </Link>
    </nav>
  );
}
