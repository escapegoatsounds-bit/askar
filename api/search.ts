/** GET /api/search?q=khufu&sources=met,commons&page=0&egypt=1 */
import { requireMember, json } from './_lib/auth.js';
import { SOURCES, SOURCE_BY_ID } from './_lib/sources.js';

export async function GET(req: Request): Promise<Response> {
  const denied = await requireMember(req);
  if (denied) return denied;

  const url = new URL(req.url);
  if (url.searchParams.get('list') === '1') {
    return json({ sources: SOURCES.map((s) => ({ id: s.id, label: s.label, note: s.note, group: s.group ?? 'both', enabled: s.enabled() })) });
  }

  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  if (!q) return json({ error: 'Type something to search for.' }, 400);
  const page = Math.max(0, Math.min(50, parseInt(url.searchParams.get('page') || '0', 10) || 0));
  const egyptOnly = url.searchParams.get('egypt') !== '0';
  const wanted = (url.searchParams.get('sources') || 'met,commons')
    .split(',')
    .map((s) => SOURCE_BY_ID[s.trim()])
    .filter((s) => s && s.enabled());

  const settled = await Promise.allSettled(wanted.map((s) => s.search({ q, page, egyptOnly })));
  const results: unknown[] = [];
  const errors: Record<string, string> = {};
  const counts: Record<string, number> = {};
  settled.forEach((r, i) => {
    const id = wanted[i].id;
    if (r.status === 'fulfilled') {
      counts[id] = r.value.length;
      results.push(...r.value);
    } else {
      errors[id] = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  });

  // Interleave sources so one source doesn't flood the top of the list.
  const bySource: Record<string, any[]> = {};
  for (const r of results as any[]) (bySource[r.source] ||= []).push(r);
  const mixed: unknown[] = [];
  const lists = Object.values(bySource);
  for (let i = 0; lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i]) mixed.push(l[i]);

  return json({ results: mixed, errors, counts, page }, 200, { 'Cache-Control': 'private, max-age=300' });
}
