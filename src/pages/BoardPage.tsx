import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { boardItems, deleteBoard, getBoard, removeFromBoard, setAngle, updateBoard } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { ERA_BY_ID } from '../lib/eras';
import { ANGLES } from '../lib/taxonomy';
import { ItemCard, ItemGrid } from '../components/ItemCard';
import { EraSelect } from '../components/Selects';

export default function BoardPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const board = useAsync(() => getBoard(id!), [id]);
  const items = useAsync(() => boardItems(id!), [id]);
  const [editing, setEditing] = useState(false);
  const [angleFilter, setAngleFilter] = useState<string | null>(null);
  const b = board.data;

  const coverage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const bi of items.data || []) if (bi.angle) m[bi.angle] = (m[bi.angle] || 0) + 1;
    return m;
  }, [items.data]);

  if (board.error) return <div className="page"><p className="error">{board.error}</p></div>;
  if (!b) return <div className="page"><p className="muted">Loading…</p></div>;
  const era = b.era_id ? ERA_BY_ID[b.era_id] : null;
  const covered = ANGLES.filter((a) => coverage[a.id]).length;
  const shown = (items.data || []).filter((bi) => !angleFilter || bi.angle === angleFilter);

  return (
    <div className="page">
      <section className="hero compact" style={era ? ({ ['--hue' as any]: era.hue } as any) : undefined}>
        <Link to="/boards" className="muted small">← Boards</Link>
        {editing ? (
          <BoardEditor
            board={b}
            onDone={async (patch) => {
              if (patch) board.setData(await updateBoard(b.id, patch));
              setEditing(false);
            }}
          />
        ) : (
          <>
            <h1 className="display">{b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}</h1>
            <p className="muted">
              {b.kind === 'reconstruction' ? 'Reconstruction board' : 'Mood board'}
              {era ? ` · ${era.name}` : ''}
              {b.subject ? ` · Subject: ${b.subject}` : ''}
            </p>
            {b.description && <p>{b.description}</p>}
            <div className="row">
              <button className="ghost small" onClick={() => setEditing(true)}>Edit</button>
              <Link className="button ghost small" to={era ? `/discover?era=${era.id}${b.subject ? `&q=${encodeURIComponent(b.subject)}` : ''}` : `/discover${b.subject ? `?q=${encodeURIComponent(b.subject)}` : ''}`}>Find more</Link>
              <button
                className="ghost small danger"
                onClick={async () => {
                  if (!confirm(`Delete the board “${b.title}”? The images stay in the archive.`)) return;
                  await deleteBoard(b.id);
                  nav('/boards');
                }}
              >Delete board</button>
            </div>
          </>
        )}
      </section>

      {b.kind === 'reconstruction' && (
        <section className="coverage card">
          <div className="section-head">
            <h2>Angle coverage</h2>
            <span className="muted">{covered} / {ANGLES.length} views</span>
          </div>
          <div className="meter"><div style={{ width: `${(covered / ANGLES.length) * 100}%` }} /></div>
          <div className="angle-chips">
            <button className={`chip-btn ${angleFilter === null ? 'on' : ''}`} onClick={() => setAngleFilter(null)}>All</button>
            {ANGLES.map((a) => (
              <button key={a.id} className={`chip-btn ${coverage[a.id] ? 'have' : 'missing'} ${angleFilter === a.id ? 'on' : ''}`} onClick={() => setAngleFilter(angleFilter === a.id ? null : a.id)}>
                {coverage[a.id] ? '✓' : '○'} {a.label}{coverage[a.id] ? ` (${coverage[a.id]})` : ''}
              </button>
            ))}
          </div>
          <p className="muted small">Set each image's view with the dropdown under it. For photogrammetry or a face reconstruction you want every ○ turned into ✓, ideally from photos with a known scale.</p>
        </section>
      )}

      {items.error && <p className="error">{items.error}</p>}
      {items.data && !items.data.length && (
        <p className="empty">This board is empty. Save finds into it from <Link to="/discover">Discover</Link>, <Link to="/add">Add</Link>, or select items in the <Link to="/library">Library</Link>.</p>
      )}
      <ItemGrid>
        {shown.map((bi) => (
          <ItemCard
            key={bi.item_id}
            item={bi.items}
            angle={b.kind === 'reconstruction' ? bi.angle : null}
            actions={
              <>
                {b.kind === 'reconstruction' && (
                  <select
                    className="small"
                    value={bi.angle || ''}
                    onChange={async (e) => {
                      await setAngle(b.id, bi.item_id, e.target.value || null);
                      items.reload();
                    }}
                  >
                    <option value="">View…</option>
                    {ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                )}
                <button className="ghost small" title="Remove from board" onClick={async () => { await removeFromBoard(b.id, bi.item_id); items.reload(); }}>Remove</button>
              </>
            }
          />
        ))}
      </ItemGrid>
    </div>
  );
}

function BoardEditor({ board, onDone }: { board: any; onDone: (patch: any | null) => void }) {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description || '');
  const [era, setEra] = useState(board.era_id || '');
  const [kind, setKind] = useState(board.kind);
  const [subject, setSubject] = useState(board.subject || '');
  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onDone({ title, description: description || null, era_id: era || null, kind, subject: subject || null }); }}>
      <label className="span-2">Name<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <label>Type
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="mood">Mood board</option>
          <option value="reconstruction">Reconstruction board</option>
        </select>
      </label>
      <label>Era<EraSelect value={era} onChange={setEra} /></label>
      <label className="span-2">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="span-2">Description<textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="row end span-2">
        <button type="button" className="ghost" onClick={() => onDone(null)}>Cancel</button>
        <button>Save</button>
      </div>
    </form>
  );
}
