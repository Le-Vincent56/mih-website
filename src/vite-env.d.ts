/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The production origin (SITE_URL, else Netlify's URL), defined in vite.config.ts. */
  readonly SITE_URL: string;
}
