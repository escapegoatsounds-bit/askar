import { useEffect, useState } from 'react';
import { apiJson } from '../lib/supabase';
import type { Draft } from '../lib/types';
import { guessCategory } from '../lib/taxonomy';

interface ImportResult {
  kind: 'page' | 'image' | 'video';
  pageUrl: string;
  title: string | null;
  siteName: string;
  images: { url: string; alt: string; video?: string }[];
}

/** Paste a page / image / YouTube link, pick which images to keep. */
export function LinkImporter({ initialUrl, onPick }: { initialUrl?: string; onPick: (drafts: Draft[]) => void }) {
  const [url, setUrl] = useState(initialUrl || '');
  const [res, setRes] = useState<ImportResult | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  async function go(u = url) {
    if (!u.trim()) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    setSel(new Set());
    setBroken(new Set());
    try {
      const r = await apiJson<ImportResult>('/api/import-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u.trim() }),
      });
      setRes(r);
      if (r.images.length === 1) setSel(new Set([r.images[0].url]));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialUrl) go(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  function pick() {
    if (!res) return;
    const drafts: Draft[] = res.images
      .filter((i) => sel.has(i.url))
      .map((i, n) => {
        const title = (res.title || i.alt || res.siteName || 'Untitled') + (sel.size > 1 && !i.alt ? ` (${n + 1})` : '');
        return {
          key: i.url,
          kind: i.video ? 'video' : 'image',
          title: i.alt && i.alt.length > 3 && i.alt !== 'Main image' ? i.alt : title,
          previewUrl: i.url,
          remoteUrl: i.url,
          thumbUrl: i.url,
          pageUrl: i.video || res.pageUrl,
          sourceName: res.siteName,
          externalId: i.video ? `video:${i.video}` : null,
          license: 'Unknown — check source before reuse',
          categoryGuess: i.video ? 'video' : guessCategory(`${res.title ?? ''} ${i.alt}`),
        };
      });
    onPick(drafts);
  }

  const visible = res?.images.filter((i) => !broken.has(i.url)) ?? [];

  return (
    <div className="stack">
      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… a page, an image, or a YouTube link" />
        <button disabled={busy || !url.trim()}>{busy ? 'Reading…' : 'Fetch'}</button>
      </form>
      {err && <p className="error">{err}</p>}
      {res && (
        <>
          <p className="muted small">
            {res.title ? <b>{res.title}</b> : res.siteName} — {visible.length} image{visible.length === 1 ? '' : 's'} found. Tap to choose.
            {visible.length > 1 && (
              <> <button type="button" className="link" onClick={() => setSel(new Set(visible.map((i) => i.url)))}>Select all</button></>
            )}
          </p>
          <div className="pick-grid">
            {visible.map((i) => (
              <button type="button" key={i.url} className={`pick ${sel.has(i.url) ? 'on' : ''}`} onClick={() => {
                const n = new Set(sel);
                n.has(i.url) ? n.delete(i.url) : n.add(i.url);
                setSel(n);
              }}>
                <img src={i.url} alt={i.alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken((b) => new Set(b).add(i.url))} />
                {i.video && <span className="badge kind">▶ Video</span>}
                <span className={`check ${sel.has(i.url) ? 'on' : ''}`}>{sel.has(i.url) ? '✓' : ''}</span>
              </button>
            ))}
          </div>
          <div className="row end"><button disabled={!sel.size} onClick={pick}>Continue with {sel.size || ''} selected</button></div>
        </>
      )}
    </div>
  );
}
