import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createBoard,
  createFolder,
  deleteFolder,
  deleteProject,
  getProject,
  inviteToProject,
  listBoards,
  listFolders,
  listProjectMembers,
  moveBoard,
  myProjectRole,
  removeFromProject,
  renameFolder,
  setProjectRole,
  subscribe,
  updateProject,
} from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { BoardWithMeta, Folder } from '../lib/types';
import { BoardCover } from '../components/BoardCover';
import { DropZone } from '../components/DropZone';
import { backfillProject, deskStatus, forgetDeskCache } from '../lib/desk';

type Role = 'owner' | 'editor' | 'viewer';

export default function ProjectPage() {
  const { id } = useParams();
  const pid = id!;
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folder');
  const nav = useNavigate();
  const { email } = useAuth();

  const project = useAsync(() => getProject(pid), [pid]);
  const role = useAsync(() => myProjectRole(pid), [pid]);
  const folders = useAsync(() => listFolders(pid), [pid]);
  const boards = useAsync(() => listBoards({ projectId: pid }), [pid]);
  const members = useAsync(() => listProjectMembers(pid), [pid]);
  const [panel, setPanel] = useState<'none' | 'people' | 'settings'>('none');
  const [newBoard, setNewBoard] = useState('');
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [moving, setMoving] = useState<BoardWithMeta | null>(null);

  const canEdit = role.data === 'owner' || role.data === 'editor';
  const isOwner = role.data === 'owner';

  // Live: someone else adds a board or folder → refresh.
  useEffect(
    () =>
      subscribe(`project-${pid}`, [{ table: 'boards', filter: `project_id=eq.${pid}` }, { table: 'folders', filter: `project_id=eq.${pid}` }], () => {
        boards.reload();
        folders.reload();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid],
  );

  const tree = useMemo(() => buildTree(folders.data || []), [folders.data]);
  const current = folders.data?.find((f) => f.id === folderId) ?? null;
  const crumbs = useMemo(() => {
    const out: Folder[] = [];
    let f = current;
    while (f) {
      out.unshift(f);
      f = folders.data?.find((x) => x.id === f!.parent_id) ?? null;
    }
    return out;
  }, [current, folders.data]);
  const subfolders = (folders.data || []).filter((f) => f.parent_id === (folderId ?? null));
  const shown = (boards.data || []).filter((b) => (b.folder_id ?? null) === (folderId ?? null));

  function openFolder(fid: string | null) {
    const next = new URLSearchParams(params);
    fid ? next.set('folder', fid) : next.delete('folder');
    setParams(next);
  }

  async function addBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoard.trim()) return;
    const b = await createBoard({ title: newBoard.trim(), kind: 'mood', project_id: pid, folder_id: folderId } as any);
    setNewBoard('');
    nav(`/boards/${b.id}`);
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolder?.trim()) return;
    await createFolder(pid, newFolder.trim(), folderId);
    setNewFolder(null);
    folders.reload();
  }

  if (project.error) return <div className="page"><p className="error">{project.error}</p><Link to="/">← Projects</Link></div>;
  const p = project.data;

  return (
    <div className="project-layout">
      <aside className="folder-tree">
        <Link to="/" className="muted small">← All projects</Link>
        <button className={`tree-row root ${!folderId ? 'on' : ''}`} onClick={() => openFolder(null)}>
          <span>{p?.emoji ?? '📁'}</span> <b>{p?.name ?? '…'}</b>
        </button>
        <TreeLevel nodes={tree} depth={1} active={folderId} onOpen={openFolder} />
        {canEdit && (
          <button className="tree-row add" onClick={() => setNewFolder('')}>＋ New folder{current ? ` in ${current.name}` : ''}</button>
        )}
      </aside>

      <div className="page project-main">
        <div className="crumbs">
          <button className="link" onClick={() => openFolder(null)}>{p?.emoji} {p?.name}</button>
          {crumbs.map((c) => (
            <span key={c.id}> / <button className="link" onClick={() => openFolder(c.id)}>{c.name}</button></span>
          ))}
        </div>

        <section className="hero compact project-head">
          <div>
            <h1 className="display">{current ? `📂 ${current.name}` : `${p?.emoji ?? '📁'} ${p?.name ?? ''}`}</h1>
            {!current && p?.description && <p className="muted">{p.description}</p>}
          </div>
          <div className="row">
            {/* Local-first: sharing/invites removed (the People panel is no longer reachable). */}
            {isOwner && <button className="ghost" onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}>⚙</button>}
          </div>
        </section>

        {p?.desk_sync && <DeskPanel pid={pid} canEdit={canEdit} />}

        {panel === 'people' && <People pid={pid} isOwner={isOwner} me={email} members={members.data || []} reload={members.reload} />}
        {panel === 'settings' && p && (
          <Settings
            name={p.name}
            emoji={p.emoji ?? '📁'}
            description={p.description ?? ''}
            deskSync={!!p.desk_sync}
            onSave={async (patch) => {
              forgetDeskCache();
              project.setData(await updateProject(pid, patch));
              setPanel('none');
            }}
            onDelete={async () => {
              await deleteProject(pid);
              nav('/');
            }}
          />
        )}

        {current && canEdit && (
          <div className="row">
            <button className="ghost small" onClick={async () => {
              const name = prompt('Rename folder', current.name);
              if (name?.trim()) { await renameFolder(current.id, name.trim()); folders.reload(); }
            }}>Rename folder</button>
            <button className="ghost small danger" onClick={async () => {
              if (!confirm(`Delete folder “${current.name}”? Boards inside move up to the project; nothing is lost.`)) return;
              await deleteFolder(current.id);
              openFolder(current.parent_id);
              folders.reload();
              boards.reload();
            }}>Delete folder</button>
          </div>
        )}

        {canEdit && (
          <DropZone
            label={`Drop images into ${current ? `“${current.name}”` : 'this project'} (they go to an “Unsorted” board)`}
            ensureBoard={async () => {
              const existing = (boards.data || []).find((x) => x.title === 'Unsorted' && (x.folder_id ?? null) === (folderId ?? null));
              if (existing) return existing.id;
              const nb = await createBoard({ title: 'Unsorted', kind: 'mood', project_id: pid, folder_id: folderId } as any);
              return nb.id;
            }}
            onSaved={boards.reload}
          />
        )}

        {newFolder !== null && (
          <form className="row card" onSubmit={addFolder}>
            <input autoFocus placeholder="Folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} style={{ flex: 1 }} />
            <button>Create folder</button>
            <button type="button" className="ghost" onClick={() => setNewFolder(null)}>Cancel</button>
          </form>
        )}

        {subfolders.length > 0 && (
          <div className="folder-grid">
            {subfolders.map((f) => (
              <button key={f.id} className="folder-card" onClick={() => openFolder(f.id)}>
                <span className="folder-icon">📂</span>
                <b>{f.name}</b>
                <small>{(boards.data || []).filter((b) => b.folder_id === f.id).length} boards</small>
              </button>
            ))}
          </div>
        )}

        <div className="board-grid">
          {canEdit && (
            <form className="board-card new-board" onSubmit={addBoard}>
              <div className="cover new-cover">＋</div>
              <div className="meta">
                <input placeholder="New board name…" value={newBoard} onChange={(e) => setNewBoard(e.target.value)} />
                <button className="small" disabled={!newBoard.trim()}>Create board</button>
              </div>
            </form>
          )}
          {shown.map((b) => (
            <div key={b.id} className="board-card-wrap">
              <Link to={`/boards/${b.id}`} className="board-card">
                <BoardCover boardId={b.id} />
                <div className="meta">
                  <div className="title">{b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}</div>
                  <div className="sub">{b.count} pin{b.count === 1 ? '' : 's'}</div>
                </div>
              </Link>
              {canEdit && <button className="ghost small move-btn" onClick={() => setMoving(b)}>Move</button>}
            </div>
          ))}
        </div>
        {boards.data && !shown.length && !subfolders.length && !canEdit && <p className="empty">This folder is empty.</p>}

        {moving && (
          <div className="modal-backdrop" onClick={() => setMoving(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head"><h2>Move “{moving.title}”</h2><button className="ghost small" onClick={() => setMoving(null)}>✕</button></div>
              <div className="move-list">
                <button className="tree-row" onClick={async () => { await moveBoard(moving.id, pid, null); setMoving(null); boards.reload(); }}>
                  {p?.emoji} Project root
                </button>
                {(folders.data || []).map((f) => (
                  <button key={f.id} className="tree-row" style={{ paddingLeft: `${1 + depthOf(f, folders.data || []) * 1.1}rem` }}
                    onClick={async () => { await moveBoard(moving.id, pid, f.id); setMoving(null); boards.reload(); }}>
                    📂 {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface Node extends Folder { children: Node[] }
function buildTree(list: Folder[]): Node[] {
  const map = new Map<string, Node>(list.map((f) => [f.id, { ...f, children: [] }]));
  const roots: Node[] = [];
  for (const n of map.values()) (n.parent_id && map.get(n.parent_id) ? map.get(n.parent_id)!.children : roots).push(n);
  return roots;
}
function depthOf(f: Folder, all: Folder[]): number {
  let d = 0;
  let cur: Folder | undefined = f;
  while (cur?.parent_id && d < 20) {
    cur = all.find((x) => x.id === cur!.parent_id);
    d++;
  }
  return d;
}

function TreeLevel({ nodes, depth, active, onOpen }: { nodes: Node[]; depth: number; active: string | null; onOpen: (id: string) => void }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id}>
          <button className={`tree-row ${active === n.id ? 'on' : ''}`} style={{ paddingLeft: `${0.6 + depth * 0.9}rem` }} onClick={() => onOpen(n.id)}>
            📂 {n.name}
          </button>
          {n.children.length > 0 && <TreeLevel nodes={n.children} depth={depth + 1} active={active} onOpen={onOpen} />}
        </div>
      ))}
    </>
  );
}

function People({ pid, isOwner, me, members, reload }: { pid: string; isOwner: boolean; me: string | null; members: { email: string; role: Role }[]; reload: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="card people">
      <h3>People on this project</h3>
      <ul className="people-list">
        {members.map((m) => (
          <li key={m.email} className="row between">
            <span><span className="avatar">{m.email[0].toUpperCase()}</span> {m.email}{m.email === me ? ' (you)' : ''}</span>
            {isOwner && m.email !== me ? (
              <span className="row">
                <select className="small" value={m.role} onChange={async (e) => { await setProjectRole(pid, m.email, e.target.value as Role); reload(); }}>
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button className="ghost small danger" onClick={async () => { await removeFromProject(pid, m.email); reload(); }}>Remove</button>
              </span>
            ) : (
              <span className="muted small">{m.role}</span>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form className="row" onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await inviteToProject(pid, email, role);
            setMsg(`Invited ${email.trim().toLowerCase()}. Send them ${location.origin} — they sign in with that email and see only this project.`);
            setEmail('');
            reload();
          } catch (e) {
            setErr((e as Error).message.includes('duplicate') ? 'Already on this project.' : (e as Error).message);
          }
        }}>
          <input type="email" required placeholder="collaborator@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ flex: 1, minWidth: 120 }}>
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
            <option value="owner">Owner</option>
          </select>
          <button>Invite</button>
        </form>
      ) : (
        <p className="muted small">Only project owners can invite people.</p>
      )}
      {msg && <p className="ok small">{msg}</p>}
      {err && <p className="error small">{err}</p>}
      <p className="muted small">Editors can add pins, boards and folders. Viewers can look and download. Changes show up for everyone live.</p>
    </section>
  );
}

function Settings({ name, emoji, description, deskSync, onSave, onDelete }: { name: string; emoji: string; description: string; deskSync: boolean; onSave: (p: any) => void; onDelete: () => void }) {
  const [desk, setDesk] = useState(deskSync);
  const [n, setN] = useState(name);
  const [e, setE] = useState(emoji);
  const [d, setD] = useState(description);
  return (
    <form className="card form-grid" onSubmit={(ev) => { ev.preventDefault(); onSave({ name: n.trim(), emoji: e, description: d.trim() || null, desk_sync: desk }); }}>
      <label>Name<input value={n} onChange={(ev) => setN(ev.target.value)} required /></label>
      <label>Icon<input value={e} onChange={(ev) => setE(ev.target.value)} maxLength={4} /></label>
      <label className="span-2">Description<textarea rows={2} value={d} onChange={(ev) => setD(ev.target.value)} /></label>
      <label className="inline span-2">
        <input type="checkbox" checked={desk} onChange={(ev) => setDesk(ev.target.checked)} />
        Send this project's pins to the Land of Rebirth Production Desk moodboard
      </label>
      <div className="row between span-2">
        <button type="button" className="ghost danger" onClick={() => confirm(`Delete project “${name}” and its boards? Saved images stay in the library.`) && onDelete()}>Delete project</button>
        <button>Save</button>
      </div>
    </form>
  );
}

function DeskPanel({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const [st, setSt] = useState<{ waiting: number; synced: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => deskStatus(pid).then(setSt).catch(() => {});
  useEffect(() => {
    refresh();
    return subscribe(`desk-${pid}`, [{ table: 'board_items' }], () => setTimeout(refresh, 4000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);
  return (
    <section className="card desk-panel">
      <div className="row between">
        <div>
          <b>🔗 Linked to the Land of Rebirth Production Desk</b>
          <p className="muted small" style={{ margin: '0.2rem 0 0' }}>
            Every image you pin in this project is queued for the Desk's moodboard with its title, notes, era and source.
            In the Desk, press <b>⟳ Sync from Askar</b> on the Moodboard tab and they join its moodboard and prompts.
          </p>
        </div>
        <div className="desk-stats">
          <span><b>{st?.waiting ?? '–'}</b> waiting</span>
          <span><b>{st?.synced ?? '–'}</b> on the Desk</span>
        </div>
      </div>
      {canEdit && (
        <div className="row">
          <button className="ghost small" disabled={!!busy} onClick={async () => {
            setBusy('Preparing…');
            const r = await backfillProject(pid, setBusy);
            setBusy(r.queued || r.failed ? `Queued ${r.queued}${r.failed ? ` · ${r.failed} failed` : ''}` : 'Everything is already queued');
            refresh();
            setTimeout(() => setBusy(null), 4000);
          }}>{busy ?? 'Queue pins that are missing'}</button>
          <a className="button ghost small" href="/desk/#mood" target="lor-desk">Open the Desk ↗</a>
        </div>
      )}
    </section>
  );
}
