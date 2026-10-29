// The crew illustration layers and their rise timing.
import crewGroup from '../../assets/crew.png';

export type CrewName = 'bella' | 'brody' | 'owen' | 'vincent';

/** Middle two first, then the outer two. */
export const CREW_RISE_ORDER: readonly CrewName[] = ['brody', 'owen', 'bella', 'vincent'];

const CREW_START = 0.2;
const CREW_STAGGER = 0.1;

/** Seconds from the start of the intro until this member starts rising. */
export function crewDelay(name: CrewName): number {
  const slot = CREW_RISE_ORDER.indexOf(name);
  return Math.round((CREW_START + slot * CREW_STAGGER) * 100) / 100;
}

/** Carried by exactly one layer, so screen readers hear the crew once. */
export const CREW_ALT = 'The Made In House crew: Bella, Brody, Owen and Vincent';

export interface CrewLayer {
  key: CrewName | 'group';
  src: string;
  alt: string;
  delay: number;
}

// Placeholder until Bella's four same-canvas layers arrive: the whole group rises at Brody's slot.
// Swap target, in front-to-back order from Bella's notes, once src/assets/crew/<name>.png exist:
//   { key: 'bella', src: bella, alt: CREW_ALT, delay: crewDelay('bella') },
//   { key: 'brody', src: brody, alt: '', delay: crewDelay('brody') },
//   { key: 'owen', src: owen, alt: '', delay: crewDelay('owen') },
//   { key: 'vincent', src: vincent, alt: '', delay: crewDelay('vincent') },
// and update crew.test.ts's placeholder test.
export const crewLayers: CrewLayer[] = [
  { key: 'group', src: crewGroup, alt: CREW_ALT, delay: crewDelay('brody') },
];
