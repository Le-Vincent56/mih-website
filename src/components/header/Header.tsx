import { type CSSProperties, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { site } from '../../content/site';
import { FloatingMenu } from '../floating-menu/FloatingMenu';
import { useBarMode } from '../floating-menu/useBarMode';
import { HEADER_DELAY } from '../hero/rows';
import { useAccentHover } from '../motion/accentHover';
import styles from './Header.module.css';
import { NavItem } from './NavItem';
import { RowMenu } from './RowMenu';

// The letterbox header on every page. Past its page's zone it gives way to
// the floating circle, which FloatingMenu renders beside it.
export function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  // The intro plays only when a visit starts on the homepage; later navigation shows it static.
  const [intro] = useState(isHome);
  // While the floating menu is open, the bar state holds still (its jumps aren't scrolling).
  const [menuOpen, setMenuOpen] = useState(false);
  const mode = useBarMode(menuOpen, location.key);
  const headerRef = useRef<HTMLElement>(null);
  useAccentHover(headerRef);

  return (
    <>
      <header
        ref={headerRef}
        className={styles.header}
        data-intro={intro ? '' : undefined}
        data-mode={mode}
        style={{ '--delay': `${HEADER_DELAY}s` } as CSSProperties}
      >
        <Link to="/" className={styles.logo}>
          <span className={styles.mark} data-logo-mark="" aria-hidden="true" />
          {site.name}
        </Link>
        <div className={styles.actions}>
          <nav className={styles.nav} aria-label="Main">
            <ul>
              {site.nav.map((link) => (
                <li key={link.href}>
                  <NavItem link={link} />
                </li>
              ))}
            </ul>
          </nav>
          <RowMenu links={site.nav} />
        </div>
      </header>
      <FloatingMenu mode={mode} barRef={headerRef} onOpenChange={setMenuOpen} />
    </>
  );
}
