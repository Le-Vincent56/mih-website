import { type CSSProperties, type MouseEvent, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accentVar, projects } from '../../content';
import { startArtMorph } from '../project/artMorph';
import styles from './Projects.module.css';
import { useProjectsMotion } from './useProjectsMotion';
import { counterText, gridColumns, splitTitle } from './wheel';

// The projects section. The markup is the real content and the fallback (a grid on desktop,
// a list on phones); useProjectsMotion turns it into the wheel and drives it through the data attributes.
export function Projects() {
  const sectionRef = useRef<HTMLElement>(null);
  useProjectsMotion(sectionRef);
  const navigate = useNavigate();
  if (projects.length === 0) return null;
  const several = projects.length > 1;

  return (
    <div className={styles.hold} data-hold="">
      <section
        ref={sectionRef}
        id="projects"
        className={styles.section}
        aria-labelledby="projects-heading"
      >
        <div className={styles.top}>
          <h2 id="projects-heading" className={styles.label}>
            Projects
          </h2>
          {several && (
            <div className={styles.toggle} role="group" aria-label="View">
              <span className={styles.thumb} data-thumb="" aria-hidden="true" />
              <button
                type="button"
                className={styles.toggleButton}
                data-view-button="wheel"
                aria-label="Wheel view"
                aria-pressed="true"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="5" y="8.5" width="14" height="7" rx="2" />
                  <path d="M6.5 4.6 17.3 3.4M6.5 19.4l10.8 1.2" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.toggleButton}
                data-view-button="grid"
                aria-label="Grid view"
                aria-pressed="false"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="4" y="4" width="7" height="7" rx="1.6" />
                  <rect x="13" y="4" width="7" height="7" rx="1.6" />
                  <rect x="4" y="13" width="7" height="7" rx="1.6" />
                  <rect x="13" y="13" width="7" height="7" rx="1.6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className={styles.spot} data-wheel-spot="" aria-hidden="true" />

        <ul
          className={styles.list}
          style={{ '--cols': gridColumns(projects.length) } as CSSProperties}
        >
          {projects.map((project) => {
            const href = `/projects/${project.slug}`;
            // The art flight takes over the click and navigates once the old page is hidden.
            const fly = (event: MouseEvent<HTMLAnchorElement>) =>
              startArtMorph(() => navigate(href), event);
            return (
              <li
                key={project.slug}
                className={styles.item}
                data-project=""
                data-art-scope=""
                style={{ '--accent': accentVar(project.accent) } as CSSProperties}
              >
                <Link
                  to={href}
                  onClick={fly}
                  className={styles.card}
                  aria-label={project.title}
                  data-card=""
                  data-art-frame=""
                >
                  <img
                    className={styles.art}
                    src={project.keyArt}
                    srcSet={project.keyArtSrcset}
                    sizes="(min-width: 960px) 44vw, 100vw"
                    alt=""
                    data-focus={project.keyArtFocus}
                    loading="lazy"
                    decoding="async"
                    data-art=""
                  />
                  {project.draft && <span className={styles.draft}>Draft</span>}
                </Link>
                <div className={styles.info} data-info="">
                  <p className={styles.rollTitle} aria-hidden="true">
                    {splitTitle(project.title).map((word, w) => (
                      <span key={w} className={styles.word}>
                        {word.map((letter, l) => (
                          <span key={l} className={styles.letter}>
                            <span data-letter="">{letter}</span>
                          </span>
                        ))}
                      </span>
                    ))}
                  </p>
                  <h3 className={styles.title}>
                    <span className={styles.piece} data-piece="title">
                      {project.title}
                    </span>
                  </h3>
                  <p className={styles.status}>
                    <span className={styles.piece} data-piece="status">
                      <span className={styles.dot} aria-hidden="true" />
                      {project.status}
                    </span>
                  </p>
                  <p className={styles.description}>
                    <span className={styles.piece} data-piece="description">
                      {project.description}
                    </span>
                  </p>
                  <p className={styles.more}>
                    <Link to={href} onClick={fly} className={styles.piece} data-piece="link">
                      View project<span aria-hidden="true"> →</span>
                    </Link>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {several && (
          <div className={styles.controls} data-controls="">
            <button
              type="button"
              className={styles.arrow}
              data-step="-1"
              aria-label="Previous project"
            >
              <span className={styles.ink} data-ink="" aria-hidden="true" />
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
            <span className={styles.counter} data-counter="" aria-hidden="true">
              {counterText(0, projects.length)}
            </span>
            <button type="button" className={styles.arrow} data-step="1" aria-label="Next project">
              <span className={styles.ink} data-ink="" aria-hidden="true" />
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>
          </div>
        )}

        <p className={styles.visuallyHidden} aria-live="polite" data-announce="" />
      </section>
    </div>
  );
}
