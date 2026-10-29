// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test } from 'vitest';
import { ACCENTS, accentVar } from '../../content';
import { site } from '../../content/site';
import { Footer } from './Footer';

afterEach(cleanup);

const renderFooter = () => {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
  return screen.getByRole('contentinfo');
};

describe('Footer', () => {
  test('is the one contentinfo landmark', () => {
    renderFooter();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });

  test("is the floating menu's Contact target and the circle's floor", () => {
    const footer = renderFooter();
    expect(footer.id).toBe('contact');
    expect(footer.hasAttribute('data-floor')).toBe(true);
  });

  test('links the logo home with the house mark hidden from assistive tech', () => {
    const home = within(renderFooter()).getByRole('link', { name: 'Made In House' });
    expect(home.getAttribute('href')).toBe('/');
    const mark = home.firstElementChild as HTMLElement;
    expect(mark.hasAttribute('data-logo-mark')).toBe(true);
    expect(mark.getAttribute('aria-hidden')).toBe('true');
  });

  test('links Instagram then LinkedIn, each an icon and a label, in the same tab', () => {
    const footer = renderFooter();
    const socials = [
      ['Instagram', site.instagramUrl],
      ['LinkedIn', site.linkedinUrl],
    ];
    for (const [name, href] of socials) {
      const link = within(footer).getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.hasAttribute('target')).toBe(false);
      expect(link.textContent).toBe(name);
      const icon = link.querySelector('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
    const order = within(footer)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(order.slice(-2)).toEqual(['Instagram', 'LinkedIn']);
  });

  test('pulls a random accent into each hovered link', () => {
    const footer = renderFooter();
    const accents = ACCENTS.map(accentVar);
    for (const name of ['Made In House', 'Instagram', 'LinkedIn']) {
      const link = within(footer).getByRole('link', { name });
      link.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      expect(accents).toContain(link.style.getPropertyValue('--hover-accent'));
    }
  });

  test('no longer shows the email', () => {
    const footer = renderFooter();
    expect(within(footer).queryByText(site.email)).toBeNull();
    expect(footer.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  test('shows the copyright year and the site credit', () => {
    const footer = renderFooter();
    expect(within(footer).getByText(`© ${new Date().getFullYear()} Made In House`)).not.toBeNull();
    expect(within(footer).getByText('Designed & developed by Vincent Le')).not.toBeNull();
  });
});
