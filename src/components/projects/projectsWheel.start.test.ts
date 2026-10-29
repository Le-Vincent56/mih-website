// @vitest-environment jsdom
// The wheel opening on a given project: coming back from
// a project page, the wheel starts with that project current so its art lands in the big card.
// Kept apart from projectsWheel.test.ts, which the Projects section owns.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { type ProjectsWheel, createProjectsWheel } from './projectsWheel';
import { rememberView, rememberedView } from './projectsView';
import { type Rect, poseTransform, slotPose } from './wheel';

const SPOT: Rect = { left: 736, top: 210, width: 640, height: 480 };
const card = { width: 640, height: 480 };
const rectOf = (r: Rect) => () =>
  ({ ...r, right: r.left + r.width, bottom: r.top + r.height }) as DOMRect;

function build(slugs = ['a', 'b', 'c']): HTMLElement {
  const section = document.createElement('section');
  section.innerHTML = `
    <div data-wheel-spot></div>
    <div><button data-view-button="wheel" aria-pressed="true">Wheel</button>
      <button data-view-button="grid" aria-pressed="false">Grid</button></div>
    <ul>${slugs
      .map(
        (slug) => `<li data-project>
          <a data-card href="/projects/${slug}"><img data-art alt=""></a>
          <div data-info>
            <p aria-hidden="true"><span><span data-letter>${slug}</span></span></p>
            <h3><span data-piece="title">${slug}</span></h3>
            <p><span data-piece="status">In development</span></p>
          </div>
        </li>`,
      )
      .join('')}</ul>
    <div data-controls><span data-counter>01 / 03</span></div>`;
  document.body.append(section);
  section.getBoundingClientRect = rectOf({ left: 0, top: 0, width: 1440, height: 900 });
  section.querySelector<HTMLElement>('[data-wheel-spot]')!.getBoundingClientRect = rectOf(SPOT);
  section
    .querySelectorAll<HTMLElement>('[data-card]')
    .forEach((el) => (el.getBoundingClientRect = rectOf(SPOT)));
  return section;
}

const items = (section: HTMLElement) => [
  ...section.querySelectorAll<HTMLElement>('[data-project]'),
];
const cards = (section: HTMLElement) => [...section.querySelectorAll<HTMLElement>('[data-card]')];
const status = (item: HTMLElement) => item.querySelector<HTMLElement>('[data-piece="status"]')!;

let wheels: ProjectsWheel[] = [];

beforeEach(() => {
  Element.prototype.animate = vi.fn(
    () => ({ cancel: vi.fn(), finished: Promise.resolve() }) as unknown as Animation,
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
});

afterEach(() => {
  rememberView('wheel');
  wheels.forEach((wheel) => wheel.destroy());
  wheels = [];
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('starting on a project', () => {
  test("opens with that project's card current, composed in its slots", () => {
    const section = build();
    wheels.push(createProjectsWheel(section, { start: '/projects/b' }));

    cards(section).forEach((el, i) => {
      expect(el.style.transform).toBe(poseTransform(slotPose(i - 1, card), card));
      expect(el.style.zIndex).toBe(String(40 - 2 * Math.abs(i - 1)));
    });
    const [a, b] = items(section);
    expect(b.hasAttribute('data-current')).toBe(true);
    expect(a.hasAttribute('data-current')).toBe(false);
    expect(status(b).style.transform).toBe('translateY(0%)');
    expect(status(a).style.transform).toBe('translateY(110%)');
    expect(section.querySelector('[data-counter]')!.textContent).toBe('02 / 03');
  });

  test('opens on the first project when the start matches no card', () => {
    const section = build();
    wheels.push(createProjectsWheel(section, { start: '/projects/zzz' }));
    expect(items(section)[0].hasAttribute('data-current')).toBe(true);
  });
});

describe('opening in the grid', () => {
  test('opens composed in the grid, captions showing, with nothing animating', () => {
    const section = build();
    const animate = vi.mocked(Element.prototype.animate);
    animate.mockClear();
    wheels.push(createProjectsWheel(section, { start: '/projects/b', view: 'grid' }));

    expect(section.dataset.view).toBe('grid');
    expect(section.querySelector('[data-view-button="grid"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );
    items(section).forEach((item) => {
      expect(item.hasAttribute('data-current')).toBe(false);
      expect(status(item).style.transform).toBe('');
    });
    expect(animate).not.toHaveBeenCalled();
  });

  test('a single project stays in the wheel', () => {
    const section = build(['a']);
    wheels.push(createProjectsWheel(section, { view: 'grid' }));
    expect(section.dataset.view).toBe('wheel');
  });

  test('remembers the view the visitor chose, for the next visit to the homepage', async () => {
    const section = build();
    const wheel = createProjectsWheel(section);
    wheels.push(wheel);
    expect(rememberedView()).toBe('wheel');

    wheel.showGrid();
    await wheel.idle();
    expect(rememberedView()).toBe('grid');

    wheel.showWheel();
    await wheel.idle();
    expect(rememberedView()).toBe('wheel');
  });
});
