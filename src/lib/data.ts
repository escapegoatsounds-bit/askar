import { supabase, BUCKET } from './supabase';
import { makeThumb, fetchRemoteImage, extFor } from './thumbs';
import type { Board, BoardItem, BoardWithMeta, Draft, Folder, Item, Member, Place, Project, ProjectMember } from './types';

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// ------------------------------------------------------------------ items
export interface ItemQuery {
  eraId?: string | null;
  category?: string | null;
  kind?: string | null;
  text?: string;
  subject?: string | null;
  limit?: number;
  offset?: number;
}

export async function listItems(q: ItemQuery = {}): Promise<Item[]> {
  let req = supabase.from('items').select('*').order('created_at', { ascending: false });
  if (q.eraId === 'none') req = req.is('era_id', null);
  else if (q.eraId) req = req.eq('era_id', q.eraId);
  if (q.category) req = req.eq('category', q.category);
  if (q.kind) req = req.eq('kind', q.kind);
  if (q.subject) req = req.contains('subjects', [q.subject]);
  const text = (q.text || '').replace(/[%,()*\\]/g, ' ').trim();
  if (text) {
    const p = `%${text}%`;
    req = req.or(`title.ilike.${p},site.ilike.${p},notes.ilike.${p},description.ilike.${p},credit.ilike.${p}`);
  }
  const limit = q.limit ?? 60;
  const offset = q.offset ?? 0;
  return must(await req.range(offset, offset + limit - 1)) as Item[];
}

export async function getItem(id: string): Promise<Item> {
  return must(await supabase.from('items').select('*').eq('id', id).single()) as Item;
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<Item> {
  return must(await supabase.from('items').update(patch).eq('id', id).select().single()) as Item;
}

export async function deleteItem(item: Item): Promise<void> {
  must(await supabase.from('items').delete().eq('id', item.id));
  const paths = [item.thumb_path, item.storage_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

export async function eraCounts(): Promise<Record<string, number>> {
  const rows = must(await supabase.from('era_counts').select('*')) as { era_id: string | null; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.era_id ?? 'none', r.n]));
}

export async function knownExternalIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = must(await supabase.from('items').select('external_id').in('external_id', ids)) as { external_id: string }[];
  return new Set(rows.map((r) => r.external_id));
}

export async function allSubjects(): Promise<string[]> {
  const rows = must(await supabase.from('items').select('subjects').limit(2000)) as { subjects: string[] }[];
  const s = new Set<string>();
  for (const r of rows) for (const x of r.subjects || []) s.add(x);
  return [...s].sort((a, b) => a.localeCompare(b));
}

