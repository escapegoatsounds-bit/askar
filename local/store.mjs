/**
 * Askar local store: replaces Supabase with plain files on this PC.
 *
 *   <data>/db/<table>.json     one JSON array per table (readable, copyable)
 *   <data>/media/...           thumbnails and uploaded files (normal image files)
 *
 * <data> is %USERPROFILE%\Documents\Land of Rebirth Data unless LOR_DATA is set.
 *
 * The browser sends small query descriptions (see src/lib/supabase.ts) and this
 * module answers them the same way Supabase's REST API would, for the subset of
 * features Askar uses. Single user, no sign-in, no row security.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.LOR_DATA || path.join(os.homedir(), 'Documents', 'Land of Rebirth Data');
const DB_DIR = path.join(DATA_DIR, 'db');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');

// ------------------------------------------------------------------ schema
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

/** Column defaults per table (mirrors supabase/schema.sql + migrations). */
const DEFAULTS = {
  members: { role: 'editor', created_at: now },
  items: { id: uuid, kind: 'image', title: '', subjects: () => [], tags: () => [], created_at: now, updated_at: now },
  boards: { id: uuid, kind: 'mood', position: 0, created_at: now },
  board_items: { position: 0, added_at: now },
  projects: { id: uuid, desk_sync: false, created_at: now, updated_at: now },
  project_members: { role: 'editor', created_at: now },
  folders: { id: uuid, position: 0, created_at: now },
  desk_outbox: { id: uuid, tags: () => [], added_at: now, synced_at: null },
  sites: { id: 'serial', aliases: () => [], eras: () => [], priority: 0, coords_verified: true, facts: () => [], rulers: () => [], deities: () => [], sources: () => [], research_status: 'todo' },
  research_log: { id: uuid, ran_at: now, places: () => [], images_added: 0 },
  rulers: { id: 'serial', aliases: () => [], certainty: 'firm', is_group: false, mummy_status: 'none', sort: 0 },
  eras: {},
};

/** Primary key + unique columns (violations return Postgres code 23505 like Supabase). */
const KEYS = {
  members: [['email']],
  items: [['id'], ['external_id']],
  boards: [['id']],
  board_items: [['board_id', 'item_id']],
  projects: [['id']],
  project_members: [['project_id', 'email']],
  folders: [['id']],
  desk_outbox: [['id'], ['item_id']],
  sites: [['id'], ['name']],
  research_log: [['id']],
  rulers: [['id'], ['slug']],
  eras: [['id']],
};

const TOUCH = new Set(['items', 'projects']); // updated_at trigger

/** Embeds: table -> name -> how to join. one = many-to-one (object), many = one-to-many (array). */
const REL = {
  boards: {
    projects: { one: 'project_id' },
    folders: { one: 'folder_id' },
    board_items: { many: 'board_id' },
  },
  board_items: { items: { one: 'item_id' }, boards: { one: 'board_id' } },
  projects: { boards: { many: 'project_id' }, folders: { many: 'project_id' }, project_members: { many: 'project_id' } },
  items: { board_items: { many: 'item_id' } },
  folders: { boards: { many: 'folder_id' } },
  desk_outbox: { items: { one: 'item_id' }, projects: { one: 'project_id' } },
};

/** What happens to other tables when a row is deleted (foreign keys). */
const ON_DELETE = {
  items: [
    { table: 'board_items', col: 'item_id', action: 'cascade' },
    { table: 'desk_outbox', col: 'item_id', action: 'cascade' },
    { table: 'boards', col: 'cover_item', action: 'null' },
  ],
  boards: [{ table: 'board_items', col: 'board_id', action: 'cascade' }],
  projects: [
    { table: 'project_members', col: 'project_id', action: 'cascade' },
    { table: 'folders', col: 'project_id', action: 'cascade' },
    { table: 'desk_outbox', col: 'project_id', action: 'cascade' },
    { table: 'boards', col: 'project_id', action: 'null' },
  ],
  folders: [
    { table: 'folders', col: 'parent_id', action: 'cascade' },
    { table: 'boards', col: 'folder_id', action: 'null' },
  ],
};

