import type { RouteRecord } from 'vite-react-ssg';
import { Layout } from './components/Layout';
import { paths } from './content';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectPage } from './pages/ProjectPage';

// The devlog routes return with the devlog.
export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'projects/:slug', element: <ProjectPage />, getStaticPaths: () => paths.projects },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
