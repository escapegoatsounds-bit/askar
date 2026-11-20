import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiJson } from '../lib/supabase';
import { knownExternalIds } from '../lib/data';
import { ERA_BY_ID } from '../lib/eras';
import type { Draft, SearchResult } from '../lib/types';
import { SaveDialog } from '../components/SaveDialog';
import { ElsewhereSearch } from '../components/ElsewhereSearch';
import { LinkImporter } from '../components/LinkImporter';

interface SourceInfo { id: string; label: string; note: string; enabled: boolean }

// Starter searches per era — a nudge, not a limit.
const IDEAS: Record<string, string[]> = {
  predynastic: ['Naqada pottery', 'Gerzeh', 'Badarian', 'Narmer palette', 'predynastic figurine', 'Hierakonpolis'],
  'early-dynastic': ['Narmer', 'Abydos', 'Den', 'First Dynasty', 'Saqqara mastaba', 'Khasekhemwy'],
  'old-kingdom': ['Khufu', 'Khafre', 'Menkaure', 'Djoser', 'Giza pyramid', 'Meidum', 'Rahotep Nofret', 'Seated scribe'],
  fip: ['First Intermediate Period', 'Herakleopolis', 'Mentuhotep'],
  'middle-kingdom': ['Senusret III', 'Amenemhat', 'Middle Kingdom coffin', 'Beni Hasan', 'Lahun'],
  sip: ['Hyksos', 'Avaris', 'Seqenenre Tao', 'Kerma'],
  'new-kingdom': ['Hatshepsut', 'Akhenaten', 'Nefertiti', 'Tutankhamun', 'Ramesses II', 'Karnak', 'Valley of the Kings', 'Amarna'],
  tip: ['Tanis', 'Third Intermediate coffin', 'Kushite king', 'Taharqa', 'Psusennes'],
  'late-period': ['Saite', 'Late Period statue', 'Nectanebo', 'Persian Egypt'],
  ptolemaic: ['Cleopatra', 'Ptolemy', 'Alexandria', 'Dendera', 'Edfu', 'Philae', 'Rosetta Stone'],
  roman: ['Fayum portrait', 'Roman Egypt mummy', 'Antinoopolis', 'Kom Ombo'],
  'byzantine-coptic': ['Coptic textile', 'Coptic icon', 'Saint Catherine monastery', 'White Monastery'],
  'early-islamic': ['Ibn Tulun mosque', 'Fustat', 'Amr ibn al-As mosque', 'Nilometer'],
  fatimid: ['Fatimid', 'Al-Azhar', 'Bab Zuweila', 'Fatimid rock crystal'],
  'ayyubid-mamluk': ['Mamluk', 'Cairo citadel', 'Sultan Hassan mosque', 'Mamluk glass lamp'],
  ottoman: ['Description de l\'Egypte', 'Napoleon Egypt', 'Ottoman Cairo', 'David Roberts Egypt'],
  khedivate: ['Cairo 1890', 'Suez Canal opening', 'Bonfils', 'Francis Frith', 'Howard Carter', 'Khedive'],
  republic: ['Aswan High Dam', 'Abu Simbel relocation', 'Nasser', 'Cairo 1960s', 'Grand Egyptian Museum'],
};

