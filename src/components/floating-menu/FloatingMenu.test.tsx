// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { site } from '../../content/site';
import { FloatingMenu } from './FloatingMenu';

// jsdom has no modal dialog support; this mirrors what the browser does for open and close.
// It also has no Element.animate, so the motion is skipped, as under reduced motion.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

const scrollTo = vi.fn();
beforeEach(() => {
  window.scrollTo = scrollTo as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  scrollTo.mockReset();
});

function Where() {
  const { pathname, hash } = useLocation();
  return <output data-testid="where">{pathname + hash}</output>;
}

const renderAt = (path: string, mode: 'bar' | 'circle' = 'circle') => {
  const onOpenChange = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <header ref={createRef()} />
      <FloatingMenu mode={mode} barRef={createRef()} onOpenChange={onOpenChange} />
      <Routes>
        <Route
          path="/"
          element={
            <main>
              <section id="studio" />
              <section id="projects" />
              <section id="crew" />
            </main>
          }
        />
        <Route path="/projects/:slug" element={<main />} />
      </Routes>
      <footer id="contact" />
      <Where />
    </MemoryRouter>,
  );
  return { onOpenChange };
};

const circle = () => screen.getByRole('button', { name: 'Menu' });
const dialog = () => document.querySelector('dialog')!;
const open = () => fireEvent.click(circle());
const rings = () =>
  within(within(dialog()).getByRole('navigation', { name: 'Sections' })).getAllByRole('link');

describe('FloatingMenu', () => {
  test('is a closed circle named Menu, carrying the mode', () => {
    renderAt('/', 'circle');
    expect(circle().getAttribute('aria-expanded')).toBe('false');
    expect(circle().dataset.mode).toBe('circle');
    expect(circle().querySelector('[data-logo-mark]')!.getAttribute('aria-hidden')).toBe('true');
    expect(dialog().open).toBe(false);
  });

  test('opens a dialog with one ring link per section, in page order', () => {
    const { onOpenChange } = renderAt('/');
    open();
    expect(dialog().open).toBe(true);
    expect(circle().getAttribute('aria-expanded')).toBe('true');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(rings().map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      site.sections.map((section) => [section.label, section.href]),
    );
  });

  test('writes each label along its own ring', () => {
    renderAt('/');
    open();
    rings().forEach((link) => {
      const textPath = link.querySelector('textPath')!;
      const path = link.querySelector(`path[id="${textPath.getAttribute('href')!.slice(1)}"]`);
      expect(path).not.toBeNull();
      expect(link.querySelector('circle')).not.toBeNull();
    });
  });

  test('marks Projects as the current section on a project page', () => {
    renderAt('/projects/fast-frankie');
    open();
    expect(rings().map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'location',
      null,
    ]);
  });

  test('closes from the X and hands the bar state back', async () => {
    const { onOpenChange } = renderAt('/');
    open();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close menu' }));
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(circle().getAttribute('aria-expanded')).toBe('false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(circle());
  });

  test('closes on Escape (the dialog cancel event)', async () => {
    renderAt('/');
    open();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  test('on the homepage, choosing a section jumps there in place', async () => {
    renderAt('/');
    open();
    fireEvent.click(rings()[3]);
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  test('on a project page, choosing a homepage section goes there by route', async () => {
    renderAt('/projects/fast-frankie');
    open();
    fireEvent.click(rings()[3]);
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(screen.getByTestId('where').textContent).toBe('/#crew');
  });
});
