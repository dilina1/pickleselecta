"use client";

import { useState } from "react";

type SeedHit = { id: string; name: string; artists: string };
type Candidate = {
  id: string;
  title: string;
  artists: string;
  bpm: number;
  camelot: string;
  compat: string | null;
  bpmGap: number;
};
type SetTrack = { id: string; title: string; artists: string; bpm: number; camelot: string };

const BADGE: Record<string, string> = {
  same: "bg-emerald-600",
  adjacent: "bg-sky-600",
  relative: "bg-violet-600",
  diagonal: "bg-amber-600",
  boost: "bg-rose-600",
};

export default function SetBuilder() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SeedHit[]>([]);
  const [set, setSet] = useState<SetTrack[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [maxGap, setMaxGap] = useState(6);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/search/tracks", {
        method: "POST",
        body: JSON.stringify({ data: query }),
      });
      const json = await res.json();
      const items = json?.tracks?.items ?? [];
      if (!items.length) setMsg("No results (are you signed in on the home page?)");
      setHits(
        items.map((t: any) => ({
          id: t.id,
          name: t.name,
          artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
        }))
      );
    } catch {
      setMsg("Search failed");
    }
    setBusy(false);
  }

  async function loadCandidates(seedId: string, current: SetTrack[], gap = maxGap) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/harmonic", {
      method: "POST",
      body: JSON.stringify({ seedId, exclude: current.map((t) => t.id), maxGap: gap }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? "Failed to load matches");
      setCandidates([]);
    } else {
      setCandidates(json.candidates);
      if (current.length === 1) {
        // fill seed key/BPM in the set row
        setSet([{ ...current[0], bpm: json.seed.bpm, camelot: json.seed.camelot }]);
      }
      if (!json.candidates.length) setMsg("No harmonic matches in the pool, try a wider BPM range");
    }
    setBusy(false);
  }

  function pickSeed(h: SeedHit) {
    const first: SetTrack = { id: h.id, title: h.name, artists: h.artists, bpm: 0, camelot: "?" };
    setSet([first]);
    setHits([]);
    loadCandidates(h.id, [first]);
  }

  function addToSet(c: Candidate) {
    const next = [...set, { id: c.id, title: c.title, artists: c.artists, bpm: c.bpm, camelot: c.camelot }];
    setSet(next);
    loadCandidates(c.id, next);
  }

  async function save() {
    setBusy(true);
    const res = await fetch("/api/playlists/save", {
      method: "POST",
      body: JSON.stringify({ data: set.map((t) => t.id) }),
    });
    const json = await res.json();
    setMsg(json?.snapshot_id ? "Saved to your Spotify as a private playlist" : json?.message ?? "Save failed");
    setBusy(false);
  }

  const last = set[set.length - 1];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🎛️ Harmonic Set Builder</h1>
        <a href="/" className="text-sm underline text-neutral-400">Home / sign in</a>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
          placeholder="Search a seed song…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={busy} className="rounded bg-emerald-600 px-4 py-2 disabled:opacity-50">
          Search
        </button>
      </div>

      {hits.length > 0 && (
        <ul className="mb-4 rounded border border-neutral-800 divide-y divide-neutral-800">
          {hits.map((h) => (
            <li key={h.id}>
              <button onClick={() => pickSeed(h)} className="w-full text-left px-3 py-2 hover:bg-neutral-900">
                <span className="font-medium">{h.name}</span>
                <span className="text-neutral-400"> · {h.artists}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="text-sm text-amber-400 mb-3">{msg}</p>}

      {set.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Your set ({set.length})</h2>
            <button onClick={save} disabled={busy || set.length < 2} className="rounded bg-sky-600 px-3 py-1 text-sm disabled:opacity-40">
              Save to Spotify
            </button>
          </div>
          <ol className="space-y-1">
            {set.map((t, i) => (
              <li key={t.id + i} className="flex items-center gap-2 rounded bg-neutral-900 px-3 py-2 text-sm">
                <span className="w-5 text-neutral-500">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate">{t.title} <span className="text-neutral-400">· {t.artists}</span></span>
                <span className="font-mono text-xs rounded bg-neutral-800 px-2 py-1">{t.camelot}</span>
                <span className="font-mono text-xs text-neutral-400">{t.bpm || "—"}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {last && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Mixes with “{last.title}”</h2>
            <label className="text-xs text-neutral-400 flex items-center gap-2">
              BPM ±{maxGap}%
              <input
                type="range" min={2} max={12} value={maxGap}
                onChange={(e) => setMaxGap(Number(e.target.value))}
                onMouseUp={() => loadCandidates(last.id, set, maxGap)}
                onTouchEnd={() => loadCandidates(last.id, set, maxGap)}
              />
            </label>
          </div>
          {busy && <p className="text-sm text-neutral-500">Loading…</p>}
          <ul className="space-y-1">
            {candidates.map((c) => (
              <li key={c.id}>
                <button onClick={() => addToSet(c)} className="w-full flex items-center gap-2 rounded bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm text-left">
                  <span className="flex-1 min-w-0 truncate">{c.title} <span className="text-neutral-400">· {c.artists}</span></span>
                  <span className={`text-[10px] uppercase rounded px-2 py-1 ${BADGE[c.compat ?? ""] ?? "bg-neutral-700"}`}>{c.compat}</span>
                  <span className="font-mono text-xs rounded bg-neutral-800 px-2 py-1">{c.camelot}</span>
                  <span className="font-mono text-xs text-neutral-400">{c.bpm}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