const DEFAULT_SOURCES = ['met', 'commons', 'cleveland', 'openverse'];

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const eraParam = params.get('era');
  const era = eraParam ? ERA_BY_ID[eraParam] : null;
  const [q, setQ] = useState(params.get('q') || '');
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [picked, setPicked] = useState<string[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('askar.sources') || 'null');
      if (Array.isArray(s) && s.length) return s;
    } catch {}
    return DEFAULT_SOURCES;
  });
  const [egypt, setEgypt] = useState(true);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Map<string, SearchResult>>(new Map());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Draft[] | null>(null);
  const [zoom, setZoom] = useState<SearchResult | null>(null);

  useEffect(() => {
    apiJson<{ sources: SourceInfo[] }>('/api/search?list=1').then((r) => setSources(r.sources)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    try { localStorage.setItem('askar.sources', JSON.stringify(picked)); } catch {}
  }, [picked]);

  useEffect(() => {
    const initial = params.get('q');
    if (initial) run(initial, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(query: string, p: number) {
    const term = query.trim();
    if (!term || !picked.length) return;
    setLoading(true);
    setError(null);
    if (p === 0) {
      setResults([]);
      setSel(new Map());
    }
    const next = new URLSearchParams(params);
    next.set('q', term);
    setParams(next, { replace: true });
    try {
      const r = await apiJson<{ results: SearchResult[]; errors: Record<string, string> }>(
        `/api/search?q=${encodeURIComponent(term)}&sources=${picked.join(',')}&page=${p}&egypt=${egypt ? 1 : 0}`,
      );
      setResults((prev) => (p ? [...prev, ...r.results] : r.results));
      setErrors(r.errors);
      setPage(p);
      const known = await knownExternalIds(r.results.map((x) => x.externalId));
      setSaved((prev) => new Set([...prev, ...known]));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(r: SearchResult) {
    const n = new Map(sel);
    n.has(r.externalId) ? n.delete(r.externalId) : n.set(r.externalId, r);
    setSel(n);
  }

  function toDraft(r: SearchResult): Draft {
    return {
      key: r.externalId,
      kind: r.kind,
      title: r.title,
      previewUrl: r.thumbUrl,
      remoteUrl: r.mediaUrl,
      thumbUrl: r.thumbUrl,
      pageUrl: r.pageUrl,
      sourceName: sources.find((s) => s.id === r.source)?.label ?? r.source,
      externalId: r.externalId,
      license: r.license,
      credit: r.credit,
      dateText: r.dateText,
      yearStart: r.yearStart,
      yearEnd: r.yearEnd,
      description: r.description,
      eraGuess: r.eraGuess ?? eraParam,
      categoryGuess: r.categoryGuess,
      siteGuess: r.siteGuess,
    };
  }

  return (
    <div className="page">
      <section className="hero compact">
        <h1 className="display">Discover</h1>
        <p className="muted">Search open museum collections and archives. Licenses and sources are saved with every find.</p>
      </section>

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); run(q, 0); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nefertiti, Karnak, canopic jar, Cairo 1890…" autoFocus />
        <button disabled={loading || !q.trim()}>{loading && page === 0 ? 'Searching…' : 'Search'}</button>
      </form>

      {era && (
        <div className="ideas">
          <span className="muted small">Ideas for {era.short}:</span>
          {(IDEAS[era.id] || []).map((t) => (
            <button key={t} type="button" className="chip-btn" onClick={() => { setQ(t); run(t, 0); }}>{t}</button>
          ))}
        </div>
      )}

      <details className="sources">
        <summary>Sources: {picked.length ? sources.filter((s) => picked.includes(s.id)).map((s) => s.label).join(', ') || picked.join(', ') : 'none'}</summary>
        <div className="source-grid">
          {sources.map((s) => (
            <label key={s.id} className={`source ${s.enabled ? '' : 'disabled'}`}>
              <input
                type="checkbox"
                disabled={!s.enabled}
                checked={picked.includes(s.id)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))}
              />
              <span><b>{s.label}</b><small>{s.enabled ? s.note : `Not set up — ${s.note}`}</small></span>
            </label>
          ))}
        </div>
        <label className="inline">
          <input type="checkbox" checked={egypt} onChange={(e) => setEgypt(e.target.checked)} /> Keep results about Egypt (adds “Egypt” / museum Egyptian departments)
        </label>
      </details>

      <ElsewhereSearch query={q} egypt={egypt} />
      <details className="sources paste-link">
        <summary>📎 Paste a link from Pinterest, Google, Savee or any page</summary>
        <div style={{ marginTop: '0.8rem' }}><LinkImporter onPick={(d) => setDialog(d.map((x) => ({ ...x, eraGuess: x.eraGuess ?? eraParam })))} /></div>
      </details>

      {error && <p className="error">{error}</p>}
      {Object.keys(errors).length > 0 && (
        <p className="warn small">
          Some sources didn't answer: {Object.entries(errors).map(([k, v]) => `${sources.find((s) => s.id === k)?.label ?? k} (${v})`).join('; ')}
        </p>
      )}

      {sel.size > 0 && (
        <div className="selection-bar sticky">
          <span>{sel.size} selected</span>
          <button className="ghost small" onClick={() => setSel(new Map())}>Clear</button>
          <button onClick={() => setDialog([...sel.values()].map(toDraft))}>Save selected</button>
        </div>
      )}

      <div className="masonry">
        {results.map((r) => {
          const isSel = sel.has(r.externalId);
          const isSaved = saved.has(r.externalId);
          return (
            <div key={r.externalId} className={`item-card result ${isSel ? 'selected' : ''}`}>
              <button type="button" className="card-hit" onClick={() => (isSaved ? setZoom(r) : toggle(r))}>
                <div className="thumb">
                  {r.thumbUrl ? <img src={r.thumbUrl} alt={r.title} loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb-missing">No preview</div>}
                  <span className="badge src">{sources.find((s) => s.id === r.source)?.label ?? r.source}</span>
                  {isSaved ? <span className="badge saved">✓ In archive</span> : <span className={`check ${isSel ? 'on' : ''}`}>{isSel ? '✓' : ''}</span>}
                </div>
                <div className="meta">
                  <div className="title" title={r.title}>{r.title}</div>
                  <div className="sub">{r.eraGuess ? ERA_BY_ID[r.eraGuess]?.short : r.dateText || 'Date unknown'}</div>
                </div>
              </button>
              <div className="card-actions">
                <button className="ghost small" onClick={() => setZoom(r)}>Details</button>
                {!isSaved && <button className="small" onClick={() => setDialog([toDraft(r)])}>Save</button>}
              </div>
            </div>
          );
        })}
      </div>

      {results.length > 0 && (
        <div className="center">
          <button className="ghost" disabled={loading} onClick={() => run(q, page + 1)}>{loading ? 'Loading…' : 'More results'}</button>
        </div>
      )}
      {!loading && results.length === 0 && params.get('q') && !error && <p className="empty">No results. Try a broader word, or switch on more sources.</p>}

      {zoom && (
        <div className="modal-backdrop" onClick={() => setZoom(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>{zoom.title}</h2><button className="ghost small" onClick={() => setZoom(null)}>✕</button></div>
            <div className="zoom">
              {zoom.mediaUrl || zoom.thumbUrl ? <img src={(zoom.mediaUrl || zoom.thumbUrl)!} alt={zoom.title} referrerPolicy="no-referrer" /> : null}
              <dl className="facts">
                {zoom.dateText && <><dt>Date</dt><dd>{zoom.dateText}</dd></>}
                {zoom.eraGuess && <><dt>Era (guess)</dt><dd>{ERA_BY_ID[zoom.eraGuess]?.name}</dd></>}
                {zoom.description && <><dt>Details</dt><dd>{zoom.description}</dd></>}
                {zoom.credit && <><dt>Credit</dt><dd>{zoom.credit}</dd></>}
                <dt>License</dt><dd>{zoom.license || 'Unknown'}</dd>
                {zoom.pageUrl && <><dt>Source</dt><dd><a href={zoom.pageUrl} target="_blank" rel="noreferrer">Open original page ↗</a></dd></>}
              </dl>
            </div>
            <div className="modal-foot">
              {!saved.has(zoom.externalId) && <button onClick={() => { setDialog([toDraft(zoom)]); setZoom(null); }}>Save to archive</button>}
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <SaveDialog
          drafts={dialog}
          defaultEra={eraParam}
          onClose={() => setDialog(null)}
          onSaved={(items) => {
            setSaved((prev) => new Set([...prev, ...items.map((i) => i.external_id!).filter(Boolean)]));
            setSel(new Map());
          }}
        />
      )}
    </div>
  );
}
