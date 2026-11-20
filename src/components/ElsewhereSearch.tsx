/**
 * Sites that can't be searched from inside the app (no public search API).
 * We open their own search with the query filled in; finds come back via
 * Share (Android), paste-a-link, or the "Save to Askar" bookmark button.
 */
const SITES: { id: string; label: string; url: (q: string) => string; note: string }[] = [
  { id: 'google', label: 'Google Images', url: (q) => `https://www.google.com/search?tbm=isch&q=${q}`, note: 'Widest net' },
  { id: 'pinterest', label: 'Pinterest', url: (q) => `https://www.pinterest.com/search/pins/?q=${q}`, note: 'Mood & reconstructions' },
  { id: 'savee', label: 'Savee', url: (q) => `https://savee.com/search/?q=${q}`, note: 'Curated visuals' },
  { id: 'canva', label: 'Canva photos', url: (q) => `https://www.canva.com/photos/search/${q}/`, note: 'Stock library' },
  { id: 'cosmos', label: 'Cosmos', url: (q) => `https://www.cosmos.so/search?q=${q}`, note: 'Visual moodboards' },
  { id: 'arena', label: 'Are.na', url: (q) => `https://www.are.na/search/${q}`, note: 'Research boards' },
  { id: 'flickr', label: 'Flickr', url: (q) => `https://www.flickr.com/search/?text=${q}`, note: 'Travel & site photos' },
  { id: 'getty', label: 'Getty (editorial)', url: (q) => `https://www.gettyimages.com/search/2/image?phrase=${q}&family=editorial`, note: 'Historic news photos' },
  { id: 'bing', label: 'Bing Images', url: (q) => `https://www.bing.com/images/search?q=${q}`, note: 'Second opinion' },
  { id: 'yandex', label: 'Yandex Images', url: (q) => `https://yandex.com/images/search?text=${q}`, note: 'Great for look-alikes' },
];

export function ElsewhereSearch({ query, egypt }: { query: string; egypt: boolean }) {
  const term = query.trim();
  const full = egypt && term && !/egypt/i.test(term) ? `${term} egypt` : term;
  const enc = encodeURIComponent(full);
  return (
    <section className="elsewhere">
      <div className="section-head">
        <h3>Search elsewhere{full ? <> for “{full}”</> : ''}</h3>
      </div>
      <div className="elsewhere-grid">
        {SITES.map((s) => (
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
      <p className="muted small">
        These sites don't let other apps search them, so they open in a new tab. Found something? <b>Phone:</b> Share → Askar.{' '}
        <b>Computer:</b> copy the link and paste it below, or use the <a href="/add#bookmark">Save to Askar button</a>.
      </p>
    </section>
  );
}
