/**
 * The Land of Rebirth Production Desk, served from this PC (step 3 of the local-first plan).
 *
 * The Desk page (desk/index.html) was written for the claude.ai artifact runtime. Here we serve the
 * same page unchanged and inject /desk/local-runtime.js, which provides the runtime pieces the page
 * asks for (database, file uploads, the Askar link) by calling the routes below.
 *
 *   GET  /desk/                      the Desk page (+ runtime script)
 *   GET  /desk/<file>                repo desk/<file>, else <data>/desk-files/<file> (map art, moodboard, seeds)
 *   GET  /_blob/<id>                 an uploaded Desk file (records store these URLs)
 *   GET  /local/desk/db/<col>        every record of a collection
 *   PUT  /local/desk/db/<col>/<id>   save one record (?merge=1 merges into the existing one)
 *   DELETE /local/desk/db/<col>/<id>
 *   POST /local/desk/files           upload (body = file bytes) -> { id, url }
 *   DELETE /local/desk/files/<id>
 *   POST /local/desk/askar-sql       { query } -> rows; only the Desk's three "Sync from Askar" statements
 *   POST /local/desk/ai              { prompt, json } -> { text } from the chosen engine: Claude Code on this PC
 *                                    (no tools) or Gemini (owner's key); GET|PUT .../ai/settings, GET .../ai/gemini-models
 *   GET  /local/desk/comfy/status    ComfyUI on this PC: up?, GPU, still-image checkpoints, custom workflow?
 *   POST /local/desk/comfy/generate  { prompt, negative, width, height, steps, cfg, count, ckpt, seed } -> { promptId, seed }
 *   GET  /local/desk/comfy/job/<id>  queued | running | done (images saved as Desk files: [{ id, url }]) | error
 *
 * Storage: <data>/desk/db/<collection>/<id>.json (one readable file per record, same layout as the
 * backup) and <data>/desk/files/<id>.<ext>. On first run both are filled from <data>/desk-backup/.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, run as runQuery, typeFor } from './store.mjs';
import { ask as askClaude, status as claudeStatus, SYSTEM as AI_SYSTEM } from './claude-engine.mjs';
import { askGemini, listGeminiModels, DEFAULT_GEMINI_MODEL } from './gemini-engine.mjs';
import { comfyStatus, comfyGenerate, comfyJob } from './comfy.mjs';

/** ComfyUI jobs already turned into Desk files (promptId -> [{ id, url }]), so repeated polls return the same images. */
const comfyDone = new Map();

const DESK_DIR = path.join(DATA_DIR, 'desk');
const DB_DIR = path.join(DESK_DIR, 'db');
const FILES_DIR = path.join(DESK_DIR, 'files');
const EXTRA_DIR = path.join(DATA_DIR, 'desk-files'); // files the published Desk had that are not in the repo
const BACKUP_DIR = path.join(DATA_DIR, 'desk-backup', 'desk');

const COLLECTION = /^[a-z][a-z0-9_]{0,40}$/;
const SAFE_ID = /^[A-Za-z0-9_.-]{1,200}$/;
const BLOB_ID = /^[A-Za-z0-9_-]{1,80}$/;

const MORE_TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', woff2: 'font/woff2', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav' };
const contentType = (f) => MORE_TYPES[path.extname(f).slice(1).toLowerCase()] || typeFor(f);
const EXT_FOR = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'application/pdf': 'pdf' };

// Record ids become file names; anything unusual is hex-encoded so it can never leave its folder.
const idToFile = (id) => (SAFE_ID.test(id) && id !== '.' && id !== '..' ? id : 'x-' + Buffer.from(String(id), 'utf8').toString('hex')) + '.json';
const fileToId = (f) => {
  const base = f.replace(/\.json$/, '');
  return base.startsWith('x-') && /^x-[0-9a-f]+$/.test(base) ? Buffer.from(base.slice(2), 'hex').toString('utf8') : base;
};

/** Copy the backup in on first run (never overwrites anything already here). */
let initDone = false;
function init() {
  if (initDone) return;
  initDone = true;
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
  const srcDb = path.join(BACKUP_DIR, 'database');
  if (fs.existsSync(srcDb) && !fs.readdirSync(DB_DIR).length) {
    fs.cpSync(srcDb, DB_DIR, { recursive: true, force: false, errorOnExist: false });
    console.log(`[desk] first run: copied the Desk records from ${srcDb}`);
  }
  const srcFiles = path.join(BACKUP_DIR, 'uploaded-files');
  if (fs.existsSync(srcFiles) && !fs.readdirSync(FILES_DIR).length) {
    fs.cpSync(srcFiles, FILES_DIR, { recursive: true, force: false, errorOnExist: false });
    console.log(`[desk] first run: copied the Desk's uploaded files from ${srcFiles}`);
  }
}

