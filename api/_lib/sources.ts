/**
 * Source connectors. Each one searches an open collection and returns
 * results in one common shape, with license and provenance attached.
 */
import { fetchWithTimeout } from './safeUrl.js';
import { guessEra, parseYears } from '../../src/lib/eras.js';
import { guessCategory } from '../../src/lib/taxonomy.js';
import { findSiteInText } from '../../src/lib/sites.js';

export interface SourceResult {
  source: string;
  externalId: string;
  kind: 'image' | 'video' | 'document' | 'model3d';
  title: string;
  thumbUrl: string | null;
  mediaUrl: string | null;
  pageUrl: string | null;
  license: string | null;
  credit: string | null;
  dateText: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  eraGuess: string | null;
  categoryGuess: string | null;
  siteGuess: string | null;
  description: string | null;
}

export interface SearchOpts {
  q: string;
  page: number; // 0-based
  egyptOnly: boolean;
}

export interface SourceDef {
  id: string;
  label: string;
  /** Which Discover mode lists it: history & museums, visual references, or both. */
  group?: 'history' | 'visual' | 'both';
  note: string;
  enabled: () => boolean;
  search: (o: SearchOpts) => Promise<SourceResult[]>;
}

const PER_PAGE = 20;

function stripHtml(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const out = s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
  return out || null;
}

function finish(r: Omit<SourceResult, 'eraGuess' | 'categoryGuess' | 'siteGuess'> & { categoryHint?: string }): SourceResult {
  let { yearStart, yearEnd } = r;
  if (yearStart === null && yearEnd === null && r.dateText) {
    const p = parseYears(r.dateText);
    yearStart = p.start;
    yearEnd = p.end;
  }
  const { categoryHint, ...rest } = r;
  return {
    ...rest,
    yearStart,
    yearEnd,
    eraGuess: guessEra(yearStart, yearEnd),
    siteGuess: findSiteInText(`${r.title} ${r.description ?? ''}`)?.name ?? null,
    categoryGuess:
      r.kind === 'video' ? 'video' : r.kind === 'model3d' ? 'model3d' : guessCategory(`${categoryHint ?? ''} ${r.title}`),
  };
}

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const r = await fetchWithTimeout(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- The Met
const met: SourceDef = {
  id: 'met',
  group: 'history',
  label: 'The Met',
  note: 'Metropolitan Museum Open Access. Public-domain items are CC0.',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const params = new URLSearchParams({ q, hasImages: 'true' });
    if (egyptOnly) params.set('departmentId', '10'); // Egyptian Art
    const s = await getJson(`https://collectionapi.metmuseum.org/public/collection/v1/search?${params}`);
    const ids: number[] = (s.objectIDs || []).slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const objs = await Promise.all(
      ids.map((id) => getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(() => null)),
    );
    return objs
      .filter((o) => o && (o.primaryImageSmall || o.primaryImage))
      .map((o) =>
        finish({
          source: 'met',
          externalId: `met:${o.objectID}`,
          kind: 'image',
          title: o.title || 'Untitled',
          thumbUrl: o.primaryImageSmall || o.primaryImage,
          mediaUrl: o.primaryImage || o.primaryImageSmall,
          pageUrl: o.objectURL || null,
          license: o.isPublicDomain ? 'CC0 (Public Domain)' : 'Rights reserved — check the Met page',
          credit: o.creditLine || 'The Metropolitan Museum of Art',
          dateText: [o.period, o.dynasty, o.reign, o.objectDate].filter(Boolean).join(' · ') || null,
          yearStart: typeof o.objectBeginDate === 'number' ? o.objectBeginDate : null,
          yearEnd: typeof o.objectEndDate === 'number' ? o.objectEndDate : null,
          description: [o.medium, o.dimensions, o.excavation, o.city || o.region].filter(Boolean).join(' · ') || null,
          categoryHint: `${o.objectName ?? ''} ${o.classification ?? ''}`,
        }),
      );
  },
};

