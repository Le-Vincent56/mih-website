import type { MDXContent } from 'mdx/types';
import { Figure } from './Figure';
import { Gallery } from './Gallery';
import { Video } from './Video';
import { ContentFolderContext } from './useContentImage';
import styles from './Prose.module.css';

// The components an MDX body can use.
const components = { Figure, Gallery, Video };

/** An MDX body in the prose styles, resolving its images in its content folder. */
export function Prose({ folder, Content }: { folder: string; Content: MDXContent }) {
  return (
    <ContentFolderContext.Provider value={folder}>
      <div className={styles.prose}>
        <Content components={components} />
      </div>
    </ContentFolderContext.Provider>
  );
}
