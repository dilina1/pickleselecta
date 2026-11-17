// Free key/BPM + candidate source (ReccoBeats). Spotify's /audio-features and
// /recommendations are closed to new apps, so we use this instead.
// Response shapes are handled defensively because the API is lightly documented.

const BASE = "https://api.reccobeats.com/v1";

export type ReccoFeatures = {
  spotifyId: string;
  tempo: number;
  key: number;
  mode: number;
};

export type ReccoCandidate = {
  spotifyId: string;
  title: string;
  artists: string;
};

const SPOTIFY_ID = /(?:track\/|track:)([A-Za-z0-9]{22})/;

function spotifyIdOf(item: any): string | null {
  const href: string | undefined = item?.href ?? item?.spotifyUrl;
  const m = href ? SPOTIFY_ID.exec(href) : null;
  if (m) return m[1];
  if (typeof item?.id === "string" && /^[A-Za-z0-9]{22}$/.test(item.id)) {
    return item.id;
  }
  return null;
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ReccoBeats ${path} -> ${res.status}`);
  }
  return res.json();
}

export async function getFeatures(
  spotifyIds: string[]
): Promise<Record<string, ReccoFeatures>> {
  const out: Record<string, ReccoFeatures> = {};
  // Keep batches small to stay within URL/limit constraints.
  for (let i = 0; i < spotifyIds.length; i += 40) {
    const batch = spotifyIds.slice(i, i + 40);
    const data = await get(`/audio-features?ids=${batch.join(",")}`);
    const items: any[] = data?.content ?? [];
    items.forEach((item, idx) => {
      // Prefer the id embedded in href; fall back to request order.
      const sid = spotifyIdOf(item) ?? batch[idx];
      if (!sid || typeof item?.tempo !== "number") return;
      out[sid] = {
        spotifyId: sid,
        tempo: item.tempo,
        key: typeof item.key === "number" ? item.key : -1,
        mode: typeof item.mode === "number" ? item.mode : -1,
      };
    });
  }
  return out;
}

export async function getCandidates(
  seedSpotifyId: string,
  size = 100
): Promise<ReccoCandidate[]> {
  const data = await get(
    `/track/recommendation?size=${size}&seeds=${seedSpotifyId}`
  );
  const items: any[] = data?.content ?? [];
  const out: ReccoCandidate[] = [];
  for (const item of items) {
    const sid = spotifyIdOf(item);
    if (!sid) continue;
    out.push({
      spotifyId: sid,
      title: item.trackTitle ?? item.name ?? "Unknown title",
      artists: Array.isArray(item.artists)
        ? item.artists.map((a: any) => a.name).join(", ")
        : "",
    });
  }
  return out;
}