// ------------------------------------------------------ Wikimedia Commons
const commons: SourceDef = {
  id: 'commons',
  group: 'both',
  label: 'Wikimedia Commons',
  note: 'Huge, freely licensed. Licenses vary per file (CC BY-SA, PD, ...).',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `${q} Egypt` : q;
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap|drawing`,
      gsrnamespace: '6',
      gsrlimit: String(PER_PAGE),
      gsroffset: String(page * PER_PAGE),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime',
      iiurlwidth: '640',
      origin: '*',
    });
    const d = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
    const pages: any[] = Object.values(d?.query?.pages || {}).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    return pages
      .filter((p) => p.imageinfo?.[0])
      .map((p) => {
        const ii = p.imageinfo[0];
        const m = ii.extmetadata || {};
        const title = stripHtml(m.ObjectName?.value) || String(p.title).replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
        return finish({
          source: 'commons',
          externalId: `commons:${p.pageid}`,
          kind: 'image',
          title,
          thumbUrl: ii.thumburl || ii.url,
          mediaUrl: ii.url,
          pageUrl: ii.descriptionurl || null,
          license: stripHtml(m.LicenseShortName?.value) || 'See file page',
          credit: stripHtml(m.Artist?.value) || stripHtml(m.Credit?.value),
          dateText: stripHtml(m.DateTimeOriginal?.value) || null,
          yearStart: null,
          yearEnd: null,
          description: stripHtml(m.ImageDescription?.value)?.slice(0, 500) ?? null,
        });
      });
  },
};

// ------------------------------------------------- Cleveland Museum of Art
const cleveland: SourceDef = {
  id: 'cleveland',
  group: 'history',
  label: 'Cleveland Museum of Art',
  note: 'Open Access API. CC0 items are free to use.',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const params = new URLSearchParams({ q, has_image: '1', limit: String(PER_PAGE), skip: String(page * PER_PAGE) });
    if (egyptOnly) params.set('department', 'Egyptian and Ancient Near Eastern Art');
    const d = await getJson(`https://openaccess-api.clevelandart.org/api/artworks/?${params}`);
    return (d.data || [])
      .filter((o: any) => o.images?.web?.url)
      .map((o: any) =>
        finish({
          source: 'cleveland',
          externalId: `cleveland:${o.id}`,
          kind: 'image',
          title: o.title || 'Untitled',
          thumbUrl: o.images.web.url,
          mediaUrl: o.images.print?.url || o.images.full?.url || o.images.web.url,
          pageUrl: o.url || null,
          license: o.share_license_status === 'CC0' ? 'CC0 (Public Domain)' : o.share_license_status || 'Check museum page',
          credit: o.creditline || 'Cleveland Museum of Art',
          dateText: o.creation_date || null,
          yearStart: typeof o.creation_date_earliest === 'number' ? o.creation_date_earliest : null,
          yearEnd: typeof o.creation_date_latest === 'number' ? o.creation_date_latest : null,
          description: [o.technique, o.measurements, (o.culture || []).join(', ')].filter(Boolean).join(' · ') || null,
          categoryHint: o.type,
        }),
      );
  },
};

// ------------------------------------------------- Library of Congress
function locSearch(id: string, label: string, note: string, collectionPath: string, egyptTerm: boolean, kind: 'image' | 'document'): SourceDef {
  return {
    id,
    group: 'history',
    label,
    note,
    enabled: () => true,
    async search({ q, page, egyptOnly }) {
      const query = egyptOnly && egyptTerm && !/egypt|cairo|nile|alexandria|luxor|giza/i.test(q) ? `${q} egypt` : q;
      const params = new URLSearchParams({ q: query, fo: 'json', c: String(PER_PAGE), sp: String(page + 1) });
      const d = await getJson(`https://www.loc.gov/${collectionPath}?${params}`);
      return (d.results || [])
        .filter((r: any) => Array.isArray(r.image_url) && r.image_url.length)
        .map((r: any) => {
          const imgs: string[] = r.image_url;
          const clean = (u: string) => (u.startsWith('//') ? `https:${u}` : u).split('#')[0];
          return finish({
            source: id,
            externalId: `${id}:${r.id || r.url}`,
            kind,
            title: Array.isArray(r.title) ? r.title[0] : r.title || 'Untitled',
            thumbUrl: clean(imgs[Math.min(1, imgs.length - 1)]),
            mediaUrl: clean(imgs[imgs.length - 1]),
            pageUrl: r.url || r.id || null,
            license: 'See Library of Congress rights statement',
            credit: 'Library of Congress',
            dateText: r.date || null,
            yearStart: null,
            yearEnd: null,
            description: Array.isArray(r.description) ? r.description.join(' ').slice(0, 500) : null,
            categoryHint: kind === 'document' ? 'newspaper' : `photograph ${(r.original_format || []).join(' ')}`,
          });
        });
    },
  };
}
const locPhotos = locSearch('loc-photos', 'Library of Congress — Photos', 'Historic photographs, lantern slides, prints (1850s+).', 'photos/', true, 'image');
const locNews = locSearch('loc-news', 'Chronicling America — Newspapers', 'Digitized historic newspapers (mostly US, 1770–1963).', 'collections/chronicling-america/', false, 'document');

