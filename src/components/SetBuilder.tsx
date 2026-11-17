"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type Hit = { isrc: string; title: string; artists: string; cover: string | null; preview: string | null };
type SetTrack = Hit & { uuid: string; bpm: number; camelot: string; key: string };
type Candidate = {
  uuid: string; isrc: string; title: string; artists: string;
  bpm: number; camelot: string; key: string; energy: number;
  compat: string | null; bpmGap: number; score: number;
  cover: string | null; preview: string | null;
};
type SeedInfo = { uuid: string; bpm: number; camelot: string; key: string; energy: number };
type Sort = "match" | "bpm" | "energy";

const BADGE: Record<string, string> = {
  same: "bg-emerald-700", adjacent: "bg-sky-700", relative: "bg-violet-700",
  diagonal: "bg-amber-700", boost: "bg-rose-700",
};
const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const STORE = "pickleselecta:set";

const ytMusicSearch = (t: { title: string; artists: string }) =>
  `https://music.youtube.com/search?q=${encodeURIComponent(`${t.artists} ${t.title}`)}`;

function Cover({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
  ) : (
    <div className="w-12 h-12 rounded bg-shell-700 shrink-0" />
  );
}

export default function SetBuilder() {
  const { data: session } = useSession();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [set, setSet] = useState<SetTrack[]>([]);
  const [seed, setSeed] = useState<SeedInfo | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [keyCounts, setKeyCounts] = useState<Record<string, number>>({});
  const [maxGap, setMaxGap] = useState(6);
  const [sort, setSort] = useState<Sort>("match");
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ text: string; url?: string } | null>(null);

  // restore set after reload / Google sign-in redirect
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved: SetTrack[] = JSON.parse(raw);
        if (saved.length) {
          setSet(saved);
          load({ seedUuid: saved[saved.length - 1].uuid }, saved, 6);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(set)); } catch {}
  }, [set]);

  async function search() {
    if (!query.trim()) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHits(json.tracks);
      if (!json.tracks.length) setMsg("No results");
    } catch (e: any) { setMsg(e.message || "Search failed"); }
    setBusy(false);
  }

  async function load(target: { seedIsrc?: string; seedUuid?: string }, current: SetTrack[], gap: number) {
    setBusy(true); setMsg(""); setKeyFilter(null);
    try {
      const res = await fetch("/api/harmonic", {
        method: "POST",
        body: JSON.stringify({
          ...target,
          poolSeeds: current.slice(-3).map((t) => t.uuid),
          exclude: current.map((t) => t.uuid),
          maxGap: gap,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? "Failed to load matches"); setCands([]); setBusy(false); return null; }
      setSeed(json.seed); setCands(json.candidates); setKeyCounts(json.keyCounts);
      if (!json.candidates.length) setMsg("No harmonic matches found. Try widening the BPM range.");
      setBusy(false);
      return json.seed as SeedInfo;
    } catch (e: any) { setMsg(e.message || "Failed"); setBusy(false); return null; }
  }

  async function pickSeed(h: Hit) {
    setHits([]); setQuery(""); setSaveMsg(null);
    const info = await load({ seedIsrc: h.isrc }, [], maxGap);
    if (info) setSet([{ ...h, uuid: info.uuid, bpm: info.bpm, camelot: info.camelot, key: info.key }]);
  }

  function addToSet(c: Candidate) {
    const next = [...set, { isrc: c.isrc, title: c.title, artists: c.artists, cover: c.cover, preview: c.preview, uuid: c.uuid, bpm: c.bpm, camelot: c.camelot, key: c.key }];
    setSet(next); setSaveMsg(null);
    load({ seedUuid: c.uuid }, next, maxGap);
  }

  function removeAt(i: number) {
    const next = set.filter((_, idx) => idx !== i);
    setSet(next); setSaveMsg(null);
    if (next.length) load({ seedUuid: next[next.length - 1].uuid }, next, maxGap);
    else { setSeed(null); setCands([]); setKeyCounts({}); }
  }

  function clearSet() { setSet([]); setSeed(null); setCands([]); setKeyCounts({}); setSaveMsg(null); setMsg(""); }

  function togglePlay(id: string, url: string | null) {
    const a = audioRef.current;
    if (!a || !url) return;
    if (playing === id) { a.pause(); setPlaying(null); return; }
    a.src = url; a.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
  }

  async function saveToYouTube() {
    if (!session) { signIn("google"); return; }
    setBusy(true); setSaveMsg(null);
    try {
      const res = await fetch("/api/youtube/save", {
        method: "POST",
        body: JSON.stringify({ tracks: set.map((t) => ({ title: t.title, artists: t.artists })) }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveMsg({ text: json.error ?? "Save failed" }); }
      else {
        const missed = json.missed?.length ? ` · couldn't find: ${json.missed.join("; ")}` : "";
        setSaveMsg({ text: `Saved ${json.added}/${set.length} tracks${json.note ? " · " + json.note : ""}${missed}`, url: json.url });
      }
    } catch { setSaveMsg({ text: "Save failed" }); }
    setBusy(false);
  }

  function copyList() {
    const text = set.map((t, i) => `${i + 1}. ${t.artists} - ${t.title} [${t.camelot} · ${t.bpm} BPM]`).join("\n");
    navigator.clipboard?.writeText(text).then(() => setSaveMsg({ text: "Tracklist copied" }));
  }

  const shown = cands
    .filter((c) => !keyFilter || c.camelot === keyFilter)
    .sort((a, b) => sort === "bpm" ? a.bpmGap - b.bpmGap : sort === "energy" ? b.energy - a.energy : b.score - a.score);
  const last = set[set.length - 1];

  return (
    <div className="min-h-screen bg-shell-900 text-shell-100">
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />
      <div className="max-w-5xl mx-auto p-4 grid gap-6 lg:grid-cols-[1fr_340px]">
        <header className="lg:col-span-2 flex items-center justify-between">
          <h1 className="text-xl font-bold">🥒 PickleSelecta <span className="text-shell-400 font-normal text-sm">harmonic set builder</span></h1>
          {session ? (
            <button onClick={() => signOut()} className="text-xs text-shell-300 underline">Signed in · sign out</button>
          ) : (
            <span className="text-xs text-shell-400">Sign in is only needed to save to YouTube</span>
          )}
        </header>

        <main className="min-w-0 space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 min-w-0 rounded bg-shell-800 border border-shell-600 px-3 py-2 placeholder:text-shell-400"
              placeholder="Search a seed song…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button onClick={search} disabled={busy} className="rounded bg-coral-500 text-black font-medium px-4 py-2 disabled:opacity-50">Search</button>
          </div>

          {hits.length > 0 && (
            <ul className="rounded border border-shell-700 divide-y divide-shell-700 overflow-hidden">
              {hits.map((h) => (
                <li key={h.isrc} className="flex items-center gap-3 p-2 bg-shell-800">
                  <Cover src={h.cover} />
                  <button onClick={() => pickSeed(h)} className="flex-1 min-w-0 text-left">
                    <div className="truncate font-medium">{h.title}</div>
                    <div className="truncate text-sm text-shell-300">{h.artists}</div>
                  </button>
                  {h.preview && <button onClick={() => togglePlay("h" + h.isrc, h.preview)} className="px-2 text-lg" aria-label="Preview">{playing === "h" + h.isrc ? "⏸" : "▶️"}</button>}
                </li>
              ))}
            </ul>
          )}

          {msg && <p className="text-sm text-amber-400">{msg}</p>}

          {seed && last && (
            <>
              <section className="rounded border border-shell-700 bg-shell-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="text-sm">Matching against <b>{last.title}</b> · <span className="font-mono">{seed.camelot}</span> · {seed.key} · {seed.bpm} BPM</div>
                  <label className="text-xs text-shell-300 flex items-center gap-2">BPM ±{maxGap}%
                    <input type="range" min={2} max={12} value={maxGap}
                      onChange={(e) => setMaxGap(Number(e.target.value))}
                      onMouseUp={() => load({ seedUuid: seed.uuid }, set, maxGap)}
                      onTouchEnd={() => load({ seedUuid: seed.uuid }, set, maxGap)} />
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-12 gap-1 min-w-[420px]">
                    {(["B", "A"] as const).map((letter) =>
                      NUMS.map((n) => {
                        const id = `${n}${letter}`;
                        const count = keyCounts[id] ?? 0;
                        const isSeed = id === seed.camelot;
                        const active = keyFilter === id;
                        return (
                          <button key={id} disabled={!count && !isSeed}
                            onClick={() => setKeyFilter(active ? null : id)}
                            className={`rounded text-[11px] py-1.5 font-mono leading-tight ${
                              isSeed ? "bg-coral-500 text-black font-bold"
                              : active ? "bg-emerald-500 text-black"
                              : count ? "bg-emerald-800 hover:bg-emerald-700"
                              : "bg-shell-700/40 text-shell-500"}`}>
                            {id}{count > 0 && !isSeed && <div className="text-[9px] opacity-80">{count}</div>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-shell-400">
                  <span>{keyFilter ? `Filtering ${keyFilter} · tap again to clear` : "Tap a key to filter"}</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-shell-800 border border-shell-600 rounded px-2 py-1 text-shell-100">
                    <option value="match">Best match</option><option value="bpm">Closest BPM</option><option value="energy">Highest energy</option>
                  </select>
                </div>
              </section>

              <section>
                <h2 className="font-semibold mb-2">Mixes next {busy && <span className="text-shell-400 text-sm font-normal">· loading…</span>}</h2>
                <ul className="space-y-1.5">
                  {shown.map((c) => (
                    <li key={c.uuid} className="flex items-center gap-3 rounded bg-shell-800 p-2">
                      <Cover src={c.cover} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-sm">{c.title}</div>
                        <div className="truncate text-xs text-shell-300">{c.artists}</div>
                        <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                          <span className={`uppercase rounded px-1.5 py-0.5 ${BADGE[c.compat ?? ""] ?? "bg-shell-600"}`}>{c.compat}</span>
                          <span className="rounded bg-shell-700 px-1.5 py-0.5 font-mono">{c.camelot} · {c.key}</span>
                          <span className="rounded bg-shell-700 px-1.5 py-0.5">{c.bpm} BPM</span>
                          <span className="rounded bg-shell-700 px-1.5 py-0.5">⚡{c.energy}</span>
                        </div>
                      </div>
                      {c.preview && <button onClick={() => togglePlay(c.uuid, c.preview)} className="px-1 text-lg" aria-label="Preview">{playing === c.uuid ? "⏸" : "▶️"}</button>}
                      <button onClick={() => addToSet(c)} disabled={busy} className="rounded bg-coral-500 text-black font-medium px-3 py-2 text-sm disabled:opacity-50">Add</button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </main>

        <aside className="lg:sticky lg:top-4 self-start">
          <section className="rounded border border-shell-700 bg-shell-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Your set ({set.length})</h2>
              {set.length > 0 && <button onClick={clearSet} className="text-xs text-shell-400 underline">Clear</button>}
            </div>
            {set.length === 0 ? (
              <p className="text-sm text-shell-400">Search a seed song to start building.</p>
            ) : (
              <>
                <ol className="space-y-1.5 mb-3">
                  {set.map((t, i) => (
                    <li key={t.uuid + i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-shell-500 text-xs">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{t.title}</div>
                        <div className="truncate text-xs text-shell-400">{t.artists}</div>
                      </div>
                      <span className="font-mono text-[11px] rounded bg-shell-700 px-1.5 py-0.5">{t.camelot}</span>
                      <span className="text-[11px] text-shell-400">{t.bpm}</span>
                      <a href={ytMusicSearch(t)} target="_blank" rel="noreferrer" className="text-xs" title="Open in YouTube Music">🎵</a>
                      <button onClick={() => removeAt(i)} className="text-shell-400 text-xs px-1" aria-label="Remove">✕</button>
                    </li>
                  ))}
                </ol>
                <div className="grid gap-2">
                  <button onClick={saveToYouTube} disabled={busy || set.length < 2} className="rounded bg-red-600 text-white font-medium py-2 text-sm disabled:opacity-40">
                    {session ? "Save to YouTube Music" : "Sign in with Google to save"}
                  </button>
                  <button onClick={copyList} className="rounded bg-shell-700 py-2 text-sm">Copy tracklist</button>
                </div>
                {saveMsg && (
                  <p className="text-xs mt-2 text-shell-200">
                    {saveMsg.text} {saveMsg.url && <a href={saveMsg.url} target="_blank" rel="noreferrer" className="underline text-coral-300">Open playlist</a>}
                  </p>
                )}
              </>
            )}
          </section>
          <p className="text-[11px] text-shell-500 mt-3">Key &amp; BPM data from ReccoBeats · search, art and previews from Deezer.</p>
        </aside>
      </div>
    </div>
  );
}
