// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { ContentFolderContext, useContentImage } from './useContentImage';

const inFolder =
  (folder: string | null) =>
  ({ children }: { children: ReactNode }) => (
    <ContentFolderContext.Provider value={folder}>{children}</ContentFolderContext.Provider>
  );

describe('useContentImage', () => {
  test("resolves a path relative to the page's content folder", () => {
    const { result } = renderHook(() => useContentImage('./icon.png'), {
      wrapper: inFolder('projects/fast-frankie'),
    });
    expect(result.current).toMatch(/icon\.png/);
  });

  test('throws for a missing image, which fails the prerender (and so the build)', () => {
    expect(() =>
      renderHook(() => useContentImage('./missing.png'), {
        wrapper: inFolder('projects/fast-frankie'),
      }),
    ).toThrow('Image "./missing.png" not found in src/content/projects/fast-frankie');
  });

  test('throws outside a content page', () => {
    expect(() => renderHook(() => useContentImage('./icon.png'))).toThrow(/content folder/);
  });
});
