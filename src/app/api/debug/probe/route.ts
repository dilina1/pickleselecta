// TEMPORARY probe. Remove after verifying.
import { NextResponse } from "next/server";

const R = "https://api.reccobeats.com/v1";
const UUID = "29d0cabe-7518-45a6-b9a1-928dbd7c0e55";
const probes: Record<string, string> = {
  recco_track_by_isrc: `${R}/track?ids=USSM12306318`,
  recco_track_by_spotify: `${R}/track?ids=6Gj8DibSTKIKn9uu2nEzbp`,
  recco_track_search: `${R}/track/search?searchText=travis%20scott%20zombies`,
  recco_search: `${R}/search?searchText=travis%20scott%20zombies`,
  recco_features_uuid: `${R}/audio-features?ids=${UUID}`,
  recco_rec_uuid_target: `${R}/track/recommendation?size=3&seeds=${UUID}&key=1&mode=1`,
  deezer_search: `https://api.deezer.com/search/track?q=zombies%20travis%20scott&limit=2`,
  deezer_isrc: `https://api.deezer.com/track/isrc:USSM12306318`,
};

export async function GET() {
  const out: Record<string, unknown> = {};
  await Promise.all(
    Object.entries(probes).map(async ([k, url]) => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const t = await r.text();
        out[k] = { status: r.status, body: t.slice(0, 700) };
      } catch (e: any) {
        out[k] = { error: e.message };
      }
    })
  );
  return NextResponse.json(out);
}
