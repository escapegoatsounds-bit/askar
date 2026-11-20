import { Link } from 'react-router-dom';
import { ERAS, formatRange } from '../lib/eras';
import { eraCounts, listItems } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { ItemCard, ItemGrid } from '../components/ItemCard';
import { SITES, findSite, staticMapUrl } from '../lib/sites';
import { siteCounts } from '../lib/data';

const TOTAL_START = -5500;
const TOTAL_END = 2026;

export default function Timeline() {
  const counts = useAsync(eraCounts, []);
  const recent = useAsync(() => listItems({ limit: 18 }), []);
  const sc = useAsync(siteCounts, []);
  const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const pinned = [...new Set((sc.data || []).map((r) => findSite(r.site_key)).filter(Boolean))] as typeof SITES;
  const mapUrl = staticMapUrl(pinned.length ? pinned : SITES.filter((s) => ['Giza', 'Karnak', 'Abu Simbel', 'Alexandria', 'Amarna', 'Abydos'].includes(s.name)), { w: 640, h: 360, dark });
  const c = counts.data || {};
  const total = Object.values(c).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <section className="hero">
        <h1 className="display">Seven thousand years, one wall.</h1>
        <p className="muted">
          {total ? `${total} finds collected so far` : 'Nothing collected yet'} — pick an age to open its mood board, or go <Link to="/discover">digging in the museums</Link>.
        </p>
      </section>

      {/* Proportional strip: each era is as wide as it lasted. */}
      <div className="era-strip" aria-hidden="true">
        {ERAS.map((e) => {
          const end = Math.min(e.end, TOTAL_END);
          const w = ((end - e.start) / (TOTAL_END - TOTAL_START)) * 100;
          return (
            <Link key={e.id} to={`/era/${e.id}`} style={{ width: `${w}%`, background: `hsl(${e.hue} 50% 45%)` }} title={e.name} />
          );
        })}
      </div>
      <div className="era-strip-labels muted"><span>5500 BCE</span><span>1 CE</span><span>today</span></div>

      {mapUrl && (
        <Link to="/map" className="map-teaser">
          <img src={mapUrl} alt="Map of saved sites" loading="lazy" />
          <span className="map-teaser-text">
            <b className="display">The map</b>
            <span>{pinned.length ? `${pinned.length} sites with finds` : 'See every site from Naqada to Abu Simbel'} — scrub through the eras →</span>
          </span>
        </Link>
      )}

      <ol className="era-list">
        {ERAS.map((e, i) => (
          <li key={e.id}>
            <Link to={`/era/${e.id}`} className="era-row" style={{ ['--hue' as any]: e.hue }}>
              <span className="era-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="era-body">
                <span className="era-name">{e.name}</span>
                <span className="era-dates">{formatRange(e)}</span>
                <span className="era-blurb">{e.blurb}</span>
              </span>
              <span className="era-count">{c[e.id] ?? 0}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link to="/era/none" className="era-row undated">
            <span className="era-num">??</span>
            <span className="era-body"><span className="era-name">Undated finds</span><span className="era-blurb">Things waiting for someone to work out when they belong.</span></span>
            <span className="era-count">{c['none'] ?? 0}</span>
          </Link>
        </li>
      </ol>

      <section>
        <div className="section-head"><h2>Recently added</h2><Link to="/library">See all →</Link></div>
        {recent.error && <p className="error">{recent.error}</p>}
        {recent.data && recent.data.length === 0 && <p className="empty">The wall is bare. Go to <Link to="/discover">Discover</Link> or <Link to="/add">Add</Link> to put up the first picture.</p>}
        <ItemGrid>{recent.data?.map((it) => <ItemCard key={it.id} item={it} />)}</ItemGrid>
      </section>
    </div>
  );
}
