import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addToBoard, allSubjects, boardsForItem, deleteItem, getItem, listBoards, removeFromBoard, updateItem } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useFull } from '../lib/media';
import { ERA_BY_ID } from '../lib/eras';
import { CATEGORY_BY_ID, ANGLE_BY_ID } from '../lib/taxonomy';
import type { Item } from '../lib/types';
import { ChipsInput } from '../components/ChipsInput';
import { findSite, staticMapUrl } from '../lib/sites';
import { PinButton } from '../components/PinButton';
import { canDownload, canShareFiles, downloadItem, shareItem } from '../lib/download';
import { CategorySelect, EraSelect } from '../components/Selects';

function embedFor(item: Item): string | null {
  const u = item.source_url || '';
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const sf = item.external_id?.startsWith('sketchfab:') ? item.external_id.slice(10) : null;
  if (sf) return `https://sketchfab.com/models/${sf}/embed`;
  const ia = item.kind === 'video' && item.external_id?.startsWith('archive:') ? item.external_id.slice(8) : null;
  if (ia) return `https://archive.org/embed/${ia}`;
  return null;
}

export default function ItemPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const item = useAsync(() => getItem(id!), [id]);
  const memberships = useAsync(() => boardsForItem(id!), [id]);
  const boards = useAsync(listBoards, []);
  const it = item.data;
  const full = useFull(it);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  if (item.error) return <div className="page"><p className="error">{item.error}</p><Link to="/library">← Library</Link></div>;
  if (!it) return <div className="page"><p className="muted">Loading…</p></div>;

  const era = it.era_id ? ERA_BY_ID[it.era_id] : null;
  const cat = it.category ? CATEGORY_BY_ID[it.category] : null;
  const embed = embedFor(it);
  const inBoards = new Map((memberships.data || []).map((m) => [m.board_id, m.angle]));

  return (
    <div className="page item-page">
      <button className="ghost small" onClick={() => nav(-1)}>← Back</button>
      <div className="item-layout">
        <div className="item-media">
          {embed ? (
            <div className="embed"><iframe src={embed} title={it.title} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen /></div>
          ) : it.kind === 'video' && full && /\.(mp4|webm|mov)$/i.test(it.storage_path || '') ? (
            // a video file stored on this PC (e.g. the episode renders): play it here
            <video src={full} controls loop playsInline style={{ width: '100%', borderRadius: 8 }} />
          ) : full ? (
            <img src={full} alt={it.title} className={zoomed ? 'zoomed' : ''} onClick={() => setZoomed(!zoomed)} referrerPolicy="no-referrer" />
          ) : (
            <div className="thumb-missing big">No preview stored</div>
          )}
          {!it.storage_path && it.media_url && (
            <p className="muted small">Stored as a link + thumbnail. <a href={it.media_url} target="_blank" rel="noreferrer">Open full-size original ↗</a></p>
          )}
        </div>

        <div className="item-info">
          {editing ? (
            <ItemEditor item={it} onDone={async (patch) => {
              if (patch) item.setData(await updateItem(it.id, patch));
              setEditing(false);
            }} />
          ) : (
            <>
              <h1 className="display">{it.title}</h1>
              <div className="chips">
                {era && <Link className="chip era" to={`/era/${era.id}`} style={{ ['--hue' as any]: era.hue }}>{era.short}</Link>}
                {cat && <span className="chip">{cat.icon} {cat.label}</span>}
                {it.site && <span className="chip">📍 {it.site}</span>}
                {it.subjects.map((s) => <span className="chip subject" key={s}>{s}</span>)}
                {it.tags.map((t) => <span className="chip tag" key={t}>#{t}</span>)}
              </div>
              <dl className="facts">
                {it.date_text && <><dt>Date</dt><dd>{it.date_text}</dd></>}
                {it.description && <><dt>Details</dt><dd>{it.description}</dd></>}
                {it.notes && <><dt>Notes</dt><dd className="pre">{it.notes}</dd></>}
                <dt>Source</dt>
                <dd>{it.source_name || '—'}{it.source_url && <> · <a href={it.source_url} target="_blank" rel="noreferrer">original page ↗</a></>}</dd>
                <dt>License</dt><dd>{it.license || 'Unknown'}</dd>
                {it.credit && <><dt>Credit</dt><dd>{it.credit}</dd></>}
                <dt>Added</dt><dd>{new Date(it.created_at).toLocaleDateString()}{it.created_by_email ? ` by ${it.created_by_email}` : ''}</dd>
              </dl>
              <div className="row">
                <PinButton itemIds={[it.id]} />
                {canDownload(it) && <SaveToDevice item={it} />}
              </div>
              <div className="row">
                <button className="ghost" onClick={() => setEditing(true)}>Edit details</button>
                <button
                  className="ghost danger"
                  onClick={async () => {
                    if (!confirm('Delete this item from the archive for everyone?')) return;
                    await deleteItem(it);
                    nav(-1);
                  }}
                >Delete</button>
              </div>
            </>
          )}

          <SiteMap place={it.site} />

          <section className="card">
            <h3>On boards</h3>
            {boards.data?.length ? (
              <ul className="board-toggles">
                {boards.data.map((b) => {
                  const on = inBoards.has(b.id);
                  return (
                    <li key={b.id}>
                      <label className="inline">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={async (e) => {
                            if (e.target.checked) await addToBoard(b.id, [it.id]);
                            else await removeFromBoard(b.id, it.id);
                            memberships.reload();
                          }}
                        />
                        {b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}
                        {on && inBoards.get(b.id) && <span className="muted small"> — {ANGLE_BY_ID[inBoards.get(b.id)!]}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">No boards yet. <Link to="/boards">Create one →</Link></p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ItemEditor({ item, onDone }: { item: Item; onDone: (patch: Partial<Item> | null) => void }) {
  const [title, setTitle] = useState(item.title);
  const [era, setEra] = useState(item.era_id || '');
  const [category, setCategory] = useState(item.category || '');
  const [site, setSite] = useState(item.site || '');
  const [subjects, setSubjects] = useState(item.subjects);
  const [tags, setTags] = useState(item.tags);
  const [dateText, setDateText] = useState(item.date_text || '');
  const [license, setLicense] = useState(item.license || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [sugg, setSugg] = useState<string[]>([]);
  useEffect(() => { allSubjects().then(setSugg).catch(() => {}); }, []);
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        onDone({ title, era_id: era || null, category: category || null, site: site || null, subjects, tags, date_text: dateText || null, license: license || null, notes: notes || null });
      }}
    >
      <label className="span-2">Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Era<EraSelect value={era} onChange={setEra} /></label>
      <label>Category<CategorySelect value={category} onChange={setCategory} /></label>
      <label>Site / place<input value={site} onChange={(e) => setSite(e.target.value)} /></label>
      <label>Date (as written)<input value={dateText} onChange={(e) => setDateText(e.target.value)} placeholder="ca. 1279–1213 BCE" /></label>
      <label className="span-2">Subjects<ChipsInput id="edit-subjects" value={subjects} onChange={setSubjects} suggestions={sugg} /></label>
      <label className="span-2">Tags<ChipsInput value={tags} onChange={setTags} /></label>
      <label className="span-2">License<input value={license} onChange={(e) => setLicense(e.target.value)} /></label>
      <label className="span-2">Notes<textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="row end span-2">
        <button type="button" className="ghost" onClick={() => onDone(null)}>Cancel</button>
        <button>Save</button>
      </div>
    </form>
  );
}

function SiteMap({ place }: { place: string | null }) {
  const site = findSite(place);
  if (!site) return null;
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const url = staticMapUrl([site], { w: 600, h: 260, zoom: 6.5, dark });
  if (!url) return null;
  return (
    <Link to={`/map?site=${encodeURIComponent(site.name)}`} className="mini-map card">
      <img src={url} alt={`Map showing ${site.name}`} loading="lazy" />
      <span>📍 {site.name} · {site.region} — open on the map →</span>
    </Link>
  );
}

function SaveToDevice({ item }: { item: Item }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <button className="ghost" disabled={!!busy} onClick={() => run('Downloading…', () => downloadItem(item))}>⬇ {busy === 'Downloading…' ? busy : 'Download'}</button>
      {canShareFiles() && (
        <button className="ghost" disabled={!!busy} onClick={() => run('Opening…', () => shareItem(item))}>📲 {busy === 'Opening…' ? busy : 'Save to phone / share'}</button>
      )}
      {err && <span className="error small">{err}</span>}
    </>
  );
}