// ------------------------------------------------------------------ records
function readCollection(col) {
  const dir = path.join(DB_DIR, col);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('.')) continue;
    try {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '');
      if (!txt.trim()) continue;
      out.push({ id: fileToId(f), ...JSON.parse(txt) });
    } catch (e) {
      console.warn(`[desk] skipped unreadable record ${col}/${f}: ${e.message}`);
    }
  }
  return out;
}

function recordPath(col, id) {
  return path.join(DB_DIR, col, idToFile(id));
}

function writeRecord(col, id, value, merge) {
  const f = recordPath(col, id);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  let next = value;
  if (merge && fs.existsSync(f)) {
    try {
      next = { ...JSON.parse(fs.readFileSync(f, 'utf8')), ...value };
    } catch {
      /* unreadable old record: replace it */
    }
  }
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, f); // atomic: a crash never leaves half a record
}

// -------------------------------------------------------------------- files
function blobFile(id) {
  if (!BLOB_ID.test(id) || !fs.existsSync(FILES_DIR)) return null;
  const hit = fs.readdirSync(FILES_DIR).find((f) => f === id || f.startsWith(id + '.'));
  return hit ? path.join(FILES_DIR, hit) : null;
}

/** A file under `base`, or null if the path tries to leave it. */
function inside(base, rel) {
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').some((s) => s === '..' || s === '')) return null;
  const full = path.resolve(base, clean);
  return full.startsWith(path.resolve(base) + path.sep) ? full : null;
}

// --------------------------------------------------------------- AI engine
/**
 * Which AI writes for the Desk: "claude" (Claude Code on this PC, the owner's Claude subscription) or
 * "gemini" (Google Gemini API with the owner's key). Kept in <data>\desk\ai-engine.json on this PC only;
 * the key is never sent back to the page.
 */
const ENGINE_FILE = path.join(DESK_DIR, 'ai-engine.json');
function readEngine() {
  try {
    const e = JSON.parse(fs.readFileSync(ENGINE_FILE, 'utf8'));
    return { provider: e.provider === 'gemini' ? 'gemini' : 'claude', gemini: { key: String(e.gemini?.key || ''), model: String(e.gemini?.model || DEFAULT_GEMINI_MODEL) } };
  } catch {
    return { provider: 'claude', gemini: { key: '', model: DEFAULT_GEMINI_MODEL } };
  }
}
function writeEngine(e) {
  fs.mkdirSync(DESK_DIR, { recursive: true });
  const tmp = ENGINE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(e, null, 2));
  fs.renameSync(tmp, ENGINE_FILE);
}
/** What the page may see: never the key itself. */
function publicEngine() {
  const e = readEngine();
  return { provider: e.provider, gemini: { model: e.gemini.model, hasKey: !!e.gemini.key, keyEnd: e.gemini.key ? e.gemini.key.slice(-4) : '' } };
}
async function askAI(prompt, { json } = {}) {
  const e = readEngine();
  if (e.provider === 'gemini') return askGemini(prompt, { key: e.gemini.key, model: e.gemini.model, system: AI_SYSTEM, json });
  return askClaude(prompt);
}

// ---------------------------------------------------------------- Askar link
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Desk's "⟳ Sync from Askar" sends three fixed SQL statements (written for Supabase). Locally the
 * outbox is Askar's own desk_outbox table, so answer exactly those three shapes and refuse anything else.
 */
export function askarSql(query) {
  const q = String(query || '').replace(/\s+/g, ' ').trim();
  let m = q.match(/^select ([\w, ]+) from public\.desk_outbox where synced_at is null order by added_at limit (\d+)$/i);
  if (m) {
    const cols = m[1].split(',').map((c) => c.trim()).filter((c) => /^\w+$/.test(c) && c !== 'image_b64');
    const { data } = runQuery({ table: 'desk_outbox', action: 'select', select: cols.join(','), filters: [{ col: 'synced_at', op: 'is', val: null }], order: [{ col: 'added_at', ascending: true }], limit: Math.min(Number(m[2]), 100) });
    return data;
  }
  m = q.match(/^select image_b64 from public\.desk_outbox where id ?= ?'([^']+)'$/i);
  if (m && UUID.test(m[1])) {
    return runQuery({ table: 'desk_outbox', action: 'select', select: 'image_b64', filters: [{ col: 'id', op: 'eq', val: m[1] }] }).data;
  }
  m = q.match(/^update public\.desk_outbox set synced_at ?= ?now\(\), desk_mood_id ?= ?'([A-Za-z0-9_-]{1,80})' where id ?= ?'([^']+)'$/i);
  if (m && UUID.test(m[2])) {
    runQuery({ table: 'desk_outbox', action: 'update', values: { synced_at: new Date().toISOString(), desk_mood_id: m[1] }, filters: [{ col: 'id', op: 'eq', val: m[2] }] });
    return [];
  }
  throw new Error('The local Desk only runs its own "Sync from Askar" statements.');
}

