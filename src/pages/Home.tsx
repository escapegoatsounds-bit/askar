import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createProject, listItems, listProjects } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { ItemCard, ItemGrid } from '../components/ItemCard';
import { ProjectCover } from '../components/ProjectCover';

const EMOJIS = ['📁', '🏺', '🎨', '📸', '🤖', '🧊', '🏛️', '🎬', '👗', '🌿', '🔷', '✨'];

export default function Home() {
  const { role, email } = useAuth();
  const projects = useAsync(listProjects, []);
  const recent = useAsync(() => listItems({ limit: 24 }), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const isTeam = role === 'owner' || role === 'editor';

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const p = await createProject({ name: name.trim(), emoji, description: desc.trim() || null });
      nav(`/projects/${p.id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <h1 className="display">Your projects</h1>
        <p className="muted">
          {isTeam
            ? 'Collect references for anything: history, photography, AI, design. Organize them into projects, folders and boards, and invite people to work with you.'
            : `You've been invited to collaborate${email ? ` as ${email}` : ''}. These are the projects shared with you.`}
        </p>
        {isTeam && (
          <div className="row">
            <button onClick={() => setOpen(!open)}>{open ? 'Cancel' : '＋ New project'}</button>
            <Link className="button ghost" to="/discover">Find references</Link>
          </div>
        )}
      </section>

      {open && (
        <form className="card form-grid" onSubmit={create}>
          <label className="span-2">Project name<input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sci-fi short film, Brand refresh, Ramesses II reconstruction…" /></label>
          <div className="span-2">
            <span className="label-text">Icon</span>
            <div className="emoji-pick">
              {EMOJIS.map((x) => (
                <button type="button" key={x} className={`chip-btn ${emoji === x ? 'on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>
              ))}
            </div>
          </div>
          <label className="span-2">Description (optional)<textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
          {err && <p className="error span-2">{err}</p>}
          <div className="row end span-2"><button disabled={!name.trim()}>Create project</button></div>
        </form>
      )}

      {projects.error && <p className="error">{projects.error}</p>}
      <div className="project-grid">
        {projects.data?.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="project-card">
            <ProjectCover projectId={p.id} />
            <div className="meta">
              <div className="title">{p.emoji ?? '📁'} {p.name}</div>
              <div className="sub">{p.boards} board{p.boards === 1 ? '' : 's'}{p.description ? ` · ${p.description}` : ''}</div>
            </div>
          </Link>
        ))}
        {isTeam && (
          <Link to="/timeline" className="project-card special">
            <div className="cover special-cover">☥</div>
            <div className="meta">
              <div className="title">🏺 Egypt timeline & map</div>
              <div className="sub">7,000 years, 18 eras, 58 sites</div>
            </div>
          </Link>
        )}
      </div>
      {projects.data && projects.data.length === 0 && !isTeam && <p className="empty">Nothing has been shared with you yet.</p>}

      <section>
        <div className="section-head"><h2>Recently saved</h2>{isTeam && <Link to="/library">Library →</Link>}</div>
        {recent.data && recent.data.length === 0 && <p className="empty">Nothing saved yet. <Link to="/discover">Go find some references →</Link></p>}
        <ItemGrid>{recent.data?.map((it) => <ItemCard key={it.id} item={it} />)}</ItemGrid>
      </section>
    </div>
  );
}
