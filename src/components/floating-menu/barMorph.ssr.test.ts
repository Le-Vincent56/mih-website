import { expect, test } from 'vitest';
import { createBarMorph } from './barMorph';

// The header creates its morph while rendering, which also happens during prerendering.
test('can be created where there is no document', () => {
  expect(typeof document).toBe('undefined');
  expect(() => createBarMorph()).not.toThrow();
});
