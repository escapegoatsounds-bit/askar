/**
 * Sites that can't be searched from inside the app (no public search API
 * for other apps — checked Nov 2026). We open their own search with the
 * query filled in; finds come back via Share (Android), paste/drop a link,
 * or the "Save to Askar" bookmark button.
 */
type Site = { id: string; label: string; url: (q: string) => string; note: string };

const via = (domain: string) => (q: string) => `https://www.google.com/search?tbm=isch&q=site%3A${domain}+${q}`;

const GROUPS: { id: string; title: string; sites: Site[] }[] = [
  {
    id: 'inspiration',
    title: 'Inspiration & moodboards',
    sites: [
      { id: 'pinterest', label: 'Pinterest', url: (q) => `https://www.pinterest.com/search/pins/?q=${q}`, note: 'Everything, endlessly' },
      { id: 'savee', label: 'Savee', url: (q) => `https://savee.com/search/?q=${q}`, note: 'Curated visuals' },
      { id: 'cosmos', label: 'Cosmos', url: (q) => `https://www.cosmos.so/search?q=${q}`, note: 'Visual collections' },
      { id: 'arena', label: 'Are.na', url: (q) => `https://www.are.na/search/${q}`, note: 'Research boards' },
      { id: 'behance', label: 'Behance', url: (q) => `https://www.behance.net/search/projects?search=${q}`, note: 'Design & illustration projects' },
      { id: 'dribbble', label: 'Dribbble', url: (q) => `https://dribbble.com/search/${q}`, note: 'UI, branding, motion' },
    ],
  },
  {
    id: 'photo',
    title: 'Photography',
    sites: [
      { id: '500px', label: '500px', url: (q) => `https://500px.com/search?q=${q}&type=photos`, note: 'Pro photography' },
      { id: 'unsplash', label: 'Unsplash', url: (q) => `https://unsplash.com/s/photos/${q}`, note: 'Free high-res photos' },
      { id: 'flickr', label: 'Flickr', url: (q) => `https://www.flickr.com/search/?text=${q}`, note: 'Travel & site photos' },
      { id: 'getty', label: 'Getty (editorial)', url: (q) => `https://www.gettyimages.com/search/2/image?phrase=${q}&family=editorial`, note: 'News & historic photos' },
      { id: 'shotdeck', label: 'Film stills', url: via('film-grab.com'), note: 'FilmGrab via Google' },
    ],
  },
  {
    id: 'cg',
    title: '3D, CG & concept art',
    sites: [
      { id: 'artstation', label: 'ArtStation', url: (q) => `https://www.artstation.com/search?sort_by=relevance&query=${q}`, note: 'Concept art & 3D' },
      { id: '3dtotal', label: '3dtotal', url: via('3dtotal.com'), note: 'CG galleries (via Google)' },
      { id: 'sketchfab', label: 'Sketchfab', url: (q) => `https://sketchfab.com/search?q=${q}&type=models`, note: '3D models & scans' },
      { id: 'cgtrader', label: 'CGTrader', url: (q) => `https://www.cgtrader.com/3d-models?keywords=${q}`, note: '3D model library' },
      { id: 'polyhaven', label: 'Poly Haven', url: (q) => `https://polyhaven.com/all?s=${q}`, note: 'Free textures & HDRIs' },
    ],
  },
  {
    id: 'ai',
    title: 'AI imagery',
    sites: [
      { id: 'lexica', label: 'Lexica', url: (q) => `https://lexica.art/?q=${q}`, note: 'AI images + prompts' },
      { id: 'civitai', label: 'Civitai', url: (q) => `https://civitai.com/search/images?query=${q}`, note: 'Community AI art' },
      { id: 'midjourney', label: 'Midjourney', url: (q) => `https://www.midjourney.com/explore?tab=top&search=${q}`, note: 'Explore (sign-in needed)' },
    ],
  },
  {
    id: 'stock',
    title: 'Stock & design assets',
    sites: [
      { id: 'canva', label: 'Canva photos', url: (q) => `https://www.canva.com/photos/search/${q}/`, note: 'Stock library' },
      { id: 'freepik', label: 'Freepik', url: (q) => `https://www.freepik.com/search?query=${q}`, note: 'Vectors & photos' },
      { id: 'adobestock', label: 'Adobe Stock', url: (q) => `https://stock.adobe.com/search?k=${q}`, note: 'Premium stock' },
    ],
  },
  {
    id: 'engines',
    title: 'Search engines',
    sites: [
      { id: 'google', label: 'Google Images', url: (q) => `https://www.google.com/search?tbm=isch&q=${q}`, note: 'Widest net' },
      { id: 'bing', label: 'Bing Images', url: (q) => `https://www.bing.com/images/search?q=${q}`, note: 'Second opinion' },
      { id: 'yandex', label: 'Yandex Images', url: (q) => `https://yandex.com/images/search?text=${q}`, note: 'Great for look-alikes' },
    ],
  },
];

export function ElsewhereSearch({ query, egypt, mode = 'visual' }: { query: string; egypt: boolean; mode?: 'visual' | 'history' }) {
  const term = query.trim();
  const full = egypt && term && !/egypt/i.test(term) ? `${term} egypt` : term;
  const enc = encodeURIComponent(full);
  // History mode: lead with search engines and Pinterest; visual mode shows everything.
  const groups = mode === 'history' ? GROUPS.filter((g) => ['engines', 'inspiration', 'photo'].includes(g.id)) : GROUPS;
  return (
    <section className="elsewhere">
      <div className="section-head">
        <h3>Search elsewhere{full ? <> for “{full}”</> : ''}</h3>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="elsewhere-group">
          <div className="elsewhere-title">{g.title}</div>
          <div className="elsewhere-grid">
            {g.sites.map((s) => (
              <a
                key={s.id}
                className={`elsewhere-btn ${term ? '' : 'disabled'}`}
                href={term ? s.url(enc) : undefined}
                target="_blank"
                rel="noreferrer noopener"
                aria-disabled={!term}
                onClick={(e) => !term && e.preventDefault()}
              >
                <b>{s.label} ↗</b>
                <small>{s.note}</small>
              </a>
            ))}
          </div>
        </div>
      ))}
      <p className="muted small">
        These sites don't let other apps search them, so they open in a new tab. Found something? <b>Phone:</b> Share → Askar.{' '}
        <b>Computer:</b> drag the image onto a board, paste its link below, or use the <a href="/add#bookmark">Save to Askar button</a>.
      </p>
    </section>
  );
}
