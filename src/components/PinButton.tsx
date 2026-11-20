import { useEffect, useMemo, useRef, useState } from 'react';
import { addToBoard, createBoard, listBoards, listProjects } from '../lib/data';
import type { BoardWithMeta, Project } from '../lib/types';

let lastBoard: string | null = null;
try {
  lastBoard = localStorage.getItem('askar.lastBoard');
} catch {}

/**
 * Pinterest-style "Save" button: pick a board (grouped by project), or
 * create one on the spot. Remembers the last board for one-tap saving.
 */
export function PinButton({ itemIds, compact, onSaved }: { itemIds: string[]; compact?: boolean; onSaved?: (boardTitle: string) => void }) {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardWithMeta[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState('');
  const [newName, setNewName] = useState('');
  const [newProject, setNewProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    listBoards().then(setBoards).catch((e) => setErr(e.message));
    listProjects().then(setProjects).catch(() => {});
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = (boards || []).filter((b) => !f || b.title.toLowerCase().includes(f));
    const byProject = new Map<string, BoardWithMeta[]>();
    for (const b of list) {
      const key = b.project_id ?? '';
      byProject.set(key, [...(byProject.get(key) || []), b]);
    }
    return [...byProject.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0));
  }, [boards, filter]);

  const projectName = (id: string) => (id ? projects.find((p) => p.id === id)?.name ?? 'Project' : 'Team boards');

  async function save(boardId: string, title: string) {
    setBusy(true);
    setErr(null);
    try {
      await addToBoard(boardId, itemIds);
      lastBoard = boardId;
      try {
        localStorage.setItem('askar.lastBoard', boardId);
      } catch {}
      setDone(title);
      onSaved?.(title);
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 900);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createAndSave() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const b = await createBoard({ title: newName.trim(), kind: 'mood', project_id: newProject || null } as any);
      setNewName('');
      await save(b.id, b.title);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const last = boards?.find((b) => b.id === lastBoard);

  return (
    <div className="pin-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`pin-btn ${compact ? 'compact' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Float the picker above the page so card edges can't clip it.
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const w = Math.min(300, window.innerWidth * 0.86);
          const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
          const top = r.bottom + 6 + 420 > window.innerHeight ? Math.max(8, r.top - 426) : r.bottom + 6;
          setPos({ top, left });
          setOpen(!open);
        }}
        aria-label="Save to a board"
      >
        📌 {compact ? '' : 'Save'}
      </button>
      {open && (
        <div className="pin-pop" role="dialog" style={pos ? { position: 'fixed', top: pos.top, left: pos.left, right: 'auto' } : undefined}>
          {done ? (
            <p className="pin-done">✓ Saved to <b>{done}</b></p>
          ) : (
            <>
              <input autoFocus placeholder="Search boards…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              {last && !filter && (
                <button className="pin-row quick" disabled={busy} onClick={() => save(last.id, last.title)}>
                  ↺ <b>{last.title}</b>
                  <small>last used</small>
                </button>
              )}
              <div className="pin-list">
                {boards === null && <p className="muted small">Loading…</p>}
                {boards && !boards.length && <p className="muted small">No boards yet. Make the first one below.</p>}
                {groups.map(([pid, list]) => (
                  <div key={pid || 'team'}>
                    <div className="pin-group">{projectName(pid)}</div>
                    {list.map((b) => (
                      <button key={b.id} className="pin-row" disabled={busy} onClick={() => save(b.id, b.title)}>
                        {b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}
                        <small>{b.count}</small>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pin-new">
                <input placeholder="New board name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAndSave()} />
                {projects.length > 0 && (
                  <select value={newProject} onChange={(e) => setNewProject(e.target.value)} aria-label="Project">
                    <option value="">Team board (no project)</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.emoji ?? '📁'} {p.name}</option>)}
                  </select>
                )}
                <button disabled={busy || !newName.trim()} onClick={createAndSave}>Create & save</button>
              </div>
              {err && <p className="error small">{err}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
