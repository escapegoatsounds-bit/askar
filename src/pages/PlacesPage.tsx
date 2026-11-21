import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { lastResearchRuns, listPlaces } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { ERAS, ERA_BY_ID } from '../lib/eras';

const STATUS_LABEL: Record<string, string> = { todo: 'Waiting', in_progress: 'In progress', done: 'Researched', needs_review: 'Review' };

export default function PlacesPage() {
  const places = useAsync(listPlaces, []);
  const runs = useAsync(() => lastResearchRuns(3), []);
  const [era, setEra] = useState<string>('predynastic');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (places.data || []).filter(
      (p) =>
        (!era || p.eras.includes(era)) &&
        (!status || p.research_status === status) &&
        (!t || [p.name, p.region, ...(p.aliases || [])].join(' ').toLowerCase().includes(t)),
    );
  }, [places.data, era, q, status]);

  const inEra = (places.data || []).filter((p) => !era || p.eras.includes(era));
  const done = inEra.filter((p) => p.research_status === 'done' || p.research_status === 'needs_review').length;

  return (
    <div className="page">
      <section className="hero compact">
        <h1 className="display">Places</h1>
        <p className="muted">
          Every village, city and site: a Wikipedia-style summary, interesting facts, rulers, beliefs & deities, images and sources.
          Claude researches 5 places every 12 hours, predynastic first.
        </p>
      </section>

      <div className="card research-progress">
        <div className="row between">
          <b>{era ? ERA_BY_ID[era]?.short : 'All eras'}: {done} of {inEra.length} researched</b>
          {runs.data?.[0] && <span className="muted small">Last run {new Date(runs.data[0].ran_at).toLocaleString()} · {runs.data[0].places.join(', ')}</span>}
        </div>
        <div className="meter"><div style={{ width: `${inEra.length ? (done / inEra.length) * 100 : 0}%` }} /></div>
        {runs.data?.[0]?.summary && <p className="muted small" style={{ margin: 0 }}>{runs.data[0].summary}</p>}
      </div>

      <div className="filters">
        <input type="search" placeholder="Search places…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={era} onChange={(e) => setEra(e.target.value)}>
          <option value="">All eras</option>
          {ERAS.map((e) => <option key={e.id} value={e.id}>{e.short}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="done">Researched</option>
          <option value="needs_review">Needs review</option>
          <option value="todo">Waiting</option>
        </select>
      </div>

      {places.error && <p className="error">{places.error}</p>}
      <div className="place-grid">
        {list.map((p) => (
          <Link key={p.id} to={`/places/${encodeURIComponent(p.name)}`} className="place-card card">
            <div className="row between">
              <b>{p.name}</b>
              <span className={`chip status ${p.research_status}`}>{STATUS_LABEL[p.research_status]}</span>
            </div>
            <span className="muted small">{p.region}</span>
            <span className="small">{(p.summary || p.description || '').slice(0, 140)}{(p.summary || p.description || '').length > 140 ? '…' : ''}</span>
            <span className="era-dots">
              {p.eras.map((id) => <span key={id} className="era-dot" title={ERA_BY_ID[id]?.short} style={{ background: `hsl(${ERA_BY_ID[id]?.hue ?? 40} 55% 50%)` }} />)}
              {p.facts?.length ? <span className="muted small"> · {p.facts.length} facts</span> : null}
              {p.deities?.length ? <span className="muted small"> · {p.deities.length} deities</span> : null}
            </span>
          </Link>
        ))}
      </div>
      {places.data && !list.length && <p className="empty">No places match.</p>}
    </div>
  );
}
