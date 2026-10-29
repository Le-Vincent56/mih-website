import { type CSSProperties, useRef } from 'react';
import { accentVar, crew } from '../../content';
import styles from './Crew.module.css';
import { useCrewMotion } from './useCrewMotion';

// A Koulen name split into cap-box letter clips, for the roll. Decorative: the real name is text
// elsewhere. crewSelect.ts fits its size through data-fit-line.
function KoulenName({
  text,
  className,
  ...data
}: { text: string; className: string } & Record<`data-${string}`, string>) {
  return (
    <span className={className} aria-hidden="true" {...data}>
      <span className={styles.line} data-fit-line="">
        {[...text.toUpperCase()].map((letter, i) => (
          <span key={i} className={styles.letterBox}>
            <span className={styles.letter} data-letter="">
              {letter === ' ' ? '\u00a0' : letter}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

// The crew section. The markup is the real content and the no-JS fallback (the lineup, then every
// member's screen stacked); useCrewMotion drives the lineup and the character select through the
// data attributes.
export function Crew() {
  const sectionRef = useRef<HTMLElement>(null);
  useCrewMotion(sectionRef);
  if (crew.length === 0) return null;
  const several = crew.length > 1;

  return (
    <div className={styles.hold} data-hold="">
      <section
        ref={sectionRef}
        id="crew"
        className={styles.section}
        aria-labelledby="crew-heading"
        style={{ '--count': crew.length } as CSSProperties}
      >
        <div className={styles.lineupLayer} data-lineup-layer="">
          <div className={styles.top}>
            <h2 id="crew-heading" className={styles.label}>
              Crew
            </h2>
          </div>

          <div className={styles.hoverNames}>
            {crew.map((member) => (
              <KoulenName
                key={member.slug}
                text={member.name}
                className={styles.hoverName}
                data-hover-name=""
              />
            ))}
          </div>

          <ul className={styles.lineup}>
            {crew.map((member) => (
              <li
                key={member.slug}
                className={styles.member}
                data-member=""
                style={{ '--accent': accentVar(member.accent) } as CSSProperties}
              >
                <button
                  type="button"
                  className={styles.memberButton}
                  aria-expanded="false"
                  aria-controls={`crew-${member.slug}`}
                  data-member-button=""
                >
                  <img
                    className={styles.silhouette}
                    src={member.silhouette}
                    alt=""
                    width={743}
                    height={1110}
                    decoding="async"
                    data-silhouette=""
                  />
                  <span className={styles.visuallyHidden}>{member.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.select} data-select="">
          <div className={styles.flood} data-flood="" aria-hidden="true" />
          <div className={styles.panels}>
            {crew.map(({ slug, name, role, accent, photo, Bio }) => (
              <article
                key={slug}
                id={`crew-${slug}`}
                className={styles.article}
                aria-labelledby={`crew-${slug}-name`}
                data-panel=""
                style={{ '--accent': accentVar(accent) } as CSSProperties}
              >
                <h3
                  id={`crew-${slug}-name`}
                  className={styles.heading}
                  tabIndex={-1}
                  data-heading=""
                >
                  <span className={styles.visuallyHidden} data-title="">
                    {name}
                  </span>
                  <KoulenName text={name} className={styles.name} data-name="" />
                </h3>
                <div className={styles.portrait} data-portrait="">
                  <img
                    src={photo}
                    alt={`Illustrated portrait of ${name}`}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className={styles.info} data-info="">
                  <div className={styles.infoInner}>
                    <p className={styles.role} data-role="">
                      {role}
                    </p>
                    <div className={styles.bio}>
                      <Bio />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {several && (
            <div
              className={styles.roster}
              role="group"
              aria-label="Choose a crew member"
              data-roster=""
            >
              {crew.map((member) => (
                <button
                  key={member.slug}
                  type="button"
                  className={styles.tile}
                  aria-label={member.name}
                  data-pick=""
                >
                  <img src={member.silhouette} alt="" decoding="async" />
                </button>
              ))}
            </div>
          )}

          <button type="button" className={styles.back} aria-label="Back to the crew" data-back="">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        </div>

        <p className={styles.visuallyHidden} aria-live="polite" data-announce="" />
      </section>
    </div>
  );
}
