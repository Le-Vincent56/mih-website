// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { jumpTarget, jumpTo } from './jump';

const at = (top: number) => ({ getBoundingClientRect: () => ({ top }) }) as Element;

describe('jumpTarget', () => {
  test('Home on the homepage scrolls to the top', () => {
    expect(jumpTarget('/', '/', () => null, 2000)).toEqual({ kind: 'scroll', top: 0 });
  });

  test("a section on this page scrolls to its element's top", () => {
    const byId = (id: string) => (id === 'crew' ? at(300) : null);
    expect(jumpTarget('/#crew', '/', byId, 1000)).toEqual({ kind: 'scroll', top: 1300 });
  });

  test('any target present on this page scrolls in place, even off the homepage', () => {
    const byId = (id: string) => (id === 'contact' ? at(2000) : null);
    expect(jumpTarget('/#contact', '/projects/fast-frankie', byId, 500)).toEqual({
      kind: 'scroll',
      top: 2500,
    });
  });

  test('a section that is not on this page goes there by route', () => {
    expect(jumpTarget('/#crew', '/projects/fast-frankie', () => null, 0)).toEqual({
      kind: 'route',
      to: '/#crew',
    });
    expect(jumpTarget('/', '/projects/fast-frankie', () => null, 0)).toEqual({
      kind: 'route',
      to: '/',
    });
  });
});

describe('jumpTo', () => {
  const scrollTo = vi.fn();
  beforeEach(() => {
    window.scrollTo = scrollTo as typeof window.scrollTo;
  });
  afterEach(() => {
    scrollTo.mockReset();
    document.body.innerHTML = '';
  });

  test('scrolls in place without navigating', async () => {
    document.body.innerHTML = '<section id="studio"></section>';
    const navigate = vi.fn();
    await jumpTo('/#studio', '/', navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  test('navigates, then scrolls to the target once the new page has it', async () => {
    const navigate = vi.fn(() => {
      setTimeout(() => (document.body.innerHTML = '<section id="crew"></section>'), 10);
    });
    await jumpTo('/#crew', '/projects/fast-frankie', navigate);
    expect(navigate).toHaveBeenCalledWith('/#crew');
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
