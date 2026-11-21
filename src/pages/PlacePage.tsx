import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPlace, itemsAtSite, requestResearch } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { ERA_BY_ID } from '../lib/eras';
import { staticMapUrl } from '../lib/sites';
import type { Place } from '../lib/types';
import { ItemCard, ItemGrid } from '../components/ItemCard';

const CERTAINTY: Record<string, { label: string; cls: string; tip: string }> = {
  attested: { label: 'Attested', cls: 'ok', tip: 'Named in inscriptions or other direct evidence.' },
  likely: { label: 'Likely', cls: 'likely', tip: 'A reasonable scholarly reading of the evidence.' },
  legendary: { label: 'Legendary', cls: 'legend', tip: 'From later tradition (king lists, myth), not contemporary evidence.' },
  unknown: { label: 'Unknown', cls: 'unknown', tip: 'Nobody knows. Often the honest answer before ~3200 BCE.' },
};

const STATUS: Record<string, string> = {
  todo: 'Waiting for research',
  in_progress: 'Being researched',
  done: 'Researched',
  needs_review: 'Researched · please review',
};

/** Live Wikipedia summary (CORS-enabled REST API) as a quick read before/alongside our own research. */
function useWikipedia(title: string | null) {
  const [w, setW] = useState<{ extract: string; url: string; thumb: string | null } | null>(null);
  useEffect(() => {
    setW(null);
    if (!title) return;
    let alive = true;
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || d.type === 'disambiguation' || !d.extract) return;
        setW({ extract: d.extract, url: d.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, thumb: d.thumbnail?.source ?? null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [title]);
  return w;
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Src({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a className="src-link" href={url} target="_blank" rel="noreferrer" title={url}>
      [{host(url)}]
    </a>
  );
}

export default function PlacePage() {
  const { name } = useParams();
  const placeName = decodeURIComponent(name || '');
  const { role } = useAuth();
  const place = useAsync(() => getPlace(placeName), [placeName]);
  const p = place.data as Place | null;
  const items = useAsync(() => (p ? itemsAtSite([p.name, ...(p.aliases || [])], null, 60) : Promise.resolve([])), [p?.name]);
  const wiki = useWikipedia(p ? p.wikipedia_title || p.name : null);
  const [asked, setAsked] = useState(false);
  const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  if (place.error) return <div className="page"><p className="error">{place.error}</p></div>;
  if (place.loading && !p) return <div className="page"><p className="muted">Loading…</p></div>;
  if (!p) return <div className="page"><p className="empty">No place called “{placeName}”. <Link to="/places">All places →</Link></p></div>;

  const map = staticMapUrl([{ lat: p.lat, lng: p.lng }], { w: 520, h: 300, zoom: 7, dark });
  const researched = p.research_status === 'done' || p.research_status === 'needs_review';
  const team = role === 'owner' || role === 'editor';

  return (
    <div className="page place-page">
      <div className="crumbs"><Link to="/places">Places</Link> / <span>{p.name}</span></div>

      <div className="place-layout">
        <article className="place-main">
          <h1 className="display">{p.name}</h1>
          <p className="muted">
            {p.region}
            {p.aliases?.length ? ` · also known as ${p.aliases.join(', ')}` : ''}
          </p>
          <div className="chips">
            {p.eras.map((id) => (
              <Link key={id} className="chip era" to={`/era/${id}`} style={{ ['--hue' as any]: ERA_BY_ID[id]?.hue }}>{ERA_BY_ID[id]?.short ?? id}</Link>
            ))}
            <span className={`chip status ${p.research_status}`}>{STATUS[p.research_status]}</span>
          </div>

          {researched && p.summary ? (
            <section>
              <p className="lead pre">{p.summary}</p>
            </section>
          ) : (
            <section className="card soft">
              <p className="muted small" style={{ marginTop: 0 }}>
                {p.description}
              </p>
              {wiki ? (
                <>
                  <p>{wiki.extract}</p>
                  <p className="muted small">From Wikipedia (live, unedited) · <a href={wiki.url} target="_blank" rel="noreferrer">read the article ↗</a></p>
                </>
              ) : (
                <p className="muted small">No Wikipedia summary found yet.</p>
              )}
              <p className="muted small">The scheduled research hasn't reached this place yet. It runs every 12 hours, predynastic places first.</p>
            </section>
          )}

          {p.facts?.length > 0 && (
            <section>
              <h2>Interesting facts</h2>
              <ul className="facts-list">
                {p.facts.map((f, i) => <li key={i}>{f.text} <Src url={f.source_url} /></li>)}
              </ul>
            </section>
          )}

          {(p.rulers?.length > 0 || researched) && (
            <section>
              <h2>Rulers & power</h2>
              {p.rulers?.length ? (
                <div className="rulers">
                  {p.rulers.map((r, i) => {
                    const c = CERTAINTY[r.certainty || 'unknown'] ?? CERTAINTY.unknown;
                    return (
                      <div key={i} className="ruler card">
                        <div className="row between">
                          <b>{r.name}</b>
                          <span className={`cert ${c.cls}`} title={c.tip}>{c.label}</span>
                        </div>
                        <div className="muted small">{[r.title, r.period].filter(Boolean).join(' · ')}</div>
                        {r.note && <p className="small">{r.note} <Src url={r.source_url} /></p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">No ruler is known for this place.</p>
              )}
            </section>
          )}

          {(p.beliefs || p.deities?.length > 0) && (
            <section>
              <h2>Beliefs & deities</h2>
              {p.beliefs && <p className="pre">{p.beliefs}</p>}
              {p.deities?.length > 0 && (
                <div className="deities">
                  {p.deities.map((d, i) => (
                    <div key={i} className="deity">
                      <b>{d.name}</b>
                      {d.role && <span className="muted small"> · {d.role}</span>}
                      {d.note && <p className="small">{d.note} <Src url={d.source_url} /></p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <div className="section-head">
              <h2>Images</h2>
              <Link className="button small" to={`/discover?q=${encodeURIComponent(p.name)}`}>Find more images</Link>
            </div>
            {items.data && items.data.length === 0 && <p className="muted">No images saved for this place yet. Research runs add openly licensed photos from Wikimedia Commons; you can add your own from Discover or Add (set the site to “{p.name}”).</p>}
            <ItemGrid>{(items.data || []).map((it) => <ItemCard key={it.id} item={it} />)}</ItemGrid>
          </section>

          {p.sources?.length > 0 && (
            <section>
              <h2>Sources</h2>
              <ol className="sources-list">
                {p.sources.map((s, i) => (
                  <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title || host(s.url)}</a> <span className="muted small">{host(s.url)}</span></li>
                ))}
              </ol>
            </section>
          )}
        </article>

        <aside className="infobox card">
          {wiki?.thumb && <img className="infobox-img" src={wiki.thumb} alt={p.name} referrerPolicy="no-referrer" />}
          {map && (
            <Link to={`/map?site=${encodeURIComponent(p.name)}`}>
              <img className="infobox-map" src={map} alt={`Map of ${p.name}`} loading="lazy" />
            </Link>
          )}
          <dl className="facts">
            <dt>Region</dt><dd>{p.region || '—'}</dd>
            {p.culture && <><dt>Culture</dt><dd>{p.culture}</dd></>}
            {p.dates_text && <><dt>Dates</dt><dd>{p.dates_text}</dd></>}
            <dt>Coordinates</dt>
            <dd>
              {p.lat.toFixed(3)}°N, {p.lng.toFixed(3)}°E
              {!p.coords_verified && <span className="muted small"> (approximate, not yet verified)</span>}
            </dd>
            {p.rulers?.length > 0 && <><dt>Rulers</dt><dd>{p.rulers.map((r) => r.name).join(', ')}</dd></>}
            {p.deities?.length > 0 && <><dt>Deities</dt><dd>{p.deities.map((d) => d.name).join(', ')}</dd></>}
            {p.researched_at && <><dt>Researched</dt><dd>{new Date(p.researched_at).toLocaleDateString()}</dd></>}
          </dl>
          {p.research_notes && <p className="muted small">{p.research_notes}</p>}
          {team && (
            <button
              className="ghost small"
              disabled={asked}
              onClick={async () => {
                await requestResearch(p.id, researched);
                setAsked(true);
              }}
            >
              {asked ? '✓ Queued for the next run' : researched ? 'Research again' : 'Research this next'}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