// --------------------------------------------------------- Internet Archive
const archive: SourceDef = {
  id: 'archive',
  group: 'both',
  label: 'Internet Archive',
  note: 'Old films, newsreels, books and scans. Rights vary — check each item.',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `(${q}) AND egypt` : q;
    const params = new URLSearchParams({
      q: `${query} AND mediatype:(image OR movies OR texts)`,
      rows: String(PER_PAGE),
      page: String(page + 1),
      output: 'json',
    });
    for (const f of ['identifier', 'title', 'date', 'year', 'mediatype', 'licenseurl', 'creator', 'description']) params.append('fl[]', f);
    const d = await getJson(`https://archive.org/advancedsearch.php?${params}`);
    return (d.response?.docs || []).map((o: any) => {
      const kind = o.mediatype === 'movies' ? 'video' : o.mediatype === 'texts' ? 'document' : 'image';
      const desc = Array.isArray(o.description) ? o.description.join(' ') : o.description;
      return finish({
        source: 'archive',
        externalId: `archive:${o.identifier}`,
        kind,
        title: Array.isArray(o.title) ? o.title[0] : o.title || o.identifier,
        thumbUrl: `https://archive.org/services/img/${o.identifier}`,
        mediaUrl: `https://archive.org/services/img/${o.identifier}`,
        pageUrl: `https://archive.org/details/${o.identifier}`,
        license: o.licenseurl || 'Unknown — check item page',
        credit: Array.isArray(o.creator) ? o.creator.join(', ') : o.creator || 'Internet Archive',
        dateText: o.date ? String(o.date).slice(0, 10) : o.year ? String(o.year) : null,
        yearStart: null,
        yearEnd: null,
        description: stripHtml(desc)?.slice(0, 500) ?? null,
        categoryHint: kind === 'document' ? 'newspaper' : kind === 'image' ? 'photograph' : '',
      });
    });
  },
};

// ----------------------------------------------------------------- Sketchfab
const sketchfab: SourceDef = {
  id: 'sketchfab',
  group: 'both',
  label: 'Sketchfab (3D scans)',
  note: '3D models and photogrammetry scans — gold for reconstruction.',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `${q} egypt` : q;
    const params = new URLSearchParams({ type: 'models', q: query, count: String(PER_PAGE) });
    if (page > 0) params.set('cursor', String(page * PER_PAGE));
    const d = await getJson(`https://api.sketchfab.com/v3/search?${params}`);
    return (d.results || []).map((m: any) => {
      const imgs: any[] = m.thumbnails?.images || [];
      const pick = imgs.slice().sort((a, b) => Math.abs(a.width - 640) - Math.abs(b.width - 640))[0];
      const big = imgs.slice().sort((a, b) => b.width - a.width)[0];
      return finish({
        source: 'sketchfab',
        externalId: `sketchfab:${m.uid}`,
        kind: 'model3d',
        title: m.name || 'Untitled model',
        thumbUrl: pick?.url || null,
        mediaUrl: big?.url || pick?.url || null,
        pageUrl: m.viewerUrl || `https://sketchfab.com/3d-models/${m.uid}`,
        license: m.license?.label || 'See Sketchfab page',
        credit: m.user?.displayName || m.user?.username || null,
        dateText: null,
        yearStart: null,
        yearEnd: null,
        description: stripHtml(m.description)?.slice(0, 500) ?? null,
      });
    });
  },
};