const VIEWS = {
  era_counts: () => {
    const m = new Map();
    for (const r of table('items')) m.set(r.era_id ?? null, (m.get(r.era_id ?? null) || 0) + 1);
    return [...m].map(([era_id, n]) => ({ era_id, n }));
  },
  site_counts: () => {
    const m = new Map();
    for (const r of table('items')) {
      if (r.site == null) continue;
      const k = `${String(r.site).toLowerCase()}\u0000${r.era_id ?? ''}`;
      const cur = m.get(k) || { site_key: String(r.site).toLowerCase(), era_id: r.era_id ?? null, n: 0 };
      cur.n++;
      m.set(k, cur);
    }
    return [...m.values()];
  },
};

export const TABLES = Object.keys(DEFAULTS);

// ------------------------------------------------------------- persistence
const mem = new Map();
const dirty = new Set();
let saveTimer = null;

function ensureDirs() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export function table(name) {
  if (!mem.has(name)) {
    ensureDirs();
    const f = path.join(DB_DIR, `${name}.json`);
    let rows = [];
    if (fs.existsSync(f)) {
      const txt = fs.readFileSync(f, 'utf8');
      rows = txt.trim() ? JSON.parse(txt) : [];
    }
    mem.set(name, rows);
  }
  return mem.get(name);
}

function markDirty(name) {
  dirty.add(name);
  if (!saveTimer) saveTimer = setTimeout(flush, 150);
}

