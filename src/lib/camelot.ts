// Camelot wheel helpers. Input: key 0-11 (C=0), mode 1=major, 0=minor.

const MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

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

export function keyName(
  key: number | undefined | null,
  mode: number | undefined | null
): string {
  if (key == null || key < 0 || key > 11 || (mode !== 0 && mode !== 1)) {
    return "?";
  }
  return `${NAMES[key]} ${mode === 1 ? "maj" : "min"}`;
}

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
  return COMPAT_SCORE[compat] * 10 - gapPercent * 0.5;
}

// Inverse of toCamelot: Camelot slot -> Spotify-style key/mode.
export function fromCamelot(c: Camelot): { key: number; mode: number } {
  const table = c.letter === "B" ? MAJOR : MINOR;
  return { key: table.indexOf(c.num), mode: c.letter === "B" ? 1 : 0 };
}

const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;

// The slots that mix with `seed`, used to request a key-diverse candidate pool.
export function compatibleSlots(seed: Camelot): Camelot[] {
  const other = seed.letter === "A" ? "B" : "A";
  return [
    { num: wrap(seed.num + 1), letter: seed.letter },
    { num: wrap(seed.num - 1), letter: seed.letter },
    { num: seed.num, letter: other },
    { num: wrap(seed.num + 1), letter: other },
    { num: wrap(seed.num - 1), letter: other },
    { num: wrap(seed.num + 2), letter: seed.letter },
  ];
}
