import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ERAS, ERA_BY_ID, formatRange } from '../lib/eras';
import { findSite, MAPBOX_TOKEN, SITES, type Site } from '../lib/sites';
import { itemsAtSite, siteCounts } from '../lib/data';
import type { Item } from '../lib/types';
import { ItemCard, ItemGrid } from '../components/ItemCard';

const EGYPT_BOUNDS: [[number, number], [number, number]] = [[24.5, 21.5], [35.5, 31.8]];
const STYLES = {
  map: { light: 'mapbox://styles/mapbox/outdoors-v12', dark: 'mapbox://styles/mapbox/dark-v11' },
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

function prefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [styleTick, setStyleTick] = useState(0);
  const [eraId, setEraId] = useState<string | null>(params.get('era'));
  const [satellite, setSatellite] = useState(false);
  const [onlyFinds, setOnlyFinds] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [counts, setCounts] = useState<{ site_key: string; era_id: string | null; n: number }[]>([]);
  const [selected, setSelected] = useState<Site | null>(() => findSite(params.get('site')));
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    siteCounts().then(setCounts).catch((e) => setErr(e.message));
  }, []);

  // Finds per site for the chosen era, plus places we couldn't put on the map.
  const { perSite, unmapped } = useMemo(() => {
    const perSite = new Map<string, number>();
    let unmapped = 0;
    for (const c of counts) {
      if (eraId && c.era_id !== eraId) continue;
      const s = findSite(c.site_key);
      if (s) perSite.set(s.name, (perSite.get(s.name) || 0) + c.n);
      else unmapped += c.n;
    }
    return { perSite, unmapped };
  }, [counts, eraId]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: SITES.filter((s) => !onlyFinds || perSite.get(s.name)).map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: { name: s.name, n: perSite.get(s.name) || 0, selected: selected?.name === s.name ? 1 : 0 },
      })),
    }),
    [perSite, onlyFinds, selected],
  );

  const hue = eraId ? ERA_BY_ID[eraId]?.hue ?? 40 : 40;
  const color = `hsl(${hue}, 70%, 52%)`;

  // Create the map once.
  useEffect(() => {
    if (!box.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const m = new mapboxgl.Map({
      container: box.current,
      style: prefersDark() ? STYLES.map.dark : STYLES.map.light,
      bounds: EGYPT_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      attributionControl: true,
      cooperativeGestures: false,
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('style.load', () => setStyleTick((t) => t + 1));
    // Layer-bound handlers survive style swaps, so register them once here.
    m.on('click', 'sites-dot', (e) => {
      const name = (e.features?.[0] as any)?.properties?.name as string | undefined;
      const s = name ? SITES.find((x) => x.name === name) : null;
      if (s) setSelected(s);
    });
    m.on('mouseenter', 'sites-dot', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'sites-dot', () => (m.getCanvas().style.cursor = ''));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // (Re)attach our layers whenever the style loads.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const attach = () => {
      if (m.getSource('sites')) return;
      m.addSource('sites', { type: 'geojson', data: geojson as any });
      m.addLayer({
        id: 'sites-glow',
        type: 'circle',
        source: 'sites',
        filter: ['>', ['get', 'n'], 0],
        paint: {
          'circle-radius': ['+', 14, ['*', 4, ['sqrt', ['get', 'n']]]],
          'circle-color': color,
          'circle-opacity': 0.18,
          'circle-blur': 0.6,
        },
      });
      m.addLayer({
        id: 'sites-dot',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': ['case', ['>', ['get', 'n'], 0], ['+', 6, ['*', 2.2, ['sqrt', ['get', 'n']]]], 4],
          'circle-color': ['case', ['>', ['get', 'n'], 0], color, 'rgba(255,255,255,0.85)'],
          'circle-stroke-color': ['case', ['==', ['get', 'selected'], 1], '#ffffff', color],
          'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 1.5],
        },
      });
      m.addLayer({
        id: 'sites-label',
        type: 'symbol',
        source: 'sites',
        layout: {
          'text-field': ['case', ['>', ['get', 'n'], 0], ['concat', ['get', 'name'], '  ', ['to-string', ['get', 'n']]], ['get', 'name']],
          'text-size': ['case', ['>', ['get', 'n'], 0], 13, 11],
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
          'symbol-sort-key': ['-', 0, ['get', 'n']],
        },
        paint: {
          'text-color': satellite || prefersDark() ? '#f6ecd4' : '#3a2a14',
          'text-halo-color': satellite || prefersDark() ? 'rgba(0,0,0,0.7)' : 'rgba(255,250,240,0.9)',
          'text-halo-width': 1.4,
        },
      });
    };
    if (styleTick > 0) attach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleTick]);

  // Push data / colour changes into the existing layers.
  useEffect(() => {
    const m = map.current;
    const src = m?.getSource('sites') as mapboxgl.GeoJSONSource | undefined;
    if (!m || !src) return;
    src.setData(geojson as any);
    m.setPaintProperty('sites-glow', 'circle-color', color);
    m.setPaintProperty('sites-dot', 'circle-color', ['case', ['>', ['get', 'n'], 0], color, 'rgba(255,255,255,0.85)']);
    m.setPaintProperty('sites-dot', 'circle-stroke-color', ['case', ['==', ['get', 'selected'], 1], '#ffffff', color]);
  }, [geojson, color, styleTick]);

  // Satellite toggle swaps the base style; our layers re-attach on style.load.
  const firstStyle = useRef(true);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    m.setStyle(satellite ? STYLES.satellite : prefersDark() ? STYLES.map.dark : STYLES.map.light);
  }, [satellite]);

  // Selecting a site: fly there and load its finds.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (selected) next.set('site', selected.name);
    else next.delete('site');
    if (eraId) next.set('era', eraId);
    else next.delete('era');
    setParams(next, { replace: true });
    if (!selected) {
      setItems(null);
      return;
    }
    map.current?.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.current.getZoom(), 8.5), speed: 1.2, padding: { bottom: 200, top: 0, left: 0, right: 0 } });
    let alive = true;
    setItems(null);
    itemsAtSite([selected.name, ...selected.aliases], eraId)
      .then((r) => alive && setItems(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, eraId]);

  // "Play" walks through the eras.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setEraId((cur) => {
        const i = cur ? ERAS.findIndex((e) => e.id === cur) : -1;
        if (i >= ERAS.length - 1) {
          setPlaying(false);
          return cur;
        }
        return ERAS[i + 1].id;
      });
    }, 1600);
    return () => clearInterval(t);
  }, [playing]);

  const era = eraId ? ERA_BY_ID[eraId] : null;
  const total = [...perSite.values()].reduce((a, b) => a + b, 0);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="page narrow-page">
        <p className="empty">The map needs a Mapbox token. Add <code>VITE_MAPBOX_TOKEN</code> to your settings and redeploy.</p>
      </div>
    );
  }

  return (
    <div className="map-page">
      <div ref={box} className="map-canvas" />

      <div className="map-panel top">
        <h1 className="display">Map of Egypt</h1>
        <p className="muted small">
          {era ? <><b style={{ color }}>{era.short}</b> · {formatRange(era)} · </> : 'All eras · '}
          {total} find{total === 1 ? '' : 's'} on {[...perSite.keys()].length} site{perSite.size === 1 ? '' : 's'}
          {unmapped > 0 && <> · {unmapped} at places not on the map yet</>}
        </p>
        <div className="row">
          <button className={`chip-btn ${satellite ? 'on' : ''}`} onClick={() => setSatellite(!satellite)}>🛰 Satellite</button>
          <button className={`chip-btn ${onlyFinds ? 'on' : ''}`} onClick={() => setOnlyFinds(!onlyFinds)}>Only sites with finds</button>
        </div>
        {err && <p className="error small">{err}</p>}
      </div>

      <div className="map-scrubber">
        <button className="play" onClick={() => { if (!playing && eraId === ERAS[ERAS.length - 1].id) setEraId(null); setPlaying(!playing); }} aria-label={playing ? 'Pause' : 'Play through the eras'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="scrub-track">
          <button className={`scrub-era ${!eraId ? 'on' : ''}`} onClick={() => { setPlaying(false); setEraId(null); }}>All</button>
          {ERAS.map((e) => (
            <button
              key={e.id}
              className={`scrub-era ${eraId === e.id ? 'on' : ''}`}
              style={{ ['--hue' as any]: e.hue }}
              onClick={() => { setPlaying(false); setEraId(e.id); }}
              title={`${e.name} (${formatRange(e)})`}
            >
              {e.short}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <aside className="site-sheet">
          <div className="sheet-head">
            <div>
              <h2 className="display">{selected.name}</h2>
              <p className="muted small">{selected.region}{era ? ` · ${era.short}` : ''}</p>
            </div>
            <button className="ghost small" onClick={() => setSelected(null)} aria-label="Close">✕</button>
          </div>
          <p className="small">{selected.description}</p>
          <div className="row">
            <Link className="button small" to={`/discover?q=${encodeURIComponent(selected.name)}${eraId ? `&era=${eraId}` : ''}`}>Find more from {selected.name}</Link>
          </div>
          {items === null ? (
            <p className="muted small">Loading finds…</p>
          ) : items.length === 0 ? (
            <p className="muted small">Nothing saved here{era ? ` for the ${era.short}` : ''} yet. When you save a find, type “{selected.name}” as its site and it lands on this pin.</p>
          ) : (
            <ItemGrid>{items.map((it) => <ItemCard key={it.id} item={it} />)}</ItemGrid>
          )}
        </aside>
      )}
    </div>
  );
}
