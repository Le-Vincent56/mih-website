import { type CSSProperties, useId, useRef, useState } from 'react';
import { type NavLink, site } from '../../content/site';
import { createMenuMorph, menuPartsIn } from './menuMorph';
import { NavItem } from './NavItem';
import styles from './RowMenu.module.css';

interface RowMenuProps {
  links: readonly NavLink[];
}

// Phone menu (hero, "Phone"): a hamburger with one line per link. Opening throws each line
// into its row's word; closing mirrors it (menuMorph.ts). A native modal dialog traps focus and
// raises Escape as a cancel event. Shown only below the phone breakpoint (RowMenu.module.css).
export function RowMenu({ links }: RowMenuProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [morph] = useState(createMenuMorph);
  const parts = () => menuPartsIn(buttonRef.current, dialogRef.current);

  const show = () => {
    dialogRef.current?.showModal();
    setOpen(true);
    morph.open(parts());
  };

  // Plays the closing, then closes the dialog (which reveals the real hamburger underneath).
  const hide = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    await morph.close(parts());
    closingRef.current = false;
    dialogRef.current?.close();
  };

  // A chosen link closes at once and navigates.
  const choose = () => {
    morph.cancel();
    dialogRef.current?.close();
  };

  return (
    <div className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.toggle}
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={show}
      >
        {links.map((link) => (
          <span key={link.href} className={styles.line} data-menu-line="" />
        ))}
      </button>
      <dialog
        ref={dialogRef}
        id={id}
        className={styles.dialog}
        aria-label="Menu"
        onCancel={(event) => {
          event.preventDefault();
          void hide();
        }}
        onClose={() => {
          morph.cancel();
          setOpen(false);
          buttonRef.current?.focus();
        }}
      >
        <div className={styles.surface} data-menu-surface="" />
        <div className={styles.bar}>
          <span className={styles.brand} aria-hidden="true">
            <span className={styles.mark} />
            {site.name}
          </span>
          <button
            type="button"
            className={styles.close}
            aria-label="Close menu"
            onClick={() => void hide()}
          >
            <span className={styles.stroke} data-x-stroke="" />
            <span className={styles.stroke} data-x-stroke="" />
          </button>
        </div>
        <nav aria-label="Menu">
          <ul className={styles.list}>
            {links.map((link, i) => (
              <li
                key={link.href}
                className={styles.item}
                data-style={i % 2 === 0 ? 'solid' : 'outline'}
                style={{ '--i': i } as CSSProperties}
              >
                <NavItem link={link} onSelect={choose}>
                  <span className={styles.word} data-word="" aria-hidden="true">
                    {[...link.label].map((letter, k) => (
                      <span key={k} className={styles.letter} data-letter="">
                        {letter}
                      </span>
                    ))}
                  </span>
                </NavItem>
              </li>
            ))}
          </ul>
        </nav>
        {links.map((link) => (
          <span key={link.href} className={styles.block} data-menu-block="" aria-hidden="true" />
        ))}
      </dialog>
    </div>
  );
}