// --------------------------------------------------------------------- http
async function readBody(req, limit = 200 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > limit) throw new Error('Too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function send(res, status, body, type) {
  res.statusCode = status;
  if (type) res.setHeader('Content-Type', type);
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json');

function sendFile(req, res, full, cache) {
  const st = fs.statSync(full);
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType(full));
  res.setHeader('Content-Length', st.size);
  res.setHeader('Cache-Control', cache);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(full).pipe(res);
}

/**
 * Connect-style middleware. `root` is the repo folder (where desk/ and local/ live).
 * Returns true when it answered the request.
 */
export function createDeskHandler({ root }) {
  const deskSrc = path.join(root, 'desk');
  const runtimeFile = path.join(root, 'local', 'desk-runtime.js');

  return async function handleDesk(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    if (!(p === '/desk' || p.startsWith('/desk/') || p.startsWith('/_blob/') || p.startsWith('/local/desk/'))) return false;
    try {
      init();
      if (p === '/desk') {
        res.statusCode = 302;
        res.setHeader('Location', '/desk/' + url.search);
        return res.end(), true;
      }
      if (p === '/desk/' || p === '/desk/index.html') {
        let html = fs.readFileSync(path.join(deskSrc, 'index.html'), 'utf8');
        // The runtime must exist before the page's own scripts run.
        html = html.replace(/<head([^>]*)>/i, (h) => `${h}\n<script src="/desk/local-runtime.js"></script>`);
        // Version-stamp the Desk's own code files so a browser never runs a stale cached copy after an update.
        html = html.replace(/src="(desk-[\w-]+\.js)"/g, (m, f) => {
          try { return `src="${f}?v=${Math.round(fs.statSync(path.join(deskSrc, f)).mtimeMs)}"`; } catch { return m; }
        });
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 200, html, 'text/html; charset=utf-8'), true;
      }
      if (p === '/desk/local-runtime.js') {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 200, fs.readFileSync(runtimeFile), 'text/javascript; charset=utf-8'), true;
      }
      if (p.startsWith('/desk/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed'), true;
        const rel = p.slice('/desk/'.length);
        for (const base of [deskSrc, EXTRA_DIR]) {
          const full = inside(base, rel);
          // code and data are re-checked every time (they change); map art and images may be cached for an hour
          if (full && fs.existsSync(full) && fs.statSync(full).isFile()) return sendFile(req, res, full, /\.(js|css|html|json)$/i.test(full) ? 'no-cache' : 'private, max-age=3600'), true;
        }
        return send(res, 404, 'Not found'), true;
      }
      if (p.startsWith('/_blob/')) {
        const full = blobFile(p.slice('/_blob/'.length));
        if (!full) return send(res, 404, 'Not found'), true;
        return sendFile(req, res, full, 'private, max-age=86400'), true;
      }

      // ---- /local/desk/*
      const parts = p.slice('/local/desk/'.length).split('/');
      if (parts[0] === 'db') {
        const [, col, id] = parts;
        if (!COLLECTION.test(col || '')) return sendJson(res, 400, { error: 'Bad collection' }), true;
        if (!id && req.method === 'GET') return sendJson(res, 200, readCollection(col)), true;
        if (!id || parts.length > 3) return sendJson(res, 400, { error: 'Bad record id' }), true;
        if (req.method === 'GET') {
          const f = recordPath(col, id);
          return fs.existsSync(f) ? sendJson(res, 200, { id, ...JSON.parse(fs.readFileSync(f, 'utf8')) }) : sendJson(res, 404, null), true;
        }
        if (req.method === 'PUT') {
          const value = JSON.parse((await readBody(req, 50 * 1024 * 1024)).toString('utf8'));
          if (!value || typeof value !== 'object' || Array.isArray(value)) return sendJson(res, 400, { error: 'A record must be an object' }), true;
          writeRecord(col, id, value, url.searchParams.get('merge') === '1');
          return sendJson(res, 200, { ok: true }), true;
        }
        if (req.method === 'DELETE') {
          const f = recordPath(col, id);
          if (fs.existsSync(f)) fs.unlinkSync(f);
          return sendJson(res, 200, { ok: true }), true;
        }
        return sendJson(res, 405, { error: 'Method not allowed' }), true;
      }
      if (parts[0] === 'files') {
        if (req.method === 'POST' && parts.length === 1) {
          const body = await readBody(req);
          const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
          const nameExt = path.extname(String(req.headers['x-file-name'] || '')).slice(1).toLowerCase();
          const ext = EXT_FOR[type] || (/^[a-z0-9]{1,5}$/.test(nameExt) ? nameExt : 'bin');
          const id = crypto.randomBytes(16).toString('hex');
          fs.writeFileSync(path.join(FILES_DIR, `${id}.${ext}`), body);
          return sendJson(res, 200, { id, url: `/_blob/${id}` }), true;
        }
        if (req.method === 'DELETE' && parts.length === 2) {
          const full = blobFile(parts[1]);
          if (full) fs.unlinkSync(full);
          return sendJson(res, 200, { ok: true }), true;
        }
        return sendJson(res, 405, { error: 'Method not allowed' }), true;
      }
      if (parts[0] === 'askar-sql' && req.method === 'POST') {
        const { query } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
        try {
          return sendJson(res, 200, { rows: askarSql(query) }), true;
        } catch (e) {
          return sendJson(res, 200, { error: String(e.message || e) }), true;
        }
      }
      if (parts[0] === 'ai' || parts[0] === 'claude') {
        // The Desk's AI: Claude Code on this PC or Gemini, whichever is chosen (text only). "claude" = older name.
        if (parts.length === 1 && req.method === 'POST') {
          const { prompt, json } = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8'));
          if (!prompt || typeof prompt !== 'string') return sendJson(res, 400, { error: 'No prompt' }), true;
          try {
            return sendJson(res, 200, { text: await askAI(prompt, { json: !!json }), provider: readEngine().provider }), true;
          } catch (e) {
            return sendJson(res, 200, { error: String(e.message || e), code: e.code || 'engine_error' }), true;
          }
        }
        if (parts[1] === 'settings' && req.method === 'GET') {
          return sendJson(res, 200, { ...publicEngine(), claude: claudeStatus() }), true;
        }
        if (parts[1] === 'settings' && req.method === 'PUT') {
          const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
          const cur = readEngine();
          if (body.provider === 'claude' || body.provider === 'gemini') cur.provider = body.provider;
          if (typeof body.geminiModel === 'string' && /^[a-z0-9][a-z0-9.-]{1,60}$/i.test(body.geminiModel.replace(/^models\//, ''))) cur.gemini.model = body.geminiModel.replace(/^models\//, '');
          if (typeof body.geminiKey === 'string') cur.gemini.key = body.geminiKey.trim(); // "" removes it
          writeEngine(cur);
          return sendJson(res, 200, publicEngine()), true;
        }
        if (parts[1] === 'gemini-models' && req.method === 'GET') {
          try {
            return sendJson(res, 200, { models: await listGeminiModels(readEngine().gemini.key) }), true;
          } catch (e) {
            return sendJson(res, 200, { error: String(e.message || e), code: e.code || 'engine_error' }), true;
          }
        }
        return sendJson(res, 405, { error: 'Method not allowed' }), true;
      }
      if (parts[0] === 'comfy') {
        // ComfyUI on this PC: generate scene reference images (see comfy.mjs)
        try {
          if (parts[1] === 'status' && req.method === 'GET') return sendJson(res, 200, await comfyStatus()), true;
          if (parts[1] === 'generate' && req.method === 'POST') {
            const opts = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
            return sendJson(res, 200, await comfyGenerate(opts)), true;
          }
          if (parts[1] === 'job' && parts[2] && req.method === 'GET') {
            const pid = parts[2];
            if (comfyDone.has(pid)) return sendJson(res, 200, { state: 'done', images: comfyDone.get(pid) }), true;
            const j = await comfyJob(pid);
            if (j.state !== 'done') return sendJson(res, 200, j), true;
            const images = j.files.map((f) => {
              const id = crypto.randomBytes(16).toString('hex');
              const ext = (path.extname(f.name).slice(1).toLowerCase() || 'png').replace(/[^a-z0-9]/g, '');
              fs.writeFileSync(path.join(FILES_DIR, `${id}.${ext}`), f.bytes);
              return { id, url: `/_blob/${id}` };
            });
            comfyDone.set(pid, images);
            return sendJson(res, 200, { state: 'done', images }), true;
          }
          return sendJson(res, 405, { error: 'Method not allowed' }), true;
        } catch (e) {
          return sendJson(res, 200, { error: String(e.message || e), code: e.code || 'comfy_error' }), true;
        }
      }
      if (parts[0] === 'info') {
        return sendJson(res, 200, { dataDir: DESK_DIR, collections: fs.existsSync(DB_DIR) ? fs.readdirSync(DB_DIR) : [] }), true;
      }
      return sendJson(res, 404, { error: 'Unknown Desk route' }), true;
    } catch (e) {
      sendJson(res, 500, { error: String(e?.message || e) });
      return true;
    }
  };
}
