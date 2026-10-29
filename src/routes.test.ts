import { describe, expect, it } from 'vitest';
import type { RouteRecord } from 'vite-react-ssg';
import { paths as contentPaths } from './content';
import { routes } from './routes';

function collectRoutes(records: RouteRecord[], parent = ''): [string, RouteRecord][] {
  return records.flatMap((record): [string, RouteRecord][] => {
    const path = record.index ? parent : joinPath(parent, record.path ?? '');
    return [[path, record], ...collectRoutes(record.children ?? [], path)];
  });
}

function joinPath(parent: string, path: string): string {
  if (path.startsWith('/')) return path;
  return `${parent.replace(/\/$/, '')}/${path}`;
}

function routeAt(path: string): RouteRecord {
  const found = collectRoutes(routes).find(([p]) => p === path);
  if (!found) throw new Error(`no route at ${path}`);
  return found[1];
}

describe('routes', () => {
  it('declares every route in the site map', () => {
    const paths = collectRoutes(routes).map(([path]) => path);

    expect(paths).toEqual(expect.arrayContaining(['/', '/projects/:slug', '/*']));
  });

  it('has no devlog routes while the devlog is away', () => {
    const paths = collectRoutes(routes).map(([path]) => path);

    expect(paths.filter((path) => path.startsWith('/devlog'))).toEqual([]);
  });

  it('prerenders a page for every project', async () => {
    expect(contentPaths.projects.length).toBeGreaterThan(0);
    expect(await routeAt('/projects/:slug').getStaticPaths?.()).toEqual(contentPaths.projects);
  });
});
