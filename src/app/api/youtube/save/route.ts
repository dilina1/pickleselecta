import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { freshAccessToken } from "@/lib/auth";

export const maxDuration = 60;

const YT = "https://www.googleapis.com/youtube/v3";

type TrackIn = { title: string; artists: string };

class YtError extends Error {
  constructor(public status: number, public reason: string, message: string) {
    super(message);
  }
}

async function yt(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${YT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = json?.error?.errors?.[0]?.reason ?? "unknown";
    throw new YtError(res.status, reason, json?.error?.message ?? `YouTube ${res.status}`);
  }
  return json;
}

// Prefer official audio / topic uploads in the Music category.
async function findVideo(t: TrackIn, token: string): Promise<string | null> {
  const q = encodeURIComponent(`${t.artists.split(",")[0]} - ${t.title}`);
  const json = await yt(
    `/search?part=snippet&type=video&videoCategoryId=10&maxResults=1&q=${q}&fields=items/id/videoId`,
    token
  );
  return json?.items?.[0]?.id?.videoId ?? null;
}

export async function POST(req: NextRequest) {
  const { name, tracks }: { name?: string; tracks: TrackIn[] } = await req.json();
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return NextResponse.json({ error: "No tracks to save" }, { status: 400 });
  }
  if (tracks.length > 40) {
    return NextResponse.json({ error: "Max 40 tracks per save (YouTube daily quota)" }, { status: 400 });
  }

  const token = await freshAccessToken(await getToken({ req }));
  if (!token) {
    return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });
  }

  let playlistId: string | null = null;
  const added: string[] = [];
  const missed: string[] = [];
  let stopped: string | null = null;

  try {
    // Resolve videos in parallel (read-only), then insert in order.
    const settled = await Promise.allSettled(tracks.map((t) => findVideo(t, token)));
    const quota = settled.find(
      (s) => s.status === "rejected" && (s.reason as YtError).reason === "quotaExceeded"
    );
    if (quota) {
      return NextResponse.json(
        { error: "YouTube's free daily quota is used up. It resets at midnight Pacific time. Use the per-track YouTube Music links meanwhile." },
        { status: 429 }
      );
    }
    const videoIds = settled.map((s) => (s.status === "fulfilled" ? s.value : null));

    const playlist = await yt("/playlists?part=snippet,status", token, {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          title: name?.slice(0, 100) || `PickleSelecta set ${new Date().toISOString().slice(0, 10)}`,
          description: "Harmonic set built with PickleSelecta",
        },
        status: { privacyStatus: "private" },
      }),
    });
    playlistId = playlist.id;

    for (let i = 0; i < tracks.length; i++) {
      const label = `${tracks[i].artists} - ${tracks[i].title}`;
      const videoId = videoIds[i];
      if (!videoId) {
        missed.push(label);
        continue;
      }
      try {
        await yt("/playlistItems?part=snippet", token, {
          method: "POST",
          body: JSON.stringify({
            snippet: {
              playlistId,
              resourceId: { kind: "youtube#video", videoId },
            },
          }),
        });
        added.push(label);
      } catch (e: any) {
        if (e instanceof YtError && e.reason === "quotaExceeded") {
          stopped = "YouTube's daily quota ran out part-way; the rest were not added.";
          missed.push(...tracks.slice(i).map((x) => `${x.artists} - ${x.title}`));
          break;
        }
        missed.push(label);
      }
    }
  } catch (e: any) {
    const status = e instanceof YtError ? e.status : 502;
    return NextResponse.json(
      {
        error:
          e instanceof YtError && e.status === 403 && e.reason !== "quotaExceeded"
            ? "YouTube refused access. Check the YouTube Data API is enabled and your Google account is a test user."
            : e.message,
        playlistId,
      },
      { status }
    );
  }

  return NextResponse.json({
    playlistId,
    url: playlistId ? `https://music.youtube.com/playlist?list=${playlistId}` : null,
    added: added.length,
    missed,
    note: stopped,
  });
}
