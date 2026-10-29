import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import './styles/tokens.css';
import './styles/global.css';

export const createRoot = ViteReactSSG({ routes });
