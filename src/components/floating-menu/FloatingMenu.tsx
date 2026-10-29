import {
  type CSSProperties,
  type MouseEvent,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { accentVar } from '../../content';
import { site } from '../../content/site';
import { barPartsIn, createBarMorph } from './barMorph';
import type { Mode } from './barState';
import { currentSection } from './current';
import styles from './FloatingMenu.module.css';
import { jumpTo } from './jump';
import { type Point, type RippleLayout, rippleLayout } from './ripple';
import { createRippleMotion, ripplePartsIn } from './rippleMotion';
import { useCircleLift } from './useBarMode';

interface FloatingMenuProps {
  /** Bar or circle, from useBarMode. */
  mode: Mode;
  /** The letterbox bar the circle takes over from, and hands back to at the top. */
  barRef: RefObject<HTMLElement | null>;
  /** True from opening until the dialog has closed, so the bar state holds still meanwhile. */
  onOpenChange: (open: boolean) => void;
}

/** What the menu measured when it opened. */
interface Opened {
  layout: RippleLayout;
  hub: Point;
  circle: { left: number; top: number; width: number; height: number };
  width: number;
  height: number;
  current: number;
}

const plainClick = (event: MouseEvent) =>
  event.button === 0 && !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);

// The circle the letterbox bar gives way to past its page's zone, and the ripple menu it opens.
// The swap is barMorph.ts and the menu's motion rippleMotion.ts; a native modal dialog traps
// focus and raises Escape as cancel.
export function FloatingMenu({ mode, barRef, onOpenChange }: FloatingMenuProps) {
  const id = useId();
  const circleRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const [bar] = useState(createBarMorph);
  const [ripple] = useState(createRippleMotion);
  const [opened, setOpened] = useState<Opened | null>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useCircleLift(circleRef);

  // The swap starts before paint, so the bar and the circle never both show, or neither.
  useLayoutEffect(() => {
    void bar.fly(mode, barPartsIn(barRef.current, circleRef.current));
    // Handing back to the bar takes focus off the hidden circle, onto the bar's logo.
    if (mode === 'bar' && document.activeElement === circleRef.current) {
      barRef.current?.querySelector('a')?.focus();
    }
  }, [mode, bar, barRef]);

  // Once the rings are rendered: open the dialog and play the opening.
  useLayoutEffect(() => {
    if (!opened) return;
    dialogRef.current?.showModal();
    ripple.open(ripplePartsIn(dialogRef.current), opened.hub, opened.layout.flood);
  }, [opened, ripple]);

  const open = () => {
    const circle = circleRef.current;
    if (!circle || opened) return;
    const r = circle.getBoundingClientRect();
    const hub = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const { innerWidth: width, innerHeight: height } = window;
    const atBottom = window.scrollY + height >= document.documentElement.scrollHeight - 2;
    onOpenChange(true);
    setOpened({
      layout: rippleLayout({ width, height, hub }, site.sections.length),
      hub,
      circle: { left: r.left, top: r.top, width: r.width, height: r.height },
      width,
      height,
      current: currentSection(
        site.sections,
        pathname,
        (target) => document.getElementById(target)?.getBoundingClientRect().top ?? null,
        height,
        atBottom,
      ),
    });
  };

  // Rings out, then (when an item was chosen) the jump under the ink, then the drain.
  const close = async (chosen?: number) => {
    if (!opened || closingRef.current) return;
    closingRef.current = true;
    const href = chosen === undefined ? null : site.sections[chosen].href;
    await ripple.close(ripplePartsIn(dialogRef.current), {
      hub: opened.hub,
      chosen,
      between: href === null ? undefined : () => jumpTo(href, pathname, navigate),
      target: () => circleRef.current?.getBoundingClientRect() ?? null,
    });
    dialogRef.current?.close();
  };

  return (
    <>
      <button
        ref={circleRef}
        type="button"
        className={styles.circle}
        data-mode={mode}
        aria-label="Menu"
        aria-expanded={opened !== null}
        aria-controls={id}
        onClick={open}
      >
        <span className={styles.mark} data-logo-mark="" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        id={id}
        className={styles.dialog}
        aria-label="Menu"
        onCancel={(event) => {
          event.preventDefault();
          void close();
        }}
        onClose={() => {
          ripple.cancel();
          closingRef.current = false;
          setOpened(null);
          onOpenChange(false);
          circleRef.current?.focus();
        }}
      >
        {opened && (
          <>
            <div className={styles.flood} data-ripple-flood="" onClick={() => void close()} />
            {/* First in the dialog, so it takes focus on opening. */}
            <button
              type="button"
              className={styles.close}
              data-ripple-close=""
              aria-label="Close menu"
              style={opened.circle}
              onClick={() => void close()}
            >
              <span className={styles.mark} data-ripple-mark="" aria-hidden="true" />
              <span className={styles.stroke} data-ripple-stroke="" aria-hidden="true" />
              <span className={styles.stroke} data-ripple-stroke="" aria-hidden="true" />
            </button>
            <nav aria-label="Sections">
              <svg
                className={styles.rings}
                viewBox={`0 0 ${opened.width} ${opened.height}`}
                preserveAspectRatio="xMinYMin slice"
              >
                {site.sections.map((section, i) => {
                  const ring = opened.layout.rings[i];
                  const pathId = `${id}-ring-${i}`;
                  return (
                    <g
                      key={section.href}
                      className={styles.ring}
                      data-ripple-ring=""
                      style={
                        {
                          transformOrigin: `${opened.hub.x}px ${opened.hub.y}px`,
                          '--accent': section.accent
                            ? accentVar(section.accent)
                            : 'var(--mih-paper)',
                        } as CSSProperties
                      }
                    >
                      <a
                        href={section.href}
                        className={styles.link}
                        aria-current={i === opened.current ? 'location' : undefined}
                        onClick={(event) => {
                          if (!plainClick(event)) return;
                          event.preventDefault();
                          void close(i);
                        }}
                      >
                        <circle
                          className={styles.line}
                          cx={opened.hub.x}
                          cy={opened.hub.y}
                          r={ring.radius}
                        />
                        <path id={pathId} d={ring.path} fill="none" />
                        <text
                          className={styles.label}
                          fontSize={ring.fontSize}
                          dy={-0.1 * ring.fontSize}
                        >
                          <textPath
                            href={`#${pathId}`}
                            startOffset={ring.startOffset}
                            textAnchor="middle"
                          >
                            {section.label}
                          </textPath>
                        </text>
                      </a>
                    </g>
                  );
                })}
              </svg>
            </nav>
          </>
        )}
      </dialog>
    </>
  );
}
