import { NextRequest, NextResponse } from "next/server";
import {
  bpmGapPercent,
  camelotLabel,
  compatibility,
  compatibleSlots,
  fromCamelot,
  keyName,
  scoreCandidate,
  toCamelot,
} from "@/lib/camelot";
import { byIsrc, pmap } from "@/lib/deezer";
import { getFeatures, recommend, trackByIsrc, type ReccoTrack } from "@/lib/reccobeats";

export const maxDuration = 30;

type Body = {
  seedIsrc?: string; // first pick from search
  seedUuid?: string; // later picks: track to match against
  poolSeeds?: string[]; // up to 3 recent set tracks to widen the pool
  exclude?: string[]; // uuids already in the set
  maxGap?: number; // BPM tolerance in %
};

const LIMIT = 30;

// Covers, karaoke and gym-mix filler crowd out the real tracks.
const JUNK = /(karaoke|tribute|made famous|originally performed|backing track|\bcover\b|work ?out|lullaby|8-bit|ringtone|party (music|nation)|\bdj mix\b)/i;
const normTitle = (t: string) =>
  t.toLowerCase().replace(/[(\[].*?[)\]]/g, "").replace(/\s+-\s+.*$/, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return run({
    seedIsrc: q.get("seedIsrc") ?? undefined,
    seedUuid: q.get("seedUuid") ?? undefined,
    maxGap: q.get("maxGap") ? Number(q.get("maxGap")) : undefined,
  });
}

export async function POST(req: NextRequest) {
  return run(await req.json());
}

async function run(body: Body) {
  const maxGap = Math.min(Math.max(body.maxGap ?? 6, 1), 15);

  try {
    let seedUuid = body.seedUuid;
    if (!seedUuid) {
      if (!body.seedIsrc) {
        return NextResponse.json({ error: "seedIsrc or seedUuid required" }, { status: 400 });
      }
      const t = await trackByIsrc(body.seedIsrc);
      if (!t) {
        return NextResponse.json(
          { error: "That track isn't in the key/BPM database. Try another version of the song." },
          { status: 404 }
        );
      }
      seedUuid = t.uuid;
    }

    const pool = Array.from(new Set([seedUuid, ...(body.poolSeeds ?? [])])).slice(0, 3);
    const seedFeat = await getFeatures([seedUuid]);
    const seed = seedFeat[seedUuid];
    const seedCamelot = seed ? toCamelot(seed.key, seed.mode) : null;
    if (!seed || !seedCamelot) {
      return NextResponse.json(
        { error: "No key data for this track, so it can't be matched. Try another version." },
        { status: 422 }
      );
    }

    // Base pool (same-ish key) plus one request per compatible key slot so the
    // list has real harmonic variety, all pinned near the seed's tempo.
    const tempo = Math.round(seed.tempo);
    const settled = await Promise.allSettled([
      recommend(pool, 100, { tempo }),
      ...compatibleSlots(seedCamelot).map((slot) =>
        recommend(pool, 40, { ...fromCamelot(slot), tempo })
      ),
    ]);
    const recs: ReccoTrack[] = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    if (settled[0].status === "rejected") throw settled[0].reason;

    const skip = new Set([seedUuid, ...(body.exclude ?? [])]);
    const seenIsrc = new Set<string>();
    const seenTitle = new Set<string>();
    const candidatesIn = recs
      .sort((a, b) => b.popularity - a.popularity)
      .filter((r) => {
        const nt = normTitle(r.title);
        if (skip.has(r.uuid) || seenIsrc.has(r.isrc) || seenTitle.has(nt)) return false;
        if (JUNK.test(r.title) || JUNK.test(r.artists)) return false;
        seenIsrc.add(r.isrc);
        seenTitle.add(nt);
        return true;
      });
    const feats = await getFeatures(candidatesIn.map((c) => c.uuid));

    const ranked = candidatesIn
      .map((c) => {
        const f = feats[c.uuid];
        if (!f) return null;
        const camelot = toCamelot(f.key, f.mode);
        const compat = compatibility(seedCamelot, camelot);
        const gap = bpmGapPercent(seed.tempo, f.tempo);
        return {
          uuid: c.uuid,
          isrc: c.isrc,
          title: c.title,
          artists: c.artists,
          bpm: Math.round(f.tempo),
          camelot: camelotLabel(camelot),
          key: keyName(f.key, f.mode),
          energy: Math.round(f.energy * 100),
          compat,
          bpmGap: Number(gap.toFixed(1)),
          score: scoreCandidate(compat, gap, maxGap) + c.popularity / 20,
        };
      })
      .filter((c): c is NonNullable<typeof c> => !!c && c.score >= 0)
      .sort((a, b) => b.score - a.score);

    const keyCounts: Record<string, number> = {};
    for (const c of ranked) keyCounts[c.camelot] = (keyCounts[c.camelot] ?? 0) + 1;

    const top = ranked.slice(0, LIMIT);
    const art = await pmap(top, 10, (c) => byIsrc(c.isrc));
    const candidates = top.map((c, i) => ({
      ...c,
      cover: art[i]?.cover ?? null,
      preview: art[i]?.preview ?? null,
    }));

    return NextResponse.json({
      seed: {
        uuid: seedUuid,
        bpm: Math.round(seed.tempo),
        camelot: camelotLabel(seedCamelot),
        key: keyName(seed.key, seed.mode),
        energy: Math.round(seed.energy * 100),
      },
      candidates,
      keyCounts,
      poolSize: candidatesIn.length,
      matched: ranked.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