// ------------------------------------------------------- Smithsonian (key)
const smithsonian: SourceDef = {
  id: 'smithsonian',
  group: 'history',
  label: 'Smithsonian',
  note: 'Open Access. Needs a free api.data.gov key (SMITHSONIAN_API_KEY).',
  enabled: () => !!process.env.SMITHSONIAN_API_KEY,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `${q} egypt` : q;
    const params = new URLSearchParams({
      q: `${query} AND online_media_type:Images`,
      rows: String(PER_PAGE),
      start: String(page * PER_PAGE),
      api_key: process.env.SMITHSONIAN_API_KEY || '',
    });
    const d = await getJson(`https://api.si.edu/openaccess/api/v1.0/search?${params}`);
    return (d.response?.rows || [])
      .map((r: any) => {
        const dnr = r.content?.descriptiveNonRepeating || {};
        const media = dnr.online_media?.media?.[0];
        if (!media) return null;
        const dates: string[] = r.content?.indexedStructured?.date || [];
        return finish({
          source: 'smithsonian',
          externalId: `smithsonian:${r.id}`,
          kind: 'image',
          title: r.title || dnr.title?.content || 'Untitled',
          thumbUrl: media.thumbnail || media.content,
          mediaUrl: media.content || media.thumbnail,
          pageUrl: dnr.record_link || dnr.guid || null,
          license: media.usage?.access === 'CC0' ? 'CC0 (Public Domain)' : media.usage?.access || 'Check Smithsonian page',
          credit: dnr.data_source || 'Smithsonian Institution',
          dateText: dates.join(', ') || null,
          yearStart: null,
          yearEnd: null,
          description: null,
        });
      })
      .filter(Boolean) as SourceResult[];
  },
};


// ---------------------------------------------------------------- Openverse
const openverse: SourceDef = {
  id: 'openverse',
  group: 'both',
  label: 'Openverse',
  note: '800M+ openly licensed images (Flickr, Wikimedia, museums…). Free, no key.',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `${q} egypt` : q;
    const params = new URLSearchParams({ q: query, page: String(page + 1), page_size: String(PER_PAGE) });
    const d = await getJson(`https://api.openverse.org/v1/images/?${params}`);
    return (d.results || [])
      .filter((o: any) => o.url)
      .map((o: any) => {
        const lic = String(o.license || '').toLowerCase();
        const license = lic === 'cc0' ? 'CC0 (Public Domain)' : lic === 'pdm' ? 'Public Domain Mark' : lic ? `CC ${lic.toUpperCase()} ${o.license_version ?? ''}`.trim() : 'See source';
        return finish({
          source: 'openverse',
          externalId: `openverse:${o.id}`,
          kind: 'image',
          title: o.title || 'Untitled',
          thumbUrl: o.thumbnail || o.url,
          mediaUrl: o.url,
          pageUrl: o.foreign_landing_url || null,
          license,
          credit: [o.creator, o.source || o.provider].filter(Boolean).join(' · ') || null,
          dateText: null,
          yearStart: null,
          yearEnd: null,
          description: Array.isArray(o.tags) ? o.tags.map((t: any) => t.name).filter(Boolean).slice(0, 12).join(', ') : null,
        });
      });
  },
};

// ------------------------------------------------------- Brave Images (key)
const brave: SourceDef = {
  id: 'brave',
  group: 'both',
  label: 'Brave Images (web)',
  note: 'Whole-web image search, the closest thing to Google Images. Needs BRAVE_API_KEY.',
  enabled: () => !!process.env.BRAVE_API_KEY,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `${q} egypt` : q;
    const params = new URLSearchParams({ q: query, count: String(PER_PAGE), safesearch: 'strict' });
    if (page > 0) params.set('offset', String(page));
    const d = await getJson(`https://api.search.brave.com/res/v1/images/search?${params}`, {
      headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY || '' },
    });
    return (d.results || [])
      .map((r: any, i: number) => {
        const full = r.properties?.url || r.thumbnail?.src;
        if (!full) return null;
        return finish({
          source: 'brave',
          externalId: `web:${full}`,
          kind: 'image',
          title: r.title || r.source || 'Untitled',
          thumbUrl: r.thumbnail?.src || full,
          mediaUrl: full,
          pageUrl: r.url || null,
          license: 'Unknown — web image, check source before reuse',
          credit: r.source || r.meta_url?.hostname || null,
          dateText: null,
          yearStart: null,
          yearEnd: null,
          description: null,
        });
      })
      .filter(Boolean) as SourceResult[];
  },
};

