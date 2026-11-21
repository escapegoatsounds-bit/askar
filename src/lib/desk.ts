/**
 * Bridge to the "Land of Rebirth Production Desk" artifact.
 * When an image is pinned to a board in a project with `desk_sync` on,
 * we queue it in `desk_outbox` with a ready-to-upload JPEG and its
 * metadata. The Desk pulls the queue (via the viewer's Supabase
 * connector), uploads each image, lets Claude describe it, and feeds it
 * into its prompts.
 */
import { supabase } from './supabase';
import { itemBlob } from './download';
import type { Item } from './types';

/** Askar era id -> the Desk's age id (its AGES list). */
export const ERA_TO_DESK_AGE: Record<string, string> = {
  predynastic: 'prehistoric',
  'early-dynastic': 'early-dynastic',
  'old-kingdom': 'old-kingdom',
  fip: 'middle-kingdom', // the Desk has no intermediate periods; reunification belongs with the MK
  'middle-kingdom': 'middle-kingdom',
  sip: 'new-kingdom', // Theban 17th dynasty leads straight into the NK
  'new-kingdom': 'new-kingdom',
  tip: 'late-persian',
  'late-period': 'late-persian',
  ptolemaic: 'ptolemaic',
  roman: 'roman',
  'byzantine-coptic': 'coptic-byzantine',
  'early-islamic': 'early-islamic',
  fatimid: 'fatimid',
  'ayyubid-mamluk': 'ayyubid-mamluk',
  ottoman: 'ottoman',
  khedivate: 'modern',
  republic: 'modern',
};

const syncCache = new Map<string, { projectId: string | null; sync: boolean }>();

async function boardDesk(boardId: string): Promise<{ projectId: string | null; sync: boolean }> {
  const hit = syncCache.get(boardId);
  if (hit) return hit;
  const { data } = await supabase.from('boards').select('project_id, projects(desk_sync)').eq('id', boardId).maybeSingle();
  const out = { projectId: (data as any)?.project_id ?? null, sync: !!(data as any)?.projects?.desk_sync };
  syncCache.set(boardId, out);
  return out;
}

/** Shrink to max 1280px JPEG as a data URL (keeps the queue small). */
async function toJpegDataUrl(blob: Blob, maxSide = 1280): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}

/** Queue items for the Desk. Safe to call for any board; does nothing unless its project syncs. */
export async function queueForDesk(boardId: string, itemIds: string[], note?: string | null): Promise<{ queued: number; failed: number }> {
  const { projectId, sync } = await boardDesk(boardId);
  if (!sync || !projectId || !itemIds.length) return { queued: 0, failed: 0 };
  const { data: existing } = await supabase.from('desk_outbox').select('item_id').in('item_id', itemIds);
  const have = new Set((existing || []).map((r: any) => r.item_id));
  const todo = itemIds.filter((id) => !have.has(id));
  if (!todo.length) return { queued: 0, failed: 0 };
  const { data: items } = await supabase.from('items').select('*').in('id', todo);
  let queued = 0;
  let failed = 0;
  for (const it of (items || []) as Item[]) {
    // Videos only reach the Desk once they come from an official channel or passed a fact-check (their thumbnail is sent).
    if (it.kind === 'video' ? !(it.verification === 'official' || it.verification === 'verified') : it.kind !== 'image' && it.kind !== 'document') continue;
    try {
      const image_b64 = await toJpegDataUrl(await itemBlob(it));
      const notes = [note, it.notes].filter(Boolean).join(' ').trim() || null;
      const { error } = await supabase.from('desk_outbox').insert({
        item_id: it.id,
        project_id: projectId,
        image_b64,
        title: it.title,
        notes,
        era_id: it.era_id,
        desk_age: it.era_id ? ERA_TO_DESK_AGE[it.era_id] ?? null : null,
        site: it.site,
        category: it.category,
        source_name: it.source_name,
        source_url: it.source_url,
        license: it.license,
        credit: it.credit,
        tags: [...(it.tags || []), ...(it.subjects || [])],
      });
      if (error && error.code !== '23505') throw error;
      if (!error) queued++;
    } catch (e) {
      console.warn('[desk] could not queue', it.id, e);
      failed++;
    }
  }
  return { queued, failed };
}

/** Pins already in a syncing project that never reached the queue (e.g. pinned before linking). */
export async function backfillProject(projectId: string, onProgress?: (msg: string) => void): Promise<{ queued: number; failed: number }> {
  const { data } = await supabase.from('board_items').select('board_id, item_id, boards!inner(project_id)').eq('boards.project_id', projectId);
  const byBoard = new Map<string, string[]>();
  for (const r of (data || []) as any[]) byBoard.set(r.board_id, [...(byBoard.get(r.board_id) || []), r.item_id]);
  let queued = 0;
  let failed = 0;
  for (const [bid, ids] of byBoard) {
    onProgress?.(`Preparing ${queued + failed + 1}…`);
    const r = await queueForDesk(bid, ids);
    queued += r.queued;
    failed += r.failed;
  }
  return { queued, failed };
}

export async function deskStatus(projectId: string): Promise<{ waiting: number; synced: number }> {
  const [w, s] = await Promise.all([
    supabase.from('desk_outbox').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('synced_at', null),
    supabase.from('desk_outbox').select('id', { count: 'exact', head: true }).eq('project_id', projectId).not('synced_at', 'is', null),
  ]);
  return { waiting: w.count ?? 0, synced: s.count ?? 0 };
}

export function forgetDeskCache() {
  syncCache.clear();
}
