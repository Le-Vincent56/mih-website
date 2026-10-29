import { describe, expect, test } from 'vitest';
import { CREW_ALT, CREW_RISE_ORDER, crewDelay, crewLayers } from './crew';

describe('crew rise', () => {
  test('rises middle two first: Brody, Owen, Bella, Vincent, from 0.20s every 0.10s', () => {
    expect(CREW_RISE_ORDER).toEqual(['brody', 'owen', 'bella', 'vincent']);
    expect(CREW_RISE_ORDER.map(crewDelay)).toEqual([0.2, 0.3, 0.4, 0.5]);
  });

  test('names all four members once for screen readers', () => {
    for (const name of ['Bella', 'Brody', 'Owen', 'Vincent']) expect(CREW_ALT).toContain(name);
    expect(crewLayers.filter((layer) => layer.alt !== '')).toHaveLength(1);
  });

  test('uses the group illustration at Brody’s slot until the separate layers arrive', () => {
    expect(crewLayers).toHaveLength(1);
    expect(crewLayers[0]).toMatchObject({ key: 'group', alt: CREW_ALT, delay: 0.2 });
    expect(crewLayers[0].src).toMatch(/crew.*\.png/);
  });
});
