import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createBoard, getRuler, itemsForRuler, type Ruler } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { ERA_BY_ID } from '../lib/eras';
import type { Item } from '../lib/types';
import { ItemCard, ItemGrid } from '../components/ItemCard';
import { MUMMY_LABEL, reign } from './RulersPage';

type Kind = 'mummy' | 'statue' | 'relief' | 'coin' | 'portrait' | 'other';
const KINDS: { id: Kind; label: string; terms: string[] }[] = [
  { id: 'mummy', label: 'Mummy, skull & CT scans', terms: ['mummy', 'mummy face', 'CT scan'] },
  { id: 'statue', label: 'Statues & sculpted heads', terms: ['statue', 'statue head', 'bust'] },
  { id: 'relief', label: 'Reliefs & wall paintings', terms: ['relief', 'wall painting', 'stela'] },
  { id: 'coin', label: 'Coins & seals', terms: ['coin portrait'] },
  { id: 'portrait', label: 'Portraits & photographs', terms: ['portrait', 'photograph'] },
  { id: 'other', label: 'Other finds', terms: [] },
];

function kindOf(it: Item): Kind {
  const t = `${it.category ?? ''} ${it.title}`.toLowerCase();
  if (/mumm|skull|ct scan|remains|skeleton/.test(t)) return 'mummy';
  if (/coin|seal|tetradrachm|solidus|dinar/.test(t)) return 'coin';
  if (/relief|painting|stela|stele|wall|fresco|carving/.test(t) || it.category === 'relief') return 'relief';
  if (/statue|head|bust|sculpt|sphinx|colossus|figure/.test(t) || it.category === 'statue') return 'statue';
  if (/portrait|photo|miniature/.test(t) || it.category === 'photograph' || it.category === 'people') return 'portrait';
  return 'other';
}

/** What kind of face evidence can honestly exist for this era. */
function evidenceAdvice(r: Ruler): { best: Kind[]; note: string } {
  const e = r.era_id || '';
  if (e === 'predynastic' || e === 'early-dynastic')
    return { best: ['statue', 'relief'], note: 'Very few royal images survive: palettes, maceheads, ivory labels and small figurines. Faces are stylised, so treat them as symbols rather than likenesses.' };
  if (['old-kingdom', 'fip', 'middle-kingdom', 'sip', 'new-kingdom', 'tip', 'late-period'].includes(e))
    return { best: ['mummy', 'statue', 'relief'], note: 'Statues are the best face source. Royal art is idealised, but some periods are strikingly individual (late Dyn. 12, the Amarna period, Dyn. 25 and 26). Combine several statues from different angles, and the mummy when one exists.' };
  if (e === 'ptolemaic')
    return { best: ['coin', 'statue'], note: 'Greek-style marble heads and coin portraits are the most individual likenesses; Egyptian-style statues are idealised. No Ptolemaic royal mummy has been found.' };
  if (e === 'roman' || e === 'byzantine-coptic')
    return { best: ['statue', 'coin'], note: 'Imperial marble portraits and coins. Only a few emperors ever visited Egypt; their portraits were made elsewhere.' };
  if (['early-islamic', 'fatimid', 'ayyubid-mamluk'].includes(e))
    return { best: [], note: 'Honest warning: no contemporary portraits of these rulers are known. Coins carry inscriptions, not faces. Any "portrait" online is a later imagining.' };
  if (e === 'ottoman')
    return { best: ['portrait'], note: 'Ottoman sultans have court miniatures and European paintings, often made long after the sitter. Local beys and pashas rarely have reliable portraits.' };
  return { best: ['portrait'], note: 'Paintings, engravings and, from the 1840s on, photographs.' };
}

export default function RulerPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { role } = useAuth();
  const ruler = useAsync(() => getRuler(slug!), [slug]);
  const r = ruler.data as Ruler | null;
  const items = useAsync(() => (r ? itemsForRuler(r) : Promise.resolve([] as Item[])), [r?.slug]);
  const [busy, setBusy] = useState(false);

  if (ruler.error) return <div className="page"><p className="error">{ruler.error}</p></div>;
  if (!r) return <div className="page"><p className="muted">{ruler.loading ? 'Loading…' : 'Ruler not found.'}</p></div>;

  const adv = evidenceAdvice(r);
  const groups = KINDS.map((k) => ({ ...k, items: (items.data || []).filter((it) => kindOf(it) === k.id) }));
  const search = (term: string) => `/discover?q=${encodeURIComponent(`${r.name} ${term}`.trim())}&subject=${encodeURIComponent(r.name)}`;

  async function startBoard() {
    setBusy(true);
    try {
      const b = await createBoard({ title: `${r!.name}: face reconstruction`, kind: 'reconstruction', subject: r!.name, era_id: r!.era_id, description: `Face evidence for ${r!.name} (${r!.dynasty}, ${reign(r!)}). Pin front, profile and three-quarter views and mark each with its angle.` });
      nav(`/boards/${b.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page ruler-page">
      <div className="crumbs"><Link to="/rulers">Rulers</Link> / <span>{r.name}</span></div>
      <h1 className="display">{r.name}</h1>
      <p className="muted">
        {r.dynasty} · {reign(r)}{r.certainty === 'debated' ? ' · existence or dates debated' : ''}
        {r.aliases?.length ? ` · also ${r.aliases.join(', ')}` : ''}
      </p>
      <div className="chips">
        {r.era_id && <Link className="chip era" to={`/era/${r.era_id}`} style={{ ['--hue' as any]: ERA_BY_ID[r.era_id]?.hue }}>{ERA_BY_ID[r.era_id]?.short}</Link>}
        <span className={`chip body ${r.mummy_status}`}>{MUMMY_LABEL[r.mummy_status]}</span>
      </div>
      {r.is_group && <p className="card soft small">This entry covers several rulers. Search for each name individually for face evidence.</p>}

      <section className="card soft">
        <h2 style={{ marginTop: 0 }}>Face evidence</h2>
        {r.mummy_note && <p><b>Body:</b> {r.mummy_note}</p>}
        <p className="small">{adv.note}</p>
        <div className="row wrap gap">
          {KINDS.filter((k) => k.terms.length && (adv.best.includes(k.id) || k.id === 'statue' || k.id === 'relief' || (k.id === 'mummy' && r.mummy_status !== 'none'))).flatMap((k) =>
            k.terms.slice(0, 2).map((t) => <Link key={k.id + t} className="button small ghost" to={search(t)}>Find {t}</Link>),
          )}
        </div>
        {role !== 'guest' && <button className="small" disabled={busy} onClick={startBoard} style={{ marginTop: 10 }}>{busy ? 'Creating…' : '＋ Start a reconstruction board'}</button>}
        <p className="muted small" style={{ marginBottom: 0 }}>Anything you save from these searches is tagged with “{r.name}” and appears below, sorted by type.</p>
      </section>

      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.id}>
          <h2>{g.label} <span className="muted small">({g.items.length})</span></h2>
          <ItemGrid>{g.items.map((it) => <ItemCard key={it.id} item={it} />)}</ItemGrid>
        </section>
      ))}
      {items.data && !items.data.length && <p className="empty">Nothing saved for {r.name} yet. Use the buttons above to search.</p>}
    </div>
  );
}