/** Write changed tables atomically (temp file + rename) so a crash never leaves half a file. */
export function flush() {
  saveTimer = null;
  ensureDirs();
  for (const name of dirty) {
    const f = path.join(DB_DIR, `${name}.json`);
    const tmp = `${f}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(mem.get(name) || [], null, 1));
    fs.renameSync(tmp, f);
  }
  dirty.clear();
}

/** Replace a whole table (used by the importer). */
export function replaceTable(name, rows) {
  mem.set(name, rows);
  markDirty(name);
}

// ------------------------------------------------------------------ errors
class DbError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// ----------------------------------------------------------------- filters
function likeToRegex(pattern, flags) {
  const esc = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, flags);
}

function get(row, col) {
  if (!col.includes('.')) return row[col];
  const [emb, c] = col.split('.');
  const v = row[emb];
  if (Array.isArray(v)) return v.map((x) => x?.[c]);
  return v?.[c];
}

function parseIs(v) {
  if (v === null || v === 'null') return null;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return v;
}

function test(row, f) {
  const v = get(row, f.col);
  const val = f.val;
  switch (f.op) {
    case 'eq': return v != null && String(v) === String(val);
    case 'neq': return v == null || String(v) !== String(val);
    case 'gt': return v != null && v > val;
    case 'gte': return v != null && v >= val;
    case 'lt': return v != null && v < val;
    case 'lte': return v != null && v <= val;
    case 'is': { const p = parseIs(val); return p === null ? v == null : v === p; }
    case 'in': return v != null && (val || []).map(String).includes(String(v));
    case 'like': return v != null && likeToRegex(val, '').test(String(v));
    case 'ilike': return v != null && likeToRegex(val, 'i').test(String(v));
    case 'contains': return Array.isArray(v) && (val || []).every((x) => v.includes(x));
    case 'overlaps': return Array.isArray(v) && (val || []).some((x) => v.includes(x));
    case 'not': return !test(row, { col: f.col, op: f.inner, val });
    case 'or': return f.list.some((g) => test(row, g));
    default: throw new DbError(`Unsupported filter "${f.op}"`);
  }
}

/** Split "a.eq.1,b.ilike.\"x,y\"" on top-level commas. */
function splitTop(s) {
  const out = [];
  let cur = '';
  let q = false;
  let depth = 0;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && ch === '(') depth++;
    if (!q && ch === ')') depth--;
    if (ch === ',' && !q && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** Parse PostgREST `or=(...)` syntax that the app uses. */
export function parseOr(s) {
  return splitTop(s).map((part) => {
    const m = part.match(/^([\w.]+)\.(not\.)?(\w+)\.(.*)$/s);
    if (!m) throw new DbError(`Cannot read filter "${part}"`);
    let [, col, neg, op, raw] = m;
    let val = raw;
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (op === 'in' || op === 'cs' || op === 'ov') {
      val = val.replace(/^[({]|[)}]$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
    }
    const mapOp = { cs: 'contains', ov: 'overlaps' }[op] || op;
    const f = { col, op: mapOp, val };
    return neg ? { col, op: 'not', inner: mapOp, val } : f;
  });
}

// ------------------------------------------------------------------ select
/** Parse "*, board_items(count), boards!inner(project_id)". */
function parseSelect(sel) {
  const cols = [];
  const embeds = [];
  for (let part of splitTop(sel || '*')) {
    part = part.trim();
    if (!part) continue;
    const m = part.match(/^(?:(\w+):)?(\w+)(!inner)?\((.*)\)$/s);
    if (m) embeds.push({ alias: m[1] || m[2], name: m[2], inner: !!m[3], sub: m[4] });
    else cols.push(part);
  }
  return { cols, embeds };
}

function project(row, cols) {
  if (cols.includes('*')) return { ...row };
  const o = {};
  for (const c of cols) o[c] = row[c] ?? null;
  return o;
}

function shape(tableName, rows, sel) {
  const { cols, embeds } = parseSelect(sel);
  return rows.map((row) => {
    const o = project(row, cols.length ? cols : embeds.length ? [] : ['*']);
    for (const e of embeds) {
      const rel = REL[tableName]?.[e.name];
      if (!rel) throw new DbError(`No relationship between ${tableName} and ${e.name}`);
      if (rel.one) {
        const target = table(e.name).find((r) => r.id === row[rel.one]) || null;
        o[e.alias] = target ? shape(e.name, [target], e.sub)[0] : null;
      } else {
        const kids = table(e.name).filter((r) => r[rel.many] === row.id);
        o[e.alias] = e.sub.trim() === 'count' ? [{ count: kids.length }] : shape(e.name, kids, e.sub);
      }
    }
    return o;
  });
}

function innerEmbeds(sel) {
  return parseSelect(sel).embeds.filter((e) => e.inner).map((e) => e.alias);
}

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last (Postgres default for ASC)
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function sortRows(rows, order) {
  if (!order?.length) return rows;
  return [...rows].sort((x, y) => {
    for (const o of order) {
      let c = cmp(get(x, o.col), get(y, o.col));
      if (c !== 0 && (get(x, o.col) == null) !== (get(y, o.col) == null)) {
        // Postgres: NULLS LAST for ASC, NULLS FIRST for DESC (unless told otherwise)
        const nullsFirst = o.nullsFirst ?? !o.ascending;
        c = get(x, o.col) == null ? (nullsFirst ? -1 : 1) : nullsFirst ? 1 : -1;
        return c;
      }
      if (c !== 0) return o.ascending === false ? -c : c;
    }
    return 0;
  });
}

// --------------------------------------------------------------- mutations
function applyDefaults(name, row) {
  const d = DEFAULTS[name] || {};
  const out = { ...row };
  for (const [k, v] of Object.entries(d)) {
    if (out[k] !== undefined) continue;
    if (v === 'serial') out[k] = table(name).reduce((m, r) => Math.max(m, Number(r[k]) || 0), 0) + 1;
    else out[k] = typeof v === 'function' ? v() : v;
  }
  return out;
}

function keyOf(row, cols) {
  if (cols.some((c) => row[c] == null)) return null; // NULLs never collide
  return JSON.stringify(cols.map((c) => row[c]));
}

function findConflict(name, row, ignoreRow) {
  for (const cols of KEYS[name] || []) {
    const k = keyOf(row, cols);
    if (k == null) continue;
    const hit = table(name).find((r) => r !== ignoreRow && keyOf(r, cols) === k);
    if (hit) return { hit, cols };
  }
  return null;
}

function deleteRows(name, victims) {
  if (!victims.length) return;
  const set = new Set(victims);
  replaceTable(name, table(name).filter((r) => !set.has(r)));
  for (const fk of ON_DELETE[name] || []) {
    const ids = new Set(victims.map((v) => v.id));
    const rows = table(fk.table).filter((r) => ids.has(r[fk.col]));
    if (!rows.length) continue;
    if (fk.action === 'cascade') deleteRows(fk.table, rows);
    else {
      for (const r of rows) r[fk.col] = null;
      markDirty(fk.table);
    }
  }
}

// ------------------------------------------------------------------- query
/**
 * q = { table, action: select|insert|update|upsert|delete, select, filters, order,
 *       limit, offset, values, onConflict, ignoreDuplicates, count, head, returning }
 * Returns { data, count } or throws DbError.
 */
export function run(q) {
  const name = q.table;
  const isView = !!VIEWS[name];
  if (!isView && !DEFAULTS[name]) throw new DbError(`Unknown table "${name}"`, '42P01');
  const filters = (q.filters || []).map((f) => (f.op === 'or_raw' ? { col: '', op: 'or', list: parseOr(String(f.val)) } : f));

  const matching = () => {
    const base = isView ? VIEWS[name]() : table(name);
    const embedFilters = filters.filter((f) => f.col.includes('.'));
    const plain = filters.filter((f) => !f.col.includes('.'));
    if (q.action !== 'select' && embedFilters.length) throw new DbError('Filters on embedded tables only work when reading');
    let rows = base.filter((r) => plain.every((f) => test(r, f)));
    return { rows, embedFilters };
  };

  if (q.action === 'select') {
    let { rows, embedFilters } = matching();
    let shaped = shape(name, rows, q.select);
    // Filters on embedded columns (e.g. boards.project_id with boards!inner)
    if (embedFilters.length) {
      const inner = new Set(innerEmbeds(q.select));
      const keep = [];
      shaped.forEach((s, i) => {
        if (embedFilters.every((f) => test(s, f))) keep.push(i);
        else if (!inner.has(f0(embedFilters))) keep.push(i); // non-inner: keep row (PostgREST nulls the embed)
      });
      rows = keep.map((i) => rows[i]);
      shaped = keep.map((i) => shaped[i]);
    }
    // sort on original rows (so ordering by un-selected columns works), then reshape
    const idx = sortRows(rows.map((r, i) => ({ ...r, __i: i })), q.order).map((r) => r.__i);
    let out = idx.map((i) => shaped[i]);
    const count = out.length;
    const offset = q.offset || 0;
    if (q.limit != null) out = out.slice(offset, offset + q.limit);
    else if (offset) out = out.slice(offset);
    return { data: q.head ? null : out, count };
  }

  if (isView) throw new DbError(`${name} is read-only`);

  if (q.action === 'insert' || q.action === 'upsert') {
    const values = Array.isArray(q.values) ? q.values : [q.values];
    const written = [];
    const rows = table(name);
    for (const v of values) {
      if (q.action === 'upsert') {
        const cols = q.onConflict ? q.onConflict.split(',').map((s) => s.trim()) : KEYS[name][0];
        const k = keyOf(v, cols);
        const hit = k != null && rows.find((r) => keyOf(r, cols) === k);
        if (hit) {
          if (!q.ignoreDuplicates) {
            Object.assign(hit, v);
            if (TOUCH.has(name)) hit.updated_at = now();
          }
          written.push(hit);
          continue;
        }
      }
      const row = applyDefaults(name, v);
      const c = findConflict(name, row);
      if (c) throw new DbError(`duplicate key value violates unique constraint "${name}_${c.cols.join('_')}_key"`, '23505');
      rows.push(row);
      written.push(row);
    }
    markDirty(name);
    return { data: q.returning ? shape(name, written, q.select || '*') : null, count: written.length };
  }

  if (q.action === 'update') {
    const { rows } = matching();
    for (const r of rows) {
      const next = { ...r, ...q.values };
      const c = findConflict(name, next, r);
      if (c) throw new DbError(`duplicate key value violates unique constraint "${name}_${c.cols.join('_')}_key"`, '23505');
    }
    for (const r of rows) {
      Object.assign(r, q.values);
      if (TOUCH.has(name)) r.updated_at = now();
    }
    if (rows.length) markDirty(name);
    return { data: q.returning ? shape(name, rows, q.select || '*') : null, count: rows.length };
  }

  if (q.action === 'delete') {
    if (!filters.length) throw new DbError('Refusing to delete a whole table without a filter');
    const { rows } = matching();
    const data = q.returning ? shape(name, rows, q.select || '*') : null;
    deleteRows(name, rows);
    return { data, count: rows.length };
  }

  throw new DbError(`Unknown action "${q.action}"`);
}

function f0(list) {
  return list[0].col.split('.')[0];
}

// --------------------------------------------------------------------- rpc
export function rpc(fn) {
  switch (fn) {
    case 'has_access':
    case 'is_member':
    case 'is_owner':
      return true;
    case 'project_role':
      return 'owner';
    default:
      throw new DbError(`Unknown function "${fn}"`);
  }
}

// ------------------------------------------------------------------- media
/** Resolve a storage path inside MEDIA_DIR, refusing anything that escapes it. */
export function mediaPath(p) {
  const clean = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').some((s) => s === '..' || s === '')) return null;
  const full = path.resolve(MEDIA_DIR, clean);
  if (!full.startsWith(path.resolve(MEDIA_DIR) + path.sep)) return null;
  return full;
}

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' };
export const typeFor = (f) => TYPES[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream';

// ------------------------------------------------------------ http handler
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json' });

/**
 * Connect-style middleware for /local/*:
 *   POST /local/db                 { query } -> { data, count, error }
 *   POST /local/rpc/<fn>           -> value
 *   GET|PUT|DELETE /local/files/<path>
 * Returns true if it handled the request.
 */
export async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/local/')) return false;
  try {
    if (url.pathname === '/local/db' && req.method === 'POST') {
      const q = JSON.parse((await readBody(req)).toString('utf8'));
      try {
        const r = run(q);
        sendJson(res, 200, { data: r.data, count: r.count, error: null });
      } catch (e) {
        sendJson(res, 200, { data: null, count: null, error: { message: e.message, code: e.code || 'LOCAL' } });
      }
      return true;
    }
    if (url.pathname.startsWith('/local/rpc/') && req.method === 'POST') {
      const fn = url.pathname.slice('/local/rpc/'.length);
      try {
        sendJson(res, 200, { data: rpc(fn), error: null });
      } catch (e) {
        sendJson(res, 200, { data: null, error: { message: e.message } });
      }
      return true;
    }
    if (url.pathname.startsWith('/local/files/')) {
      const full = mediaPath(decodeURIComponent(url.pathname.slice('/local/files/'.length)));
      if (!full) return sendJson(res, 400, { error: 'Bad path' }), true;
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (!fs.existsSync(full)) return send(res, 404, 'Not found'), true;
        const st = fs.statSync(full);
        res.statusCode = 200;
        res.setHeader('Content-Type', typeFor(full));
        res.setHeader('Content-Length', st.size);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        if (req.method === 'HEAD') return res.end(), true;
        fs.createReadStream(full).pipe(res);
        return true;
      }
      if (req.method === 'PUT') {
        const upsert = url.searchParams.get('upsert') === '1';
        if (fs.existsSync(full) && !upsert) return sendJson(res, 409, { error: 'The resource already exists' }), true;
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, await readBody(req));
        return sendJson(res, 200, { path: url.pathname.slice('/local/files/'.length) }), true;
      }
      if (req.method === 'DELETE') {
        if (fs.existsSync(full)) fs.unlinkSync(full);
        return sendJson(res, 200, { ok: true }), true;
      }
    }
    if (url.pathname === '/local/exists' && req.method === 'POST') {
      const paths = JSON.parse((await readBody(req)).toString('utf8'));
      const out = {};
      for (const p of Array.isArray(paths) ? paths : []) {
        const full = mediaPath(p);
        out[p] = !!full && fs.existsSync(full);
      }
      return sendJson(res, 200, out), true;
    }
    if (url.pathname === '/local/info') {
      return sendJson(res, 200, { dataDir: DATA_DIR, tables: Object.fromEntries(TABLES.map((t) => [t, table(t).length])) }), true;
    }
    sendJson(res, 404, { error: 'Unknown local route' });
    return true;
  } catch (e) {
    sendJson(res, 500, { error: String(e?.message || e) });
    return true;
  }
}

process.on('exit', () => {
  if (dirty.size) flush();
});
