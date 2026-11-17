// ReccoBeats: free key/BPM + similar-track candidates. Looked up by ISRC, so no
// streaming-service account is involved. Verified against the live API.

const BASE = "https://api.reccobeats.com/v1";

export type ReccoTrack = {
  uuid: string;
  isrc: string;
  title: string;
  artists: string;
};

export type ReccoFeatures = {
  uuid: string;
  tempo: number;
  key: number;
  mode: number;
  energy: number;
  danceability: number;
};

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ReccoBeats ${res.status} for ${path.split("?")[0]}`);
  return res.json();
}

function shapeTrack(item: any): ReccoTrack | null {
  if (!item?.id || !item?.isrc) return null;
  return {
    uuid: item.id,
    isrc: item.isrc,
    title: item.trackTitle ?? "Unknown title",
    artists: Array.isArray(item.artists)
      ? item.artists.map((a: any) => a.name).join(", ")
      : "",
  };
}

export async function trackByIsrc(isrc: string): Promise<ReccoTrack | null> {
  const data = await get(`/track?ids=${encodeURIComponent(isrc)}`);
  return shapeTrack(data?.content?.[0]);
}

export async function recommend(
  seedUuids: string[],
  size = 100
): Promise<ReccoTrack[]> {
  const data = await get(
    `/track/recommendation?size=${size}&seeds=${seedUuids.join(",")}`
  );
  return (data?.content ?? [])
    .map(shapeTrack)
    .filter((t: ReccoTrack | null): t is ReccoTrack => !!t);
}

export async function getFeatures(
  uuids: string[]
): Promise<Record<string, ReccoFeatures>> {
  const batches: string[][] = [];
  for (let i = 0; i < uuids.length; i += 40) batches.push(uuids.slice(i, i + 40));
  const results = await Promise.all(
    batches.map((b) => get(`/audio-features?ids=${b.join(",")}`))
  );
  const out: Record<string, ReccoFeatures> = {};
  for (const data of results) {
    for (const f of data?.content ?? []) {
      if (!f?.id || typeof f.tempo !== "number") continue;
      out[f.id] = {
        uuid: f.id,
        tempo: f.tempo,
        key: typeof f.key === "number" ? f.key : -1,
        mode: typeof f.mode === "number" ? f.mode : -1,
        energy: typeof f.energy === "number" ? f.energy : 0,
        danceability: typeof f.danceability === "number" ? f.danceability : 0,
      };
    }
  }
  return out;
}
