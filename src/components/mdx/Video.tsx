import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { isYouTubeId, youTubeEmbedUrl, youTubeWatchUrl } from './media';
import { useContentImage } from './useContentImage';
import styles from './Video.module.css';

export interface VideoProps {
  /** The YouTube video id (11 characters). */
  id: string;
  title: string;
  /** Optional poster, a path relative to the content folder. */
  poster?: string;
}

// <Video id title poster>: a click-to-load facade, so nothing loads from
// YouTube until the visitor presses play. Without JS it's a link to the video.
export function Video({ id, title, poster }: VideoProps) {
  const posterUrl = useContentImage(poster);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (playing) playerRef.current?.focus();
  }, [playing]);

  if (!isYouTubeId(id)) throw new Error(`<Video id="${id}"> needs an 11-character YouTube id`);
  if (!title) throw new Error(`<Video id="${id}"> needs a title`);

  const play = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setPlaying(true);
  };

  return (
    <div className={styles.video}>
      {playing ? (
        <iframe
          ref={playerRef}
          className={styles.player}
          src={youTubeEmbedUrl(id)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <a
          className={styles.facade}
          href={youTubeWatchUrl(id)}
          aria-label={`Play video: ${title}`}
          onClick={play}
        >
          {posterUrl && (
            <>
              <img
                className={styles.poster}
                src={posterUrl}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className={styles.shade} />
            </>
          )}
          <span className={styles.play} aria-hidden="true" />
          <span className={styles.title} aria-hidden="true">
            {title}
          </span>
        </a>
      )}
    </div>
  );
}
