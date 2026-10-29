import { type CSSProperties, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import { Prose } from '../components/mdx/Prose';
import { NextProject } from '../components/project/NextProject';
import { isArtFlightPending, startArtReturn } from '../components/project/artMorph';
import { projectHead } from '../components/project/meta';
import { koulenEm, titleWords } from '../components/project/title';
import { useArtReturn } from '../components/project/useArtReturn';
import { useHoverFills } from '../components/project/useHoverFills';
import { type Project, accentVar, nextProject, projects } from '../content';
import { site } from '../content/site';
import { NotFoundPage } from './NotFoundPage';
import styles from './ProjectPage.module.css';

// The project page. Keyed by slug, so moving between projects mounts a fresh
// article and its CSS arrival plays again.
export function ProjectPage() {
  const { slug } = useParams();
  const project = projects.find((p) => p.slug === slug);
  if (!project) return <NotFoundPage />;
  return <ProjectArticle key={project.slug} project={project} />;
}

function ProjectArticle({ project }: { project: Project }) {
  // A card's art is flying here: it lands on the hero, so skip the hero's rise and start the type
  // as it lands. Read once at mount (false while prerendering and hydrating).
  const [arrival] = useState(() => (isArtFlightPending() ? 'morph' : 'entry'));
  const railRef = useRef<HTMLElement>(null);
  useHoverFills(railRef);
  // Browser Back to the homepage flies the hero back into its card.
  useArtReturn(project.slug);
  const navigate = useNavigate();

  const head = projectHead(project, site.url);
  const next = nextProject(projects, project.slug);

  return (
    <article
      className={styles.page}
      data-arrival={arrival}
      style={
        {
          '--accent': accentVar(project.accent),
          '--title-em': koulenEm(project.title),
        } as CSSProperties
      }
    >
      <Head>
        <title>{head.title}</title>
        <meta name="description" content={head.description} />
        {head.canonical && <link rel="canonical" href={head.canonical} />}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={site.name} />
        <meta property="og:title" content={head.ogTitle} />
        <meta property="og:description" content={head.description} />
        {head.canonical && <meta property="og:url" content={head.canonical} />}
        {head.image && <meta property="og:image" content={head.image} />}
        {head.image && <meta property="og:image:width" content="1200" />}
        {head.image && <meta property="og:image:height" content="630" />}
        {head.image && <meta property="og:image:alt" content={head.imageAlt} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className={styles.hero} data-art-target="" data-bar-zone="">
        <img
          className={styles.heroImg}
          src={project.keyArt}
          srcSet={project.keyArtSrcset}
          sizes="100vw"
          alt=""
          data-focus={project.keyArtFocus}
          fetchPriority="high"
          decoding="async"
        />
        {project.draft && <span className={styles.draft}>Draft</span>}
      </div>

      <div className={styles.grid}>
        <header className={styles.head}>
          <div className={styles.backBox}>
            {/* The hero flies back into its card; the link lands on the Projects section. */}
            <Link
              className={`${styles.back} ${styles.roll}`}
              to="/#projects"
              onClick={(event) => startArtReturn(project.slug, () => navigate('/#projects'), event)}
            >
              <span aria-hidden="true">← </span>Projects
            </Link>
          </div>
          <h1 className={styles.title}>
            <span className={styles.visuallyHidden}>{project.title}</span>
            <span className={styles.letters} aria-hidden="true">
              {titleWords(project.title).map(({ letters, start }) => (
                <span key={start} className={styles.word}>
                  {letters.map((letter, l) => (
                    <span key={l} className={styles.letter}>
                      <span
                        className={`${styles.glyph} ${styles.roll}`}
                        style={{ '--i': start + l } as CSSProperties}
                        data-glyph=""
                      >
                        {letter}
                      </span>
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </h1>
          <div className={styles.ledeBox}>
            <p className={`${styles.lede} ${styles.roll}`}>{project.description}</p>
          </div>
        </header>

        <aside
          ref={railRef}
          className={`${styles.rail} ${styles.rise}`}
          aria-label={`About ${project.title}`}
        >
          <p className={styles.status}>
            <span className={styles.dot} aria-hidden="true" />
            {project.status}
          </p>
          {project.links.length > 0 && (
            <ul className={styles.links}>
              {project.links.map((link, i) => (
                <li key={link.url}>
                  {i === 0 ? (
                    <a
                      className={`${styles.button} ${styles.primary}`}
                      href={link.url}
                      data-primary=""
                    >
                      {link.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <a className={styles.button} href={link.url} data-hover-fill="">
                      <span className={styles.ink} aria-hidden="true" data-ink="" />
                      {link.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {project.facts.length > 0 && (
            <dl className={styles.sheet}>
              {project.facts.map((fact) => (
                <div key={fact.label} className={styles.row}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </aside>

        <div className={styles.body}>
          <Prose folder={project.folder} Content={project.Content} />
        </div>
      </div>

      {next && <NextProject project={next} />}
    </article>
  );
}
