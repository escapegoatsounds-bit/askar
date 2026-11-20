/**
 * POST /api/import-page  { url }
 * Reads a single web page you point it at and lists the images on it,
 * plus the page title, so you can pick what to keep. One page per request,
 * on demand — not a crawler.
 */
import { requireMember, json } from './_lib/auth.js';
import { safeUrl, fetchWithTimeout } from './_lib/safeUrl.js';

const MAX_HTML = 4 * 1024 * 1024;

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function youtubeId(u: URL): string | null {
  if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') || u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/)?.[2] || null;
  if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const denied = await requireMember(req);
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const target = safeUrl(typeof body?.url === 'string' ? body.url.trim() : null);
  if (!target) return json({ error: 'Paste a full link starting with http:// or https://' }, 400);

  // Videos: YouTube links become video items with a thumbnail.
  const yt = youtubeId(target);
  if (yt) {
    return json({
      kind: 'video',
      pageUrl: target.toString(),
      title: null,
      siteName: 'YouTube',
      images: [{ url: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, alt: 'Video thumbnail', video: `https://www.youtube.com/watch?v=${yt}` }],
    });
  }

  let r: Response;
  try {
    r = await fetchWithTimeout(target.toString(), { headers: { Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' } }, 15000);
  } catch {
    return json({ error: 'That page did not answer in time.' }, 504);
  }
  if (!r.ok) return json({ error: `That site answered ${r.status}. Some sites block automated readers.` }, 502);
  const type = r.headers.get('content-type') || '';
  if (type.startsWith('image/')) {
    return json({ kind: 'image', pageUrl: target.toString(), title: null, siteName: target.hostname, images: [{ url: target.toString(), alt: '' }] });
  }
  if (!type.includes('html')) return json({ error: `That link is a ${type || 'file'} — not a page or image.` }, 415);

  const html = (await r.text()).slice(0, MAX_HTML);
  const base = new URL(r.url || target.toString());
  const abs = (u: string | null) => {
    if (!u) return null;
    try {
      const x = new URL(decode(u.trim()), base);
      return x.protocol === 'http:' || x.protocol === 'https:' ? x.toString() : null;
    } catch {
      return null;
    }
  };

  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${prop}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    return tag ? attr(tag, 'content') : null;
  };
  const title = decode(meta('og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim() || null;
  const siteName = decode(meta('og:site_name') || '') || base.hostname;

  const found = new Map<string, { url: string; alt: string; width?: number }>();
  const add = (u: string | null, alt = '', width?: number) => {
    const a = abs(u);
    if (!a || /\.(svg|ico)(\?|$)/i.test(a) || /sprite|logo|icon|avatar|pixel|spacer|blank\.gif|badge/i.test(a)) return;
    if (!found.has(a)) found.set(a, { url: a, alt, width });
  };

  add(meta('og:image'), 'Main image');
  add(meta('twitter:image'), 'Main image');
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const srcset = attr(tag, 'srcset') || attr(tag, 'data-srcset');
    let best: string | null = null;
    if (srcset) {
      const parts = decode(srcset).split(',').map((p) => p.trim().split(/\s+/));
      parts.sort((a, b) => parseFloat(b[1] || '0') - parseFloat(a[1] || '0'));
      best = parts[0]?.[0] || null;
    }
    const w = parseInt(attr(tag, 'width') || '0', 10);
    if (w && w < 120) continue;
    add(best || attr(tag, 'data-src') || attr(tag, 'data-original') || attr(tag, 'src'), decode(attr(tag, 'alt') || ''), w || undefined);
  }
  for (const m of html.matchAll(/<a\b[^>]+href\s*=\s*["']([^"']+\.(?:jpe?g|png|webp|tiff?|gif))["']/gi)) add(m[1], 'Linked image');

  return json({ kind: 'page', pageUrl: base.toString(), title, siteName, images: [...found.values()].slice(0, 80) });
}
