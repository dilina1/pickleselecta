import { NextRequest, NextResponse } from "next/server";
import {
  bpmGapPercent,
  camelotLabel,
  compatibility,
  scoreCandidate,
  toCamelot,
} from "@/lib/camelot";
import { getCandidates, getFeatures } from "@/lib/reccobeats";

export async function POST(req: NextRequest) {
  const {
    seedId,
    exclude = [],
    maxGap = 6,
  }: { seedId: string; exclude?: string[]; maxGap?: number } = await req.json();

  if (!seedId) {
    return NextResponse.json({ error: "seedId required" }, { status: 400 });
  }

  try {
    const [candidates, seedFeat] = await Promise.all([
      getCandidates(seedId),
      getFeatures([seedId]),
    ]);
    const seed = seedFeat[seedId];
    if (!seed) {
      return NextResponse.json(
        { error: "No key/BPM found for the seed track" },
        { status: 404 }
      );
    }
    const seedCamelot = toCamelot(seed.key, seed.mode);

    const skip = new Set([seedId, ...exclude]);
    const pool = candidates.filter((c) => !skip.has(c.spotifyId));
    const feats = await getFeatures(pool.map((c) => c.spotifyId));

    const ranked = pool
      .map((c) => {
        const f = feats[c.spotifyId];
        if (!f) return null;
        const camelot = toCamelot(f.key, f.mode);
        const compat = compatibility(seedCamelot, camelot);
        const gap = bpmGapPercent(seed.tempo, f.tempo);
        return {
          id: c.spotifyId,
          title: c.title,
          artists: c.artists,
          bpm: Math.round(f.tempo),
          camelot: camelotLabel(camelot),
          compat,
          bpmGap: Number(gap.toFixed(1)),
          score: scoreCandidate(compat, gap, maxGap),
        };
      })
      .filter((c): c is NonNullable<typeof c> => !!c && c.score >= 0)
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      seed: {
        id: seedId,
        bpm: Math.round(seed.tempo),
        camelot: camelotLabel(seedCamelot),
      },
      candidates: ranked,
      poolSize: pool.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
