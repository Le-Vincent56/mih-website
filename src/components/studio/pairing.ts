// Line-paired word travel: when a paragraph moves to a new position and text, lines
// pair in order and words pair within their lines, so every word slides along its
// own row and no paths cross.

export interface WordBox {
  text: string;
  x: number;
  y: number;
}

export interface Traveler {
  text: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The word's place in its line: 0 for the first word, 1 for the last. */
  position: number;
  /** True for the old text's words (rolling out), false for the new text's (rolling in). */
  outgoing: boolean;
}

/** Groups measured words into rows, in reading order. */
export function groupLines(words: WordBox[], tolerance = 4): WordBox[][] {
  const lines: WordBox[][] = [];
  for (const word of words) {
    const row = lines[lines.length - 1];
    if (row && Math.abs(row[0].y - word.y) <= tolerance) row.push(word);
    else lines.push([word]);
  }
  return lines;
}

const proportion = (i: number, count: number) => (count > 1 ? i / (count - 1) : 0);
const pick = <T>(items: T[], u: number): T => items[Math.round(u * (items.length - 1))];
const point = ({ x, y }: WordBox) => ({ x, y });

/** Pairs the old text's lines and words with the new text's, both ways. */
export function pairLines(from: WordBox[][], to: WordBox[][]): Traveler[] {
  const travelers: Traveler[] = [];
  from.forEach((row, li) => {
    const target = pick(to, proportion(li, from.length));
    row.forEach((word, wi) => {
      const position = proportion(wi, row.length);
      travelers.push({
        text: word.text,
        from: point(word),
        to: point(pick(target, position)),
        position,
        outgoing: true,
      });
    });
  });
  to.forEach((row, li) => {
    const source = pick(from, proportion(li, to.length));
    row.forEach((word, wi) => {
      const position = proportion(wi, row.length);
      travelers.push({
        text: word.text,
        from: point(pick(source, position)),
        to: point(word),
        position,
        outgoing: false,
      });
    });
  });
  return travelers;
}

/** How far a word trails the leader of its line: 0 at the end facing the travel, 1 at the other. */
export const lagOf = (position: number, movingRight: boolean): number =>
  movingRight ? 1 - position : position;

/** One frame of the chain: `v` chases `t`, slower the further the word trails. */
export const chainStep = (v: number, t: number, dt: number, lag: number): number =>
  v + (t - v) * (1 - Math.exp((-dt * 16) / (1 + 3 * lag)));
