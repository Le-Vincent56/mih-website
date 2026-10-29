import { type ReactNode, useRef } from 'react';
import { Link } from 'react-router-dom';
import { site } from '../../content/site';
import { useAccentHover } from '../motion/accentHover';
import styles from './Footer.module.css';

// Icons in the site's stroke style (24-unit box, drawn at 20px with a 2px round stroke).
const socials: { label: string; href: string; icon: ReactNode }[] = [
  {
    label: 'Instagram',
    href: site.instagramUrl,
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
      </>
    ),
  },
  {
    label: 'LinkedIn',
    href: site.linkedinUrl,
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M7.5 7.5h.01M7.5 11v6M11.5 17v-6M11.5 13.5a2.5 2.5 0 0 1 5 0V17" />
      </>
    ),
  },
];

// The ink band that closes every page. Pages are prerendered, so the year is the build year.
// It's the floating menu's Contact target and the circle's floor.
export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  useAccentHover(footerRef);

  return (
    <footer ref={footerRef} id="contact" className={styles.footer} data-floor="">
      <div className={styles.top}>
        <Link to="/" className={styles.logo}>
          <span className={styles.mark} data-logo-mark="" aria-hidden="true" />
          {site.name}
        </Link>
        <ul className={styles.links}>
          {socials.map((social) => (
            <li key={social.label}>
              <a className={styles.link} href={social.href}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {social.icon}
                </svg>
                <span>{social.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.bottom}>
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
        <p>Designed &amp; developed by Vincent Le</p>
      </div>
    </footer>
  );
}
