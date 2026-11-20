import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ERA_BY_ID, formatRange } from '../lib/eras';
import { listItems, listBoards, addToBoard } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';
import type { Item } from '../lib/types';
import { ItemCard, ItemGrid } from '../components/ItemCard';
import { CategorySelect, EraSelect } from '../components/Selects';

const PAGE = 60;

/** Era mood board (/era/:eraId) and the full library (/library). */
export default function Browse() {
  const { eraId } = useParams();
  const era = eraId && eraId !== 'none' ? ERA_BY_ID[eraId] : null;
  const [eraFilter, setEraFilter] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const q = useDebounced(text, 350);
  const [items, setItems] = useState<Item[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const boards = useAsync(listBoards, []);
  const [toast, setToast] = useState<string | null>(null);

  const effectiveEra = eraId ?? (eraFilter || null);

  async function load(offset: number) {
    setLoading(true);
    setError(null);
    try {
      const rows = await listItems({ eraId: effectiveEra, category: category || null, kind: kind || null, text: q, limit: PAGE, offset });
      setItems((prev) => (offset ? [...prev, ...rows] : rows));
      setMore(rows.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEra, category, kind, q]);

  function toggle(it: Item) {
    const n = new Set(sel);
    n.has(it.id) ? n.delete(it.id) : n.add(it.id);
    setSel(n);
  }

  async function pinTo(boardId: string) {
    if (!boardId || !sel.size) return;
    await addToBoard(boardId, [...sel]);
    const b = boards.data?.find((x) => x.id === boardId);
    setToast(`Added ${sel.size} to “${b?.title}”`);
    setSel(new Set());
    setSelecting(false);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="page">
      {era ? (
        <section className="era-hero" style={{ ['--hue' as any]: era.hue }}>
          <Link to="/" className="muted small">← Timeline</Link>
          <h1 className="display">{era.name}</h1>
          <p className="era-dates">{formatRange(era)}</p>
          <p>{era.blurb}</p>
          <div className="row">
            <Link className="button" to={`/discover?era=${era.id}`}>Find more for this era</Link>
            <Link className="button ghost" to={`/boards?era=${era.id}`}>Boards for this era</Link>
          </div>
        </section>
      ) : (
        <section className="hero compact">
          <h1 className="display">{eraId === 'none' ? 'Undated finds' : 'Library'}</h1>
        </section>
      )}

      <div className="filters">
        <input type="search" placeholder="Search titles, sites, notes…" value={text} onChange={(e) => setText(e.target.value)} />
        {!eraId && <EraSelect value={eraFilter} onChange={setEraFilter} autoLabel="All eras" />}
        <CategorySelect value={category} onChange={setCategory} allLabel="All categories" />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="document">Documents</option>
          <option value="model3d">3D models</option>
        </select>
        <button className={selecting ? '' : 'ghost'} onClick={() => { setSelecting(!selecting); setSel(new Set()); }}>
          {selecting ? 'Cancel' : 'Select'}
        </button>
      </div>

      {selecting && (
        <div className="selection-bar">
          <span>{sel.size} selected</span>
          <select value="" onChange={(e) => pinTo(e.target.value)} disabled={!sel.size}>
            <option value="">Add to board…</option>
            {boards.data?.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {error && <p className="error">{error}</p>}
      {!loading && !items.length && (
        <p className="empty">Nothing here yet. {era ? <Link to={`/discover?era=${era.id}`}>Search the museums for {era.short} finds →</Link> : <Link to="/discover">Start discovering →</Link>}</p>
      )}
      <ItemGrid>
        {items.map((it) => <ItemCard key={it.id} item={it} selected={sel.has(it.id)} onSelect={selecting ? toggle : undefined} />)}
      </ItemGrid>
      {more && <div className="center"><button className="ghost" disabled={loading} onClick={() => load(items.length)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
    </div>
  );
}
