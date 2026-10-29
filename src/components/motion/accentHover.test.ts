// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { ACCENTS, accentVar } from '../../content';
import { pickAccent, useAccentHover } from './accentHover';

describe('pickAccent', () => {
  test('pulls any accent at random when the link has shown none yet', () => {
    expect(pickAccent(undefined, () => 0)).toBe('red');
    expect(pickAccent(undefined, () => 0.99)).toBe('blue');
  });

  test('never repeats the color the link showed last', () => {
    for (const previous of ACCENTS) {
      for (const r of [0, 0.3, 0.6, 0.99]) {
        expect(pickAccent(previous, () => r)).not.toBe(previous);
      }
    }
  });

  test('spreads its pulls over the three other accents', () => {
    const pulls = [0, 0.4, 0.8].map((r) => pickAccent('gold', () => r));
    expect(pulls).toEqual(['red', 'green', 'blue']);
  });
});

// A root (the header or footer) holding two links, the second with an icon inside.
function build() {
  const root = document.createElement('div');
  root.innerHTML = '<a href="/">Home</a><a href="/x"><svg></svg><span>Label</span></a><p>text</p>';
  document.body.append(root);
  const ref = { current: root };
  const hook = renderHook(() => useAccentHover(ref));
  const [home, social] = root.querySelectorAll('a');
  return { root, home, social, hook };
}

const over = (target: Element, from: Element | null = null) =>
  target.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, relatedTarget: from, pointerType: 'mouse' }),
  );

const accentOf = (link: HTMLElement) => link.style.getPropertyValue('--hover-accent');
const VARS = ACCENTS.map(accentVar);

afterEach(() => {
  document.body.replaceChildren();
});

describe('useAccentHover', () => {
  test('gives a hovered link an accent in --hover-accent', () => {
    const { home } = build();
    over(home);
    expect(VARS).toContain(accentOf(home));
  });

  test('pulls a different accent on the next hover of the same link', () => {
    const { root, home } = build();
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      over(home, root);
      seen.push(accentOf(home));
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  test('keeps the accent while the pointer moves between parts of the same link', () => {
    const { social } = build();
    const [icon, label] = social.children;
    over(icon);
    const first = accentOf(social);
    over(label, icon);
    expect(accentOf(social)).toBe(first);
  });

  test('ignores hovers outside links', () => {
    const { root, home, social } = build();
    over(root.querySelector('p')!);
    expect(accentOf(home)).toBe('');
    expect(accentOf(social)).toBe('');
  });

  test('stops listening on unmount', () => {
    const { home, hook } = build();
    hook.unmount();
    over(home);
    expect(accentOf(home)).toBe('');
  });
});