// ------------------------------------------------ Art Institute of Chicago
const artic: SourceDef = {
  id: 'artic',
  label: 'Art Institute of Chicago',
  group: 'both',
  note: 'Paintings, prints, photography, design. Public-domain works are CC0. Free, no key.',
  enabled: () => true,
  async search({ q, page, egyptOnly }) {
    const query = egyptOnly && !/egypt/i.test(q) ? `${q} egypt` : q;
    const params = new URLSearchParams({
      q: query,
      limit: String(PER_PAGE),
      page: String(page + 1),
      fields: 'id,title,image_id,artist_display,date_display,date_start,date_end,is_public_domain,medium_display,place_of_origin,classification_title',
    });
    const d = await getJson(`https://api.artic.edu/api/v1/artworks/search?${params}`, { headers: { 'AIC-User-Agent': 'AskarArchive (personal research)' } });
    const iiif = d.config?.iiif_url || 'https://www.artic.edu/iiif/2';
    return (d.data || [])
      .filter((o: any) => o.image_id)
      .map((o: any) =>
        finish({
          source: 'artic',
          externalId: `artic:${o.id}`,
          kind: 'image',
          title: o.title || 'Untitled',
          thumbUrl: `${iiif}/${o.image_id}/full/400,/0/default.jpg`,
          mediaUrl: `${iiif}/${o.image_id}/full/843,/0/default.jpg`,
          pageUrl: `https://www.artic.edu/artworks/${o.id}`,
          license: o.is_public_domain ? 'CC0 (Public Domain)' : 'Rights reserved — check the museum page',
          credit: o.artist_display || 'Art Institute of Chicago',
          dateText: o.date_display || null,
          yearStart: typeof o.date_start === 'number' ? o.date_start : null,
          yearEnd: typeof o.date_end === 'number' ? o.date_end : null,
          description: [o.medium_display, o.place_of_origin].filter(Boolean).join(' · ') || null,
          categoryHint: o.classification_title,
        }),
      );
  },
};

