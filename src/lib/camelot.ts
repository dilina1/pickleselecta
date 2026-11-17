// Camelot wheel helpers. Spotify-style input: key 0-11 (C=0), mode 1=major, 0=minor.

const MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

export type Camelot = { num: number; letter: "A" | "B" };

export type Compat = "same" | "relative" | "adjacent" | "diagonal" | "boost";

export function toCamelot(
  key: number | undefined | null,
  mode: number | undefined | null
): Camelot | null {
  if (key == null || key < 0 || key > 11 || (mode !== 0 && mode !== 1)) {
    return null;
  }
  return mode === 1
    ? { num: MAJOR[key], letter: "B" }
    : { num: MINOR[key], letter: "A" };
}

export function camelotLabel(c: Camelot | null): string {
  return c ? `${c.num}${c.letter}` : "?";
}

// Distance around the 12-position wheel (0..6)
function wheelDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

export function compatibility(
  seed: Camelot | null,
  other: Camelot | null
): Compat | null {
  if (!seed || !other) return null;
  const d = wheelDistance(seed.num, other.num);
  const sameLetter = seed.letter === other.letter;
  if (sameLetter && d === 0) return "same";
  if (!sameLetter && d === 0) return "relative";
  if (sameLetter && d === 1) return "adjacent";
  if (!sameLetter && d === 1) return "diagonal";
  if (sameLetter && d === 2) return "boost";
  return null;
}

const COMPAT_SCORE: Record<Compat, number> = {
  same: 5,
  adjacent: 4,
  relative: 4,
  diagonal: 2,
  boost: 1,
};

// Smallest % tempo gap, also allowing half / double time.
export function bpmGapPercent(a: number, b: number): number {
  if (!a || !b) return 100;
  const ratios = [b / a, (b * 2) / a, b / (a * 2)];
  return Math.min(...ratios.map((r) => Math.abs(r - 1) * 100));
}

export function scoreCandidate(
  compat: Compat | null,
  gapPercent: number,
  maxGap = 6
): number {
  if (!compat || gapPercent > maxGap) return -1;
  return COMPAT_SCORE[compat] * 10 - gapPercent;
}
