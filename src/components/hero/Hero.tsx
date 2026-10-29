import { type CSSProperties, useRef, useState } from 'react';
import { isDriftPaused, toggleDriftPaused } from '../../motion/driftPause';
import { crewLayers } from './crew';
import styles from './Hero.module.css';
import {
  FRONT_ROW,
  HEADER_DELAY,
  type HeroRow,
  REPEATS_PER_HALF,
  ROW_TEXT,
  heroRows,
} from './rows';
import { useHeroMotion } from './useHeroMotion';

const rows = heroRows();

// The row that passes in front of the crew, per breakpoint (Hero.module.css raises it).
const frontAt = (index: number) =>
  index === FRONT_ROW.desktop ? 'desktop' : index === FRONT_ROW.phone ? 'phone' : undefined;

// The homepage hero. The markup is the composed scene; all motion is CSS in Hero.module.css,
// gated on html.mih-motion.
export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  useHeroMotion(rootRef);

  // The pause lives on <html>, so returning to the homepage keeps it. Prerendering has no
  // document, and the first visit always starts unpaused.
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && isDriftPaused());

  return (
    <section ref={rootRef} className={styles.hero} data-bar-zone="">
      <h1 className={styles.visuallyHidden}>Made In House</h1>
      <div className={styles.rows} aria-hidden="true">
        {rows.map((row) => (
          <Row key={row.index} row={row} />
        ))}
      </div>
      <div className={styles.crew}>
        {crewLayers.map((layer) => (
          <img
            key={layer.key}
            className={styles.crewLayer}
            src={layer.src}
            alt={layer.alt}
            draggable={false}
            data-crew={layer.key}
            style={{ '--delay': `${layer.delay}s` } as CSSProperties}
          />
        ))}
      </div>
      <button
        type="button"
        className={styles.pause}
        aria-label={paused ? 'Play the moving text' : 'Pause the moving text'}
        onClick={() => setPaused(toggleDriftPaused())}
        style={{ '--delay': `${HEADER_DELAY}s` } as CSSProperties}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
    </section>
  );
}

// One drifting row: the outer .entry plays the throw-in, the inner .drift loops by one half.
function Row({ row }: { row: HeroRow }) {
  const half = (
    <span className={styles.half} data-half="">
      {Array.from({ length: REPEATS_PER_HALF }, (_, i) => (
        <span key={i} className={styles.word}>
          {ROW_TEXT}
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={styles.row}
      data-row={row.index}
      data-style={row.style}
      data-front={frontAt(row.index)}
      style={{ '--i': row.index, '--delay': `${row.delay}s` } as CSSProperties}
    >
      <div className={styles.entry}>
        <div className={styles.drift} data-drift-layer="">
          {half}
          {half}
        </div>
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="4" width="5" height="16" />
      <rect x="14" y="4" width="5" height="16" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4 20 12 7 20Z" />
    </svg>
  );
}
