import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createBoard, listBoards } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { ERA_BY_ID } from '../lib/eras';
import { EraSelect } from '../components/Selects';
import { BoardCover } from '../components/BoardCover';

export default function Boards() {
  const [params] = useSearchParams();
  const eraFilter = params.get('era');
  const boards = useAsync(listBoards, []);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'mood' | 'reconstruction'>('mood');
  const [era, setEra] = useState(eraFilter || '');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  const list = (boards.data || []).filter((b) => !eraFilter || b.era_id === eraFilter);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const b = await createBoard({ title: title.trim(), kind, era_id: era || null, subject: subject.trim() || null });
      nav(`/boards/${b.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="hero compact">
        <h1 className="display">Boards</h1>
        <p className="muted">
          <b>Mood boards</b> collect the look and feel of an age or place. <b>Reconstruction boards</b> gather every view of one subject — a king, a statue, a temple — and show which angles are still missing.
        </p>
        <div className="row">
          <button onClick={() => setOpen(!open)}>{open ? 'Cancel' : '＋ New board'}</button>
          {eraFilter && <Link className="button ghost" to="/boards">Show all eras</Link>}
        </div>
      </section>

      {open && (
        <form className="card form-grid" onSubmit={create}>
          <label className="span-2">Name<input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ramesses II — the face" /></label>
          <label>Type
            <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="mood">Mood board</option>
              <option value="reconstruction">Reconstruction board</option>
            </select>
          </label>
          <label>Era<EraSelect value={era} onChange={setEra} /></label>
          {kind === 'reconstruction' && (
            <label className="span-2">Subject being reconstructed<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ramesses II" /></label>
          )}
          {err && <p className="error span-2">{err}</p>}
          <div className="row end span-2"><button disabled={busy || !title.trim()}>Create</button></div>
        </form>
      )}

      {boards.error && <p className="error">{boards.error}</p>}
      {boards.data && !list.length && <p className="empty">No boards yet{eraFilter ? ` for ${ERA_BY_ID[eraFilter]?.short}` : ''}.</p>}
      <div className="board-grid">
        {list.map((b) => (
          <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
            <BoardCover boardId={b.id} />
            <div className="meta">
              <div className="title">{b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}</div>
              <div className="sub">{b.era_id ? ERA_BY_ID[b.era_id]?.short : 'Any era'} · {b.count} item{b.count === 1 ? '' : 's'}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
