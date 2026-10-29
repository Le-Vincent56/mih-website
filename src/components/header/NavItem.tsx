import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { NavLink } from '../../content/site';

interface NavItemProps {
  link: NavLink;
  onSelect?: () => void;
  /** Custom content (the row menu's split letters); the label then becomes the link's name. */
  children?: ReactNode;
}

// Routes navigate client-side; homepage sections ("/#crew") and mailto links are plain anchors.
export function NavItem({ link, onSelect, children }: NavItemProps) {
  const isRoute = link.href.startsWith('/') && !link.href.includes('#');
  const label = children ? link.label : undefined;
  return isRoute ? (
    <Link to={link.href} onClick={onSelect} aria-label={label}>
      {children ?? link.label}
    </Link>
  ) : (
    <a href={link.href} onClick={onSelect} aria-label={label}>
      {children ?? link.label}
    </a>
  );
}
