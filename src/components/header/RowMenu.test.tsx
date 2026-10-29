// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { site } from '../../content/site';
import { RowMenu } from './RowMenu';

// jsdom has no modal dialog support; this mirrors what the browser does for open and close.
// It also has no Element.animate, so the menu morph is skipped and closing is immediate.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(cleanup);

const renderMenu = () =>
  render(
    <MemoryRouter>
      <RowMenu links={site.nav} />
    </MemoryRouter>,
  );

const dialog = () => document.querySelector('dialog')!;
const menuButton = () => screen.getByRole('button', { name: 'Menu' });
const openMenu = () => {
  renderMenu();
  fireEvent.click(menuButton());
};

describe('RowMenu', () => {
  test('is a hamburger icon with one line per nav link, starting closed', () => {
    renderMenu();
    const button = menuButton();
    expect(button.querySelectorAll('[data-menu-line]')).toHaveLength(site.nav.length);
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(dialog().open).toBe(false);
  });

  test('opens a dialog with every nav link as a row, named by its label', () => {
    openMenu();
    expect(dialog().open).toBe(true);
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    const links = within(dialog()).getAllByRole('link');
    expect(
      links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')]),
    ).toEqual(site.nav.map((link) => [link.label, link.href]));
    expect(links.map((link) => link.closest('[data-style]')!.getAttribute('data-style'))).toEqual(
      site.nav.map((_, i) => (i % 2 === 0 ? 'solid' : 'outline')),
    );
  });

  test('splits each label into hidden letters for the motion, one block per row', () => {
    openMenu();
    within(dialog())
      .getAllByRole('link')
      .forEach((link, i) => {
        const letters = [...link.querySelectorAll('[data-letter]')];
        expect(letters.map((letter) => letter.textContent).join('')).toBe(site.nav[i].label);
        expect(link.querySelector('[data-word]')!.getAttribute('aria-hidden')).toBe('true');
      });
    expect(dialog().querySelectorAll('[data-menu-block]')).toHaveLength(site.nav.length);
  });

  test('closes from the X and returns focus to the hamburger', async () => {
    openMenu();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close menu' }));
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menuButton());
  });

  test('closes on Escape (the dialog cancel event)', async () => {
    openMenu();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  test('closes when a link is chosen', () => {
    openMenu();
    fireEvent.click(within(dialog()).getAllByRole('link')[1]);
    expect(dialog().open).toBe(false);
  });
});
