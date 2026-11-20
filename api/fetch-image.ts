/**
 * GET /api/fetch-image?url=...
 * Fetches a remote image for a signed-in member so the browser can make a
 * thumbnail from it (browsers block that for most other sites otherwise).
 */
import { requireMember, json } from './_lib/auth.js';
import { safeUrl, fetchWithTimeout } from './_lib/safeUrl.js';

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(req: Request): Promise<Response> {
  const denied = await requireMember(req);
  if (denied) return denied;

  const target = safeUrl(new URL(req.url).searchParams.get('url'));
  if (!target) return json({ error: 'That link is not allowed.' }, 400);

  let r: Response;
  try {
    r = await fetchWithTimeout(target.toString(), { headers: { Accept: 'image/*,*/*;q=0.5', Referer: target.origin + '/' } }, 15000);
  } catch {
    return json({ error: 'The image server did not answer in time.' }, 504);
  }
  if (!r.ok) return json({ error: `The image server answered ${r.status}.` }, 502);
  const type = r.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return json({ error: `That link is not an image (${type || 'unknown type'}).` }, 415);
  const len = Number(r.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return json({ error: 'Image is larger than 25 MB.' }, 413);

  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json({ error: 'Image is larger than 25 MB.' }, 413);
  return new Response(buf, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } });
}
