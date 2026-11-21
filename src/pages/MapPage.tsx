import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ERAS, ERA_BY_ID, formatRange } from '../lib/eras';
import { findSite, MAPBOX_TOKEN, SITES, mergeSites, type Site } from '../lib/sites';
import { itemsAtSite, listPlaces, siteCounts } from '../lib/data';
import type { Item } from '../lib/types';
import { ItemCard, ItemGrid } from '../components/ItemCard';

const EGYPT_BOUNDS: [[number, number], [number, number]] = [[24.6, 18.2], [35.2, 31.7]];
const STYLE = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  map: 'mapbox://styles/mapbox/outdoors-v12',
};

/** Colour for an era (matches the timeline). */
function eraColor(id: string | null | undefined, light = 55): string {
  const hue = (id && ERA_BY_ID[id]?.hue) ?? 40;
  return `hsl(${hue}, 75%, ${light}%)`;
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [styleTick, setStyleTick] = useState(0);
  const [eraId, setEraId] = useState<string | null>(params.get('era'));
  const [satellite, setSatellite] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [counts, setCounts] = useState<{ site_key: string; era_id: string | null; n: number }[]>([]);
  const [selected, setSelected] = useState<Site | null>(() => findSite(params.get('site')));
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [sitesVersion, setSitesVersion] = useState(0);
  useEffect(() => {
    siteCounts().then(setCounts).catch((e) => setErr(e.message));
    // Places added in the database (e.g. new predynastic sites) join the map.
    listPlaces()
      .then((rows) => {
        const before = SITES.length;
        mergeSites(rows);
        if (SITES.length !== before) setSitesVersion((v) => v + 1);
      })
      .catch(() => {});
  }, []);

  // Saved finds per site (for the chosen era).
  const perSite = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of counts) {
      if (eraId && c.era_id !== eraId) continue;
      const s = findSite(c.site_key);
      if (s) m.set(s.name, (m.get(s.name) || 0) + c.n);
    }
    return m;
  }, [counts, eraId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeSites = useMemo(() => SITES.filter((s) => !eraId || s.eras.includes(eraId)), [eraId, sitesVersion]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: SITES.map((s) => {
        const active = !eraId || s.eras.includes(eraId);
        const n = perSite.get(s.name) || 0;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
          properties: {
            name: s.name,
            n,
            label: n ? `${s.name} · ${n}` : s.name,
            active: active ? 1 : 0,
            selected: selected?.name === s.name ? 1 : 0,
            // Colour by the selected era, or by the site's earliest era.
            color: eraColor(eraId ?? s.eras[0]),
            rank: (active ? 1000 : 0) + n * 10 + s.eras.length,
          },
        };
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eraId, perSite, selected, sitesVersion],
  );

  // Create the map once.
  useEffect(() => {
    if (!box.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    let m: mapboxgl.Map;
    try {
      m = new mapboxgl.Map({
        container: box.current,
        style: STYLE.satellite,
        bounds: EGYPT_BOUNDS,
        fitBoundsOptions: { padding: { top: 120, bottom: 80, left: 20, right: 20 } },
        attributionControl: true,
        // Test hook only (unset in the app): render labels with local fonts.
        localFontFamily: (window as any).__ASKAR_TEST_LOCAL_FONT__,
      });
    } catch (e) {
      setErr(`The map could not start: ${(e as Error).message}. Your browser may have WebGL turned off.`);
      return;
    }
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('style.load', () => setStyleTick((t) => t + 1));
    m.on('error', (e: any) => {
      const msg = e?.error?.message || String(e?.error || 'unknown error');
      // Missing-layer noise during style swaps is harmless; show anything else.
      if (!/does not exist in the map's style/.test(msg)) setErr(`Map problem: ${msg}`);
    });
    const pick = (e: any) => {
      const name = e.features?.[0]?.properties?.name as string | undefined;
      const s = name ? SITES.find((x) => x.name === name) : null;
      if (s) setSelected(s);
    };
    m.on('click', 'sites-dot', pick);
    m.on('click', 'sites-label', pick);
    m.on('mouseenter', 'sites-dot', (e: any) => {
      m.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0];
      const s = f && SITES.find((x) => x.name === f.properties.name);
      if (!s) return;
      const eras = s.eras.map((id: string) => `<span style="border-bottom:2px solid ${eraColor(id)}">${ERA_BY_ID[id]?.short ?? id}</span>`).join(' · ');
      popup.current?.remove();
      popup.current = new mapboxgl.Popup({ closeButton: false, offset: 12, className: 'site-pop' })
        .setLngLat([s.lng, s.lat])
        .setHTML(`<b>${s.name}</b><br><small>${s.region}</small><br><small>${eras}</small>`)
        .addTo(m);
    });
    m.on('mouseleave', 'sites-dot', () => {
      m.getCanvas().style.cursor = '';
      popup.current?.remove();
    });
    map.current = m;
    return () => {
      popup.current?.remove();
      m.remove();
      map.current = null;
    };
  }, []);

  // Add our layers every time a base style finishes loading.
  useEffect(() => {
    const m = map.current;
    if (!m || styleTick === 0 || m.getSource('sites')) return;
    m.addSource('sites', { type: 'geojson', data: geojson as any });
    m.addLayer({
      id: 'sites-glow',
      type: 'circle',
      source: 'sites',
      filter: ['==', ['get', 'active'], 1],
      paint: {
        'circle-radius': ['+', 13, ['*', 4, ['sqrt', ['get', 'n']]]],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.28,
        'circle-blur': 0.7,
      },
    });
    m.addLayer({
      id: 'sites-dot',
      type: 'circle',
      source: 'sites',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'active'], 1], ['+', 6, ['*', 2, ['sqrt', ['get', 'n']]]], 3.5],
        'circle-color': ['get', 'color'],
        'circle-opacity': ['case', ['==', ['get', 'active'], 1], 1, 0.35],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3.5, ['==', ['get', 'active'], 1], 1.8, 0.6],
        'circle-stroke-opacity': ['case', ['==', ['get', 'active'], 1], 1, 0.4],
      },
    });
    m.addLayer({
      id: 'sites-label',
      type: 'symbol',
      source: 'sites',
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, ['case', ['==', ['get', 'active'], 1], 11.5, 9.5], 8, ['case', ['==', ['get', 'active'], 1], 15, 12]],
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.9,
        'text-justify': 'auto',
        'text-optional': false,
        'symbol-sort-key': ['-', 0, ['get', 'rank']],
      },
      paint: {
        'text-color': ['case', ['==', ['get', 'active'], 1], '#fff6e2', 'rgba(255,246,226,0.55)'],
        'text-halo-color': 'rgba(10,8,4,0.85)',
        'text-halo-width': 1.6,
      },
    });
  }, [styleTick, geojson]);

  // Push data changes into the existing source.
  useEffect(() => {
    const src = map.current?.getSource('sites') as mapboxgl.GeoJSONSource | undefined;
    src?.setData(geojson as any);
  }, [geojson, styleTick]);

  // Satellite / map toggle swaps the base style; layers re-attach on style.load.
  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    map.current?.setStyle(satellite ? STYLE.satellite : STYLE.map);
  }, [satellite]);

  // Keep the URL shareable, fly to a selected site and load its finds.
  useEffect(() => {
    const next = new URLSearchParams(params);
    selected ? next.set('site', selected.name) : next.delete('site');
    eraId ? next.set('era', eraId) : next.delete('era');
    setParams(next, { replace: true });
    if (!selected) {
      setItems(null);
      return;
    }
    map.current?.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.current.getZoom(), 9), speed: 1.2 });
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
    }, 1800);
    return () => clearInterval(t);
  }, [playing]);

  // Keep the active era chip in view while playing.
  useEffect(() => {
    document.querySelector('.scrub-era.on')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [eraId]);

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

      <div className="map-panel top" style={{ ['--hue' as any]: era?.hue ?? 40 }}>
        <h1 className="display">{era ? era.short : 'Map of Egypt'}</h1>
        <p className="muted small">
          {era ? (
            <>
              <b className="era-ink">{formatRange(era)}</b> · {activeSites.length} site{activeSites.length === 1 ? '' : 's'} of this age
            </>
          ) : (
            <>{SITES.length} sites across 7,000 years</>
          )}
          {total > 0 && <> · {total} saved find{total === 1 ? '' : 's'}</>}
        </p>
        {era && <p className="small era-blurb-map">{era.blurb}</p>}
        <div className="row">
          <button className={`chip-btn ${satellite ? 'on' : ''}`} onClick={() => setSatellite(!satellite)}>
            {satellite ? '🛰 Satellite' : '🗺 Map'}
          </button>
        </div>
        {err && <p className="error small">{err}</p>}
      </div>

      <div className="map-scrubber">
        <button
          className="play"
          onClick={() => {
            if (!playing && eraId === ERAS[ERAS.length - 1].id) setEraId(null);
            setPlaying(!playing);
          }}
          aria-label={playing ? 'Pause' : 'Play through the eras'}
        >
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
              <p className="muted small">{selected.region}</p>
            </div>
            <button className="ghost small" onClick={() => setSelected(null)} aria-label="Close">✕</button>
          </div>
          <p className="small">{selected.description}</p>
          <div className="chips">
            {selected.eras.map((id) => (
              <button
                key={id}
                className={`chip era ${eraId === id ? 'current' : ''}`}
                style={{ ['--hue' as any]: ERA_BY_ID[id]?.hue }}
                onClick={() => { setPlaying(false); setEraId(id); }}
              >
                {ERA_BY_ID[id]?.short}
              </button>
            ))}
          </div>
          <div className="row">
            <Link className="button small" to={`/places/${encodeURIComponent(selected.name)}`}>Facts, rulers & gods →</Link>
            <Link className="button ghost small" to={`/discover?q=${encodeURIComponent(selected.name)}${eraId ? `&era=${eraId}` : ''}`}>
              Find images
            </Link>
          </div>
          {items === null ? (
            <p className="muted small">Loading finds…</p>
          ) : items.length === 0 ? (
            <p className="muted small">Nothing saved here{era ? ` for the ${era.short}` : ''} yet. Save a find with “{selected.name}” as its site and it lands on this pin.</p>
          ) : (
            <ItemGrid>{items.map((it) => <ItemCard key={it.id} item={it} />)}</ItemGrid>
          )}
        </aside>
      )}
    </div>
  );
}
