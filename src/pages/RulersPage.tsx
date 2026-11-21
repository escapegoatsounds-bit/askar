import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRulers, type Ruler } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { ERAS, ERA_BY_ID } from '../lib/eras';

export const MUMMY_LABEL: Record<Ruler['mummy_status'], string> = {
  mummy: 'Mummy known',
  remains: 'Remains known',
  disputed: 'Body disputed',
  lost: 'Remains lost',
  none: 'No body found',
};

export function reign(r: Ruler) {
  const f = (y: number | null) => (y == null ? '?' : y < 0 ? `${-y} BC` : `AD ${y}`);
  const pre = r.certainty === 'firm' ? '' : 'c. ';
  return `${pre}${f(r.reign_start)} – ${f(r.reign_end)}`;
}

export default function RulersPage() {
  const rulers = useAsync(listRulers, []);
  const [q, setQ] = useState('');
  const [era, setEra] = useState('');
  const [body, setBody] = useState('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rulers.data || []).filter(
      (r) =>
        (!era || r.era_id === era) &&
        (!body || (body === 'any' ? r.mummy_status !== 'none' : r.mummy_status === body)) &&
        (!t || [r.name, r.dynasty, ...(r.aliases || [])].join(' ').toLowerCase().includes(t)),
    );
  }, [rulers.data, q, era, body]);

  const byEra = useMemo(() => {
    const m = new Map<string, Ruler[]>();
    for (const r of list) {
      const k = r.era_id || 'other';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <div className="page">
      <section className="hero compact">
        <h1 className="display">Rulers</h1>
        <p className="muted">
          Every ruler of Egypt, from the Naqada chiefs to today. Open one to gather the face evidence (mummy, statues, reliefs, coins, portraits)
          and start a facial-reconstruction board.
        </p>
      </section>
      <div className="filters">
        <input type="search" placeholder="Search rulers… (Khufu, Cheops, Ramses, Dyn. 18)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={era} onChange={(e) => setEra(e.target.value)}>
          <option value="">All eras</option>
          {ERAS.map((e) => <option key={e.id} value={e.id}>{e.short}</option>)}
        </select>
        <select value={body} onChange={(e) => setBody(e.target.value)}>
          <option value="">Any evidence</option>
          <option value="any">Has a body or remains</option>
          <option value="mummy">Mummy known</option>
          <option value="disputed">Body disputed</option>
        </select>
      </div>
      {rulers.error && <p className="error">{rulers.error}</p>}
      {byEra.map(([eid, rs]) => (
        <section key={eid} className="ruler-era">
          <h2 style={{ ['--hue' as any]: ERA_BY_ID[eid]?.hue }}>{ERA_BY_ID[eid]?.name ?? 'Other'}</h2>
          <div className="ruler-grid">
            {rs.map((r) => (
              <Link key={r.slug} to={`/rulers/${r.slug}`} className={`ruler-card card ${r.is_group ? 'group' : ''}`}>
                <b>{r.name}</b>
                <span className="muted small">{r.dynasty} · {reign(r)}</span>
                {r.mummy_status !== 'none' && <span className={`chip body ${r.mummy_status}`}>{MUMMY_LABEL[r.mummy_status]}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
      {rulers.data && !list.length && <p className="empty">No rulers match.</p>}
    </div>
  );
}
