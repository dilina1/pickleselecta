// Deezer public API: free, no key. Used for text search, cover art and 30s previews.

const D = "https://api.deezer.com";

export type DeezerTrack = {
  isrc: string;
  title: string;
  artists: string;
  cover: string | null;
  preview: string | null;
};

function shape(t: any): DeezerTrack | null {
  if (!t?.isrc) return null;
  return {
    isrc: t.isrc,
    title: t.title ?? "Unknown title",
    artists: t.artist?.name ?? "",
    cover: t.album?.cover_medium ?? null,
    preview: t.preview || null,
  };
}

export async function search(q: string): Promise<DeezerTrack[]> {
  const res = await fetch(
    `${D}/search/track?q=${encodeURIComponent(q)}&limit=10`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Deezer search ${res.status}`);
  const json = await res.json();
  const seen = new Set<string>();
  const out: DeezerTrack[] = [];
  for (const item of json?.data ?? []) {
    const t = shape(item);
    if (t && !seen.has(t.isrc)) {
      seen.add(t.isrc);
      out.push(t);
    }
  }
  return out;
}

export async function byIsrc(isrc: string): Promise<DeezerTrack | null> {
  try {
    const res = await fetch(`${D}/track/isrc:${encodeURIComponent(isrc)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) return null;
    return shape(json);
  } catch {
    return null;
  }
}

// Run fn over items with limited concurrency (Deezer allows ~50 req / 5s).
export async function pmap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}
