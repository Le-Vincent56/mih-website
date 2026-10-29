import { type CSSProperties, useRef } from 'react';
import { studio } from '../../content';
import { type StageClasses } from './stage';
import { buildStations } from './stations';
import styles from './StudioIntro.module.css';
import { useStudioMotion } from './useStudioMotion';

const stations = buildStations(studio);

const stageClasses: StageClasses = {
  title: styles.title,
  slot: styles.slot,
  label: styles.label,
  measure: styles.measure,
  word: styles.word,
  letter: styles.letter,
};

// Panel colors and alignment for the fallback, from the station table.
const panelProps = (index: number) => ({
  'data-station': index,
  'data-align': stations[index].align,
  style: {
    '--panel-bg': stations[index].background,
    '--panel-fg': stations[index].foreground,
  } as CSSProperties,
});

// The studio intro. The panels are the real content and the no-JS/reduced-motion fallback;
// with motion, useStudioMotion draws the pinned, scroll-scrubbed version into the frame and
// the panels are visually hidden.
export function StudioIntro() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useStudioMotion(sectionRef, frameRef, stations, stageClasses);

  return (
    <section ref={sectionRef} id="studio" className={styles.section}>
      <div className={styles.panels}>
        <div className={styles.panel} {...panelProps(0)}>
          <h2 className={styles.panelTitle}>Vision</h2>
          <p className={styles.panelText}>{studio.vision}</p>
        </div>
        <div className={styles.panel} {...panelProps(1)}>
          <h2 className={styles.panelTitle}>Mission</h2>
          <p className={styles.panelText}>{studio.mission}</p>
        </div>
        <h2 className={styles.visuallyHidden}>Values</h2>
        <ul className={styles.valueList}>
          {studio.values.map((value, i) => (
            <li key={value.title} className={styles.panel} {...panelProps(i + 2)}>
              <p className={styles.panelLabel} aria-hidden="true">
                Values
              </p>
              <h3 className={styles.panelTitle}>{value.title}</h3>
              <p className={styles.panelText}>{value.text}</p>
            </li>
          ))}
        </ul>
      </div>
      <div ref={frameRef} className={styles.frame} data-studio-frame="" aria-hidden="true" />
    </section>
  );
}
