import { useEffect } from 'react';
import { returnOnBack } from './artMorph';

// Browser Back from a project page to the homepage flies the hero back into its card. React Router re-renders the page synchronously in its own
// popstate listener (registered when the app boots), and capture doesn't put a listener ahead of
// it on window. So this one is registered when the module loads, before the router exists: it
// runs first, while the hero is still on screen to lift off. The hook only says which project
// page is showing.

let showing: string | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (showing && window.location.pathname === '/') returnOnBack(showing);
  });
}

export function useArtReturn(slug: string): void {
  useEffect(() => {
    showing = slug;
    return () => {
      if (showing === slug) showing = null;
    };
  }, [slug]);
}
