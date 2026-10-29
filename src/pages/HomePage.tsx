import { Crew } from '../components/crew/Crew';
import { Hero } from '../components/hero/Hero';
import { Projects } from '../components/projects/Projects';
import { StudioIntro } from '../components/studio/StudioIntro';

export function HomePage() {
  return (
    <main>
      <Hero />
      <StudioIntro />
      <Projects />
      <Crew />
    </main>
  );
}
