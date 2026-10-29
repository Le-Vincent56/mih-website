import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { site } from '../content/site';
import { Footer } from './footer/Footer';
import { Header } from './header/Header';

// Shared shell: the letterbox header above every page and the footer band below it.
// The default title is overridden by a page's own <Head>. ScrollRestoration opens new
// pages at the top and restores the scroll on Back.
export function Layout() {
  return (
    <>
      <Head>
        <title>{site.name}</title>
      </Head>
      <Header />
      <Outlet />
      <Footer />
      <ScrollRestoration />
    </>
  );
}