// --------------------------------------------------------------- NASA
const nasa: SourceDef = {
  id: 'nasa',
  label: 'NASA Images',
  group: 'visual',
  note: 'Space, Earth from orbit, aerospace. Generally public domain. Free, no key.',
  enabled: () => true,
  async search({ q, page }) {
    const params = new URLSearchParams({ q, media_type: 'image', page: String(page + 1), page_size: String(PER_PAGE) });
    const d = await getJson(`https://images-api.nasa.gov/search?${params}`);
    return (d.collection?.items || [])
      .map((it: any) => {
        const m = it.data?.[0] || {};
        const thumb = it.links?.find((l: any) => l.render === 'image')?.href || it.links?.[0]?.href;
        if (!thumb || !m.nasa_id) return null;
        return finish({
          source: 'nasa',
          externalId: `nasa:${m.nasa_id}`,
          kind: 'image',
          title: m.title || m.nasa_id,
          thumbUrl: thumb,
          mediaUrl: thumb.replace(/~thumb\.jpg$/, '~large.jpg'),
          pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(m.nasa_id)}`,
          license: 'NASA media — generally public domain (check page)',
          credit: m.photographer || m.center || 'NASA',
          dateText: m.date_created ? String(m.date_created).slice(0, 10) : null,
          yearStart: null,
          yearEnd: null,
          description: stripHtml(m.description)?.slice(0, 400) ?? null,
          categoryHint: 'photograph',
        });
      })
      .filter(Boolean) as SourceResult[];
  },
};

// ------------------------------------------------------ Unsplash (key)
const unsplash: SourceDef = {
  id: 'unsplash',
  label: 'Unsplash',
  group: 'visual',
  note: 'High-quality photography. Free key: UNSPLASH_ACCESS_KEY (50 searches/hour to start).',
  enabled: () => !!process.env.UNSPLASH_ACCESS_KEY,
  async search({ q, page }) {
    const params = new URLSearchParams({ query: q, per_page: String(PER_PAGE), page: String(page + 1), content_filter: 'high' });
    const d = await getJson(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' },
    });
    return (d.results || []).map((p: any) =>
      finish({
        source: 'unsplash',
        externalId: `unsplash:${p.id}`,
        kind: 'image',
        title: p.description || p.alt_description || `Photo by ${p.user?.name ?? 'Unsplash'}`,
        thumbUrl: p.urls?.small,
        mediaUrl: p.urls?.regular || p.urls?.full,
        pageUrl: p.links?.html || null,
        license: 'Unsplash License',
        credit: p.user?.name ? `${p.user.name} on Unsplash` : 'Unsplash',
        dateText: p.created_at ? String(p.created_at).slice(0, 10) : null,
        yearStart: null,
        yearEnd: null,
        description: p.alt_description || null,
        categoryHint: 'photography',
      }),
    );
  },
};

// -------------------------------------------------------- Pexels (key)
const pexels: SourceDef = {
  id: 'pexels',
  label: 'Pexels',
  group: 'visual',
  note: 'Free stock photography. Free key: PEXELS_API_KEY (200 searches/hour).',
  enabled: () => !!process.env.PEXELS_API_KEY,
  async search({ q, page }) {
    const params = new URLSearchParams({ query: q, per_page: String(PER_PAGE), page: String(page + 1) });
    const d = await getJson(`https://api.pexels.com/v1/search?${params}`, { headers: { Authorization: process.env.PEXELS_API_KEY || '' } });
    return (d.photos || []).map((p: any) =>
      finish({
        source: 'pexels',
        externalId: `pexels:${p.id}`,
        kind: 'image',
        title: p.alt || `Photo by ${p.photographer ?? 'Pexels'}`,
        thumbUrl: p.src?.medium,
        mediaUrl: p.src?.large2x || p.src?.original,
        pageUrl: p.url || null,
        license: 'Pexels License',
        credit: p.photographer ? `${p.photographer} on Pexels` : 'Pexels',
        dateText: null,
        yearStart: null,
        yearEnd: null,
        description: p.alt || null,
        categoryHint: 'photography',
      }),
    );
  },
};

// ------------------------------------------------------- Pixabay (key)
const pixabay: SourceDef = {
  id: 'pixabay',
  label: 'Pixabay',
  group: 'visual',
  note: 'Photos, illustrations and vectors. Free key: PIXABAY_API_KEY.',
  enabled: () => !!process.env.PIXABAY_API_KEY,
  async search({ q, page }) {
    const params = new URLSearchParams({
      key: process.env.PIXABAY_API_KEY || '',
      q: q.slice(0, 100),
      per_page: String(PER_PAGE),
      page: String(page + 1),
      safesearch: 'true',
    });
    const d = await getJson(`https://pixabay.com/api/?${params}`);
    return (d.hits || []).map((h: any) =>
      finish({
        source: 'pixabay',
        externalId: `pixabay:${h.id}`,
        kind: 'image',
        title: h.tags ? String(h.tags).split(',').slice(0, 4).join(', ') : 'Pixabay image',
        thumbUrl: h.webformatURL || h.previewURL,
        mediaUrl: h.largeImageURL || h.webformatURL,
        pageUrl: h.pageURL || null,
        license: 'Pixabay Content License',
        credit: h.user ? `${h.user} on Pixabay` : 'Pixabay',
        dateText: null,
        yearStart: null,
        yearEnd: null,
        description: h.tags || null,
        categoryHint: h.type === 'illustration' || h.type === 'vector/svg' ? 'illustration' : 'photography',
      }),
    );
  },
};

export const SOURCES: SourceDef[] = [met, commons, cleveland, artic, openverse, brave, unsplash, pexels, pixabay, nasa, smithsonian, locPhotos, locNews, archive, sketchfab];
export const SOURCE_BY_ID: Record<string, SourceDef> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
