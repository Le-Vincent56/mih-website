/// <reference types="vitest/config" />
import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({ remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter] }),
    },
    react({ include: /\.(jsx|tsx|mdx)$/ }),
    // Key art srcsets and OG crops. Only imports that ask for a
    // width; every other image (`?url`, crew art, MDX images) stays a plain Vite asset.
    imagetools({ include: /\.(png|jpe?g|webp|avif)\?(.*&)?w=/ }),
  ],
  define: {
    // The production origin for canonical and OG URLs: SITE_URL, else Netlify's URL.
    'import.meta.env.SITE_URL': JSON.stringify(process.env.SITE_URL || process.env.URL || ''),
  },
  server: {
    // docs/ holds no app code, and docs/migration is gigabytes of unrelated history.
    watch: { ignored: ['**/docs/**'] },
  },
  ssgOptions: {
    // Prerender the catch-all route as dist/404.html, which Netlify serves for unknown paths.
    includedRoutes: (paths) => [...paths, '/404'],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
