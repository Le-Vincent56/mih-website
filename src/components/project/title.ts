// The fitted Koulen title: a title's width in em, so CSS can size
// it to its column with `min(max, 100cqi / var(--title-em))` and it never shifts after load.

/**
 * Koulen's advance widths in em (measured in the browser at 100px). Every letter of a title sits
 * in its own clip box, so there is no kerning: the title's width is the sum of its advances.
 */
export const KOULEN_ADVANCE: Record<string, number> = {
  A: 0.4268,
  B: 0.4639,
  C: 0.4527,
  D: 0.4717,
  E: 0.4199,
  F: 0.4209,
  G: 0.4498,
  H: 0.4746,
  I: 0.21,
  J: 0.4346,
  K: 0.4688,
  L: 0.397,
  M: 0.5366,
  N: 0.4639,
  O: 0.4566,
  P: 0.4566,
  Q: 0.4659,
  R: 0.482,
  S: 0.4355,
  T: 0.3999,
  U: 0.46,
  V: 0.4327,
  W: 0.6289,
  X: 0.4038,
  Y: 0.4009,
  Z: 0.4136,
  '0': 0.4966,
  '1': 0.21,
  '2': 0.439,
  '3': 0.44,
  '4': 0.4507,
  '5': 0.4327,
  '6': 0.4546,
  '7': 0.442,
  '8': 0.4487,
  '9': 0.4487,
  '&': 0.4966,
  '!': 0.2027,
  '?': 0.4346,
  "'": 0.212,
  '’': 0.333,
  ':': 0.2027,
  '.': 0.2027,
  ',': 0.2027,
  '-': 0.3027,
  '+': 0.442,
  '/': 0.2988,
  '(': 0.3257,
  ')': 0.3257,
  '#': 0.4737,
  '@': 0.5405,
  $: 0.375,
  '%': 0.6777,
  '*': 0.3516,
};

/** The width of a character Koulen's table doesn't list. */
const UNKNOWN = 0.46;
/** The gap between words, as in the homepage titles. */
const WORD_GAP = 0.2;

/** A title's rendered width in em: its letters' advances plus 0.2em per word gap. */
export function koulenEm(title: string): number {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const letters = words.reduce(
    (sum, word) => sum + [...word].reduce((w, ch) => w + (KOULEN_ADVANCE[ch] ?? UNKNOWN), 0),
    0,
  );
  return Number((letters + WORD_GAP * Math.max(0, words.length - 1)).toFixed(4));
}

/** A title's words as letters, each word with the index of its first letter (for staggers). */
export function titleWords(title: string): { letters: string[]; start: number }[] {
  let start = 0;
  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const letters = [...word];
      const entry = { letters, start };
      start += letters.length;
      return entry;
    });
}