export async function allSites(): Promise<string[]> {
  const rows = must(await supabase.from('items').select('site').not('site', 'is', null).limit(2000)) as { site: string }[];
  return [...new Set(rows.map((r) => r.site).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export interface SaveMeta {
  eraId: string | null | undefined; // undefined = use each draft's guess, null = undated
  category: string | null | undefined; // undefined = use each draft's guess
  site: string;
  subjects: string[];
  tags: string[];
  notes: string;
  boardId: string | null;
  angle: string | null;
}

function uid(): string {
  return crypto.randomUUID();
}

/**
 * Save drafts: store a small thumbnail in our bucket (so previews survive
 * if a website disappears), keep remote images as links, and upload own
 * files in full.
 */
export async function saveDrafts(
  drafts: Draft[],
  meta: SaveMeta,
  onProgress?: (done: number, total: number, note?: string) => void,
): Promise<{ saved: Item[]; warnings: string[] }> {
  const saved: Item[] = [];
  const warnings: string[] = [];
  const month = new Date().toISOString().slice(0, 7);

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    onProgress?.(i, drafts.length, d.title);
    const id = uid();
    let thumb_path: string | null = null;
    let storage_path: string | null = null;

    try {
      let source: Blob | null = null;
      if (d.file) {
        storage_path = `uploads/${month}/${id}.${extFor(d.file.type)}`;
        const up = await supabase.storage.from(BUCKET).upload(storage_path, d.file, { contentType: d.file.type, upsert: false });
        if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
        source = d.file;
      } else if (d.thumbUrl || d.remoteUrl) {
        source = await fetchRemoteImage((d.thumbUrl || d.remoteUrl)!);
      }
      if (source) {
        try {
          const t = await makeThumb(source);
          const p = `thumbs/${month}/${id}.${extFor(t.type)}`;
          const up = await supabase.storage.from(BUCKET).upload(p, t, { contentType: t.type, upsert: false });
          if (!up.error) thumb_path = p;
        } catch {
          // e.g. HEIC on some browsers — the full upload is still saved
        }
      }
    } catch (e) {
      if (d.file) {
        warnings.push(`${d.title}: ${(e as Error).message}`);
        continue;
      }
      warnings.push(`${d.title}: saved as link only (${(e as Error).message})`);
    }

    const row = {
      id,
      kind: d.kind,
      title: d.title || 'Untitled',
      description: d.description ?? null,
      source_name: d.sourceName ?? (d.file ? 'Upload' : null),
      source_url: d.pageUrl ?? null,
      media_url: d.remoteUrl ?? null,
      thumb_url: d.thumbUrl ?? null,
      thumb_path,
      storage_path,
      external_id: d.externalId ?? null,
      license: d.license ?? null,
      credit: d.credit ?? null,
      era_id: meta.eraId === undefined ? d.eraGuess ?? null : meta.eraId,
      date_text: d.dateText ?? null,
      year_start: d.yearStart ?? null,
      year_end: d.yearEnd ?? null,
      category: meta.category === undefined ? d.categoryGuess ?? null : meta.category,
      site: meta.site.trim() || d.siteGuess || null,
      subjects: meta.subjects,
      tags: meta.tags,
      notes: meta.notes.trim() || null,
    };
    const res = await supabase.from('items').insert(row).select().single();
    if (res.error) {
      if (res.error.code === '23505') warnings.push(`${d.title}: already in the archive`);
      else warnings.push(`${d.title}: ${res.error.message}`);
      const paths = [thumb_path, storage_path].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      continue;
    }
    saved.push(res.data as Item);
  }

  if (meta.boardId && saved.length) {
    await addToBoard(meta.boardId, saved.map((s) => s.id), meta.angle);
  }
  onProgress?.(drafts.length, drafts.length);
  return { saved, warnings };
}

// ----------------------------------------------------------------- boards
export async function listBoards(filter: { projectId?: string | null; folderId?: string | null } = {}): Promise<BoardWithMeta[]> {
  let req = supabase.from('boards').select('*, board_items(count)').order('position').order('created_at', { ascending: false });
  if (filter.projectId) req = req.eq('project_id', filter.projectId);
  if (filter.folderId === null) req = req.is('folder_id', null);
  else if (filter.folderId) req = req.eq('folder_id', filter.folderId);
  const rows = must(await req) as any[];
  return rows.map((r) => ({ ...r, count: r.board_items?.[0]?.count ?? 0 }));
}

export async function getBoard(id: string): Promise<Board> {
  return must(await supabase.from('boards').select('*').eq('id', id).single()) as Board;
}

export async function createBoard(b: Partial<Board>): Promise<Board> {
  return must(await supabase.from('boards').insert(b).select().single()) as Board;
}

export async function updateBoard(id: string, patch: Partial<Board>): Promise<Board> {
  return must(await supabase.from('boards').update(patch).eq('id', id).select().single()) as Board;
}

export async function deleteBoard(id: string): Promise<void> {
  must(await supabase.from('boards').delete().eq('id', id));
}

export async function boardItems(boardId: string): Promise<BoardItem[]> {
  const rows = must(
    await supabase.from('board_items').select('*, items(*)').eq('board_id', boardId).order('position').order('added_at', { ascending: false }),
  ) as BoardItem[];
  return rows.filter((r) => r.items);
}

/** Save a new manual order (Pinterest-style drag to rearrange). */
export async function reorderBoard(boardId: string, itemIds: string[]): Promise<void> {
  await Promise.all(
    itemIds.map((item_id, position) => supabase.from('board_items').update({ position }).eq('board_id', boardId).eq('item_id', item_id)),
  );
}

export async function setPinNote(boardId: string, itemId: string, note: string | null): Promise<void> {
  must(await supabase.from('board_items').update({ note }).eq('board_id', boardId).eq('item_id', itemId));
  // If it's still waiting for the Desk, carry the note across too.
  await supabase.from('desk_outbox').update({ notes: note }).eq('item_id', itemId).is('synced_at', null);
}

export async function boardsForItem(itemId: string): Promise<{ board_id: string; angle: string | null }[]> {
  return must(await supabase.from('board_items').select('board_id, angle').eq('item_id', itemId)) as any[];
}

export async function addToBoard(boardId: string, itemIds: string[], angle: string | null = null): Promise<void> {
  const rows = itemIds.map((item_id) => ({ board_id: boardId, item_id, angle }));
  must(await supabase.from('board_items').upsert(rows, { onConflict: 'board_id,item_id', ignoreDuplicates: false }));
  // Boards in a Desk-linked project also queue their pins for the Land of Rebirth Desk (in the background).
  import('./desk').then((d) => d.queueForDesk(boardId, itemIds)).catch((e) => console.warn('[desk]', e));
}

export async function removeFromBoard(boardId: string, itemId: string): Promise<void> {
  must(await supabase.from('board_items').delete().eq('board_id', boardId).eq('item_id', itemId));
}

export async function setAngle(boardId: string, itemId: string, angle: string | null): Promise<void> {
  must(await supabase.from('board_items').update({ angle }).eq('board_id', boardId).eq('item_id', itemId));
}

// ---------------------------------------------------------------- members
export async function listMembers(): Promise<Member[]> {
  return must(await supabase.from('members').select('*').order('created_at')) as Member[];
}

export async function addMember(email: string, role: 'owner' | 'editor', invitedBy: string): Promise<void> {
  must(await supabase.from('members').insert({ email: email.trim().toLowerCase(), role, invited_by: invitedBy }));
}

export async function removeMember(email: string): Promise<void> {
  must(await supabase.from('members').delete().eq('email', email));
}

export async function setRole(email: string, role: 'owner' | 'editor'): Promise<void> {
  must(await supabase.from('members').update({ role }).eq('email', email));
}

// ------------------------------------------------------------------ map
export async function siteCounts(): Promise<{ site_key: string; era_id: string | null; n: number }[]> {
  return must(await supabase.from('site_counts').select('*')) as any[];
}

/** Items whose place matches a site's name or any alias (case-insensitive). */
export async function itemsAtSite(names: string[], eraId?: string | null, limit = 48): Promise<Item[]> {
  const ors = names.map((n) => `site.ilike."${n.replace(/["\\%_]/g, '')}"`).join(',');
  let req = supabase.from('items').select('*').or(ors).order('created_at', { ascending: false }).limit(limit);
  if (eraId) req = req.eq('era_id', eraId);
  return must(await req) as Item[];
}

// --------------------------------------------------------------- projects
export async function listProjects(): Promise<(Project & { boards: number })[]> {
  const rows = must(await supabase.from('projects').select('*, boards(count)').order('updated_at', { ascending: false })) as any[];
  return rows.map((r) => ({ ...r, boards: r.boards?.[0]?.count ?? 0 }));
}

export async function getProject(id: string): Promise<Project> {
  return must(await supabase.from('projects').select('*').eq('id', id).single()) as Project;
}

export async function createProject(p: Partial<Project>): Promise<Project> {
  return must(await supabase.from('projects').insert(p).select().single()) as Project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  return must(await supabase.from('projects').update(patch).eq('id', id).select().single()) as Project;
}

export async function deleteProject(id: string): Promise<void> {
  // Boards in the project are deleted too (their pins stay in the library).
  must(await supabase.from('boards').delete().eq('project_id', id));
  must(await supabase.from('projects').delete().eq('id', id));
}

export async function myProjectRole(projectId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const { data } = await supabase.rpc('project_role', { pid: projectId });
  return (data as any) ?? null;
}

// ---------------------------------------------------------------- folders
export async function listFolders(projectId: string): Promise<Folder[]> {
  return must(await supabase.from('folders').select('*').eq('project_id', projectId).order('position').order('name')) as Folder[];
}

export async function createFolder(projectId: string, name: string, parentId: string | null): Promise<Folder> {
  return must(await supabase.from('folders').insert({ project_id: projectId, name, parent_id: parentId }).select().single()) as Folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  must(await supabase.from('folders').update({ name }).eq('id', id));
}

export async function deleteFolder(id: string): Promise<void> {
  // Boards inside move up to the project root (folder_id is set null by the database).
  must(await supabase.from('folders').delete().eq('id', id));
}

export async function moveBoard(boardId: string, projectId: string | null, folderId: string | null): Promise<void> {
  must(await supabase.from('boards').update({ project_id: projectId, folder_id: folderId }).eq('id', boardId));
}

// ---------------------------------------------------------- collaborators
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return must(await supabase.from('project_members').select('*').eq('project_id', projectId).order('created_at')) as ProjectMember[];
}

export async function inviteToProject(projectId: string, email: string, role: 'owner' | 'editor' | 'viewer'): Promise<void> {
  must(await supabase.from('project_members').insert({ project_id: projectId, email: email.trim().toLowerCase(), role }));
}

export async function setProjectRole(projectId: string, email: string, role: 'owner' | 'editor' | 'viewer'): Promise<void> {
  must(await supabase.from('project_members').update({ role }).eq('project_id', projectId).eq('email', email));
}

export async function removeFromProject(projectId: string, email: string): Promise<void> {
  must(await supabase.from('project_members').delete().eq('project_id', projectId).eq('email', email));
}

// --------------------------------------------------------------- realtime
/** Call `onChange` whenever pins or boards change (by anyone). Returns an unsubscribe function. */
export function subscribe(channel: string, tables: { table: string; filter?: string }[], onChange: () => void): () => void {
  let ch = supabase.channel(channel);
  for (const t of tables) {
    ch = ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: t.table, ...(t.filter ? { filter: t.filter } : {}) }, () => onChange());
  }
  ch.subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

// ----------------------------------------------------------------- places
export async function listPlaces(): Promise<Place[]> {
  return must(await supabase.from('sites').select('*').order('priority', { ascending: false }).order('name')) as Place[];
}

export async function getPlace(name: string): Promise<Place | null> {
  const { data, error } = await supabase.from('sites').select('*').eq('name', name).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Place | null;
}

/** Ask the scheduled research to do this place next. */
export async function requestResearch(id: number, again = false): Promise<void> {
  const patch: Record<string, unknown> = { research_requested_at: new Date().toISOString() };
  if (again) patch.research_status = 'todo';
  must(await supabase.from('sites').update(patch).eq('id', id));
}

export async function lastResearchRuns(limit = 5): Promise<{ ran_at: string; places: string[]; summary: string | null; images_added: number }[]> {
  return must(await supabase.from('research_log').select('*').order('ran_at', { ascending: false }).limit(limit)) as any[];
}
