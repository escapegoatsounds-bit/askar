/**
 * Keep saved images on this PC, so they still show without internet or if
 * the original website removes them.
 *
 * For every image item whose files are not on disk yet:
 *   - downloads the original (media_url, else thumb_url) -> media/originals/<id>.<ext>, sets storage_path
 *   - makes the small WebP thumbnail -> media/<thumb_path> (or a new thumbs/offline/<id>.webp)
 * The web links (media_url / source_url) are kept, so credit and source stay intact.
 */
import { supabase, BUCKET } from './supabase';
import { fetchRemoteImage, makeThumb, extFor } from './thumbs';
import type { Item } from './types';

async function onDisk(paths: string[]): Promise<Record<string, boolean>> {
  if (!paths.length) return {};
  const r = await fetch('/local/exists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paths) });
  return r.json();
}

export interface OfflineReport {
  checked: number;
  alreadyLocal: number;
  saved: number;
  failed: { id: string; title: string; error: string }[];
}

export async function keepImagesOffline(onProgress?: (done: number, total: number, title: string) => void): Promise<OfflineReport> {
  const { data, error } = await supabase.from('items').select('*').eq('kind', 'image');
  if (error) throw new Error(error.message);
  const items = (data || []) as Item[];
  const have = await onDisk(items.flatMap((i) => [i.storage_path, i.thumb_path].filter(Boolean) as string[]));
  const report: OfflineReport = { checked: items.length, alreadyLocal: 0, saved: 0, failed: [] };

  for (let n = 0; n < items.length; n++) {
    const it = items[n];
    onProgress?.(n, items.length, it.title);
    const needOriginal = !(it.storage_path && have[it.storage_path]);
    const needThumb = !(it.thumb_path && have[it.thumb_path]);
    if (!needOriginal && !needThumb) {
      report.alreadyLocal++;
      continue;
    }
    const remote = it.media_url || it.thumb_url;
    if (!remote) {
      report.failed.push({ id: it.id, title: it.title, error: 'no web link to download from' });
      continue;
    }
    try {
      const blob = await fetchRemoteImage(remote);
      const patch: Partial<Item> = {};
      if (needOriginal) {
        const p = `originals/${it.id}.${extFor(blob.type)}`;
        const up = await supabase.storage.from(BUCKET).upload(p, blob, { contentType: blob.type, upsert: true });
        if (up.error) throw new Error(up.error.message);
        patch.storage_path = p;
      }
      if (needThumb) {
        const t = await makeThumb(blob);
        const p = it.thumb_path || `thumbs/offline/${it.id}.${extFor(t.type)}`;
        const up = await supabase.storage.from(BUCKET).upload(p, t, { contentType: t.type, upsert: true });
        if (up.error) throw new Error(up.error.message);
        if (p !== it.thumb_path) patch.thumb_path = p;
      }
      if (Object.keys(patch).length) {
        const u = await supabase.from('items').update(patch).eq('id', it.id);
        if (u.error) throw new Error(u.error.message);
      }
      report.saved++;
    } catch (e) {
      report.failed.push({ id: it.id, title: it.title, error: (e as Error).message });
    }
  }
  onProgress?.(items.length, items.length, '');
  return report;
}
