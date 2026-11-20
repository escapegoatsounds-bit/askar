import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  boardItems,
  deleteBoard,
  getBoard,
  getProject,
  listFolders,
  removeFromBoard,
  reorderBoard,
  setAngle,
  setPinNote,
  subscribe,
  updateBoard,
} from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { ERA_BY_ID } from '../lib/eras';
import { ANGLES } from '../lib/taxonomy';
import { downloadZip } from '../lib/download';
import type { BoardItem } from '../lib/types';
import { ItemCard } from '../components/ItemCard';
import { EraSelect } from '../components/Selects';
import { DropZone } from '../components/DropZone';
import { myProjectRole } from '../lib/data';

export default function BoardPage() {
  const { id } = useParams();
  const bid = id!;
  const nav = useNavigate();
  const { role: teamRole } = useAuth();
  const board = useAsync(() => getBoard(bid), [bid]);
  const pins = useAsync(() => boardItems(bid), [bid]);
  const b = board.data;
  const project = useAsync(() => (b?.project_id ? getProject(b.project_id) : Promise.resolve(null)), [b?.project_id]);
  const folders = useAsync(() => (b?.project_id ? listFolders(b.project_id) : Promise.resolve([])), [b?.project_id]);
  const projectRole = useAsync(() => (b?.project_id ? myProjectRole(b.project_id) : Promise.resolve(null)), [b?.project_id]);
  const [editing, setEditing] = useState(false);
  const [angleFilter, setAngleFilter] = useState<string | null>(null);
  const [order, setOrder] = useState<BoardItem[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [zip, setZip] = useState<string | null>(null);

  const canEdit = teamRole === 'owner' || teamRole === 'editor' || projectRole.data === 'owner' || projectRole.data === 'editor';

  useEffect(() => setOrder(pins.data || []), [pins.data]);

  // Live: pins added/removed/reordered by collaborators show up instantly.
  useEffect(
    () => subscribe(`board-${bid}`, [{ table: 'board_items', filter: `board_id=eq.${bid}` }], () => pins.reload()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bid],
  );

  const coverage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const bi of order) if (bi.angle) m[bi.angle] = (m[bi.angle] || 0) + 1;
    return m;
  }, [order]);

  if (board.error) return <div className="page"><p className="error">{board.error}</p></div>;
  if (!b) return <div className="page"><p className="muted">Loading…</p></div>;
  const era = b.era_id ? ERA_BY_ID[b.era_id] : null;
  const folder = folders.data?.find((f) => f.id === b.folder_id);
  const covered = ANGLES.filter((a) => coverage[a.id]).length;
  const shown = order.filter((bi) => !angleFilter || bi.angle === angleFilter);

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.findIndex((x) => x.item_id === dragId);
    const to = next.findIndex((x) => x.item_id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);
    reorderBoard(bid, next.map((x) => x.item_id)).catch(() => pins.reload());
  }

  return (
    <div className="page">
      <div className="crumbs">
        {project.data ? (
          <>
            <Link to={`/projects/${project.data.id}`}>{project.data.emoji ?? '📁'} {project.data.name}</Link>
            {folder && <> / <Link to={`/projects/${project.data.id}?folder=${folder.id}`}>{folder.name}</Link></>}
            {' / '}
          </>
        ) : (
          <><Link to="/boards">Team boards</Link> / </>
        )}
        <span>{b.title}</span>
      </div>

      <section className="hero compact board-head" style={era ? ({ ['--hue' as any]: era.hue } as any) : undefined}>
        {editing ? (
          <BoardEditor board={b} onDone={async (patch) => { if (patch) board.setData(await updateBoard(b.id, patch)); setEditing(false); }} />
        ) : (
          <>
            <h1 className="display">{b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}</h1>
            <p className="muted">
              {order.length} pin{order.length === 1 ? '' : 's'}
              {b.kind === 'reconstruction' ? ' · Reconstruction board' : ''}
              {era ? ` · ${era.name}` : ''}
              {b.subject ? ` · ${b.subject}` : ''}
            </p>
            {b.description && <p>{b.description}</p>}
            <div className="row">
              <Link className="button small" to={`/discover?board=${b.id}${b.subject ? `&q=${encodeURIComponent(b.subject)}` : ''}`}>＋ Find pins</Link>
              <button
                className="ghost small"
                disabled={!order.length || !!zip}
                onClick={async () => {
                  setZip('Preparing…');
                  const { failed } = await downloadZip(order.map((o) => o.items), b.title, (d, t) => setZip(`Downloading ${d}/${t}…`));
                  setZip(failed ? `Done · ${failed} couldn't be downloaded` : null);
                  if (failed) setTimeout(() => setZip(null), 4000);
                }}
              >
                ⬇ {zip ?? 'Download all (.zip)'}
              </button>
              {canEdit && <button className="ghost small" onClick={() => setEditing(true)}>Edit</button>}
              {canEdit && (
                <button className="ghost small danger" onClick={async () => {
                  if (!confirm(`Delete the board “${b.title}”? The images stay in the library.`)) return;
                  await deleteBoard(b.id);
                  nav(project.data ? `/projects/${project.data.id}` : '/boards');
                }}>Delete</button>
              )}
            </div>
          </>
        )}
      </section>

      {canEdit && <DropZone boardId={b.id} label={`Drop images onto “${b.title}”`} onSaved={pins.reload} />}

      {b.kind === 'reconstruction' && (
        <section className="coverage card">
          <div className="section-head"><h2>Angle coverage</h2><span className="muted">{covered} / {ANGLES.length} views</span></div>
          <div className="meter"><div style={{ width: `${(covered / ANGLES.length) * 100}%` }} /></div>
          <div className="angle-chips">
            <button className={`chip-btn ${angleFilter === null ? 'on' : ''}`} onClick={() => setAngleFilter(null)}>All</button>
            {ANGLES.map((a) => (
              <button key={a.id} className={`chip-btn ${coverage[a.id] ? 'have' : 'missing'} ${angleFilter === a.id ? 'on' : ''}`} onClick={() => setAngleFilter(angleFilter === a.id ? null : a.id)}>
                {coverage[a.id] ? '✓' : '○'} {a.label}{coverage[a.id] ? ` (${coverage[a.id]})` : ''}
              </button>
            ))}
          </div>
        </section>
      )}

      {pins.error && <p className="error">{pins.error}</p>}
      {pins.data && !order.length && <p className="empty">Empty board. Drop images above, paste with Ctrl/⌘+V, or <Link to={`/discover?board=${b.id}`}>find pins</Link>.</p>}
      {canEdit && order.length > 1 && <p className="muted small">Tip: drag pins to rearrange them.</p>}

      <div className="masonry board-masonry">
        {shown.map((bi) => (
          <div
            key={bi.item_id}
            className={`pin-slot ${dragId === bi.item_id ? 'dragging' : ''}`}
            draggable={canEdit}
            onDragStart={(e) => {
              setDragId(bi.item_id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/askar-pin', bi.item_id);
            }}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.stopPropagation();
              onDrop(bi.item_id);
            }}
            onDragEnd={() => setDragId(null)}
          >
            <ItemCard
              item={bi.items}
              angle={b.kind === 'reconstruction' ? bi.angle : null}
              note={bi.note}
              by={bi.added_by_email}
              actions={
                canEdit ? (
                  <>
                    {b.kind === 'reconstruction' && (
                      <select className="small" value={bi.angle || ''} onChange={async (e) => { await setAngle(b.id, bi.item_id, e.target.value || null); pins.reload(); }}>
                        <option value="">View…</option>
                        {ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    )}
                    <button className="ghost small" onClick={() => setNoteFor(bi.item_id)}>{bi.note ? 'Edit note' : 'Note'}</button>
                    <button className="ghost small" title="Remove from board" onClick={async () => { await removeFromBoard(b.id, bi.item_id); pins.reload(); }}>Remove</button>
                  </>
                ) : undefined
              }
            />
          </div>
        ))}
      </div>

      {noteFor && (
        <NoteDialog
          initial={order.find((o) => o.item_id === noteFor)?.note ?? ''}
          onClose={() => setNoteFor(null)}
          onSave={async (text) => {
            await setPinNote(b.id, noteFor, text || null);
            setNoteFor(null);
            pins.reload();
          }}
        />
      )}
    </div>
  );
}

function NoteDialog({ initial, onSave, onClose }: { initial: string; onSave: (t: string) => void; onClose: () => void }) {
  const [t, setT] = useState(initial);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Note on this pin</h2><button className="ghost small" onClick={onClose}>✕</button></div>
        <textarea autoFocus rows={4} value={t} onChange={(e) => setT(e.target.value)} placeholder="Why it's here: the light, the palette, the pose…" />
        <div className="modal-foot"><button className="ghost" onClick={onClose}>Cancel</button><button onClick={() => onSave(t.trim())}>Save note</button></div>
      </div>
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
          <option value="mood">Moodboard</option>
          <option value="reconstruction">Reconstruction board</option>
        </select>
      </label>
      <label>Era (optional)<EraSelect value={era} onChange={setEra} /></label>
      <label className="span-2">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ramesses II, neon noir, brutalist interiors…" /></label>
      <label className="span-2">Description<textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="row end span-2">
        <button type="button" className="ghost" onClick={() => onDone(null)}>Cancel</button>
        <button>Save</button>
      </div>
    </form>
  );
}
