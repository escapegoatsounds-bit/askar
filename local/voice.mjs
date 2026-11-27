/**
 * /voice/* -> the voice service on this PC (E:\EscapegoatStudio\tools\voice_server.py, 127.0.0.1:8765).
 * Starts the service the first time the Writer's Room asks for a voice; it keeps running in the background
 * (and frees the GPU by itself after 10 idle minutes). Hooked into Vite by vite.config.ts.
 *
 * Override the locations with LOR_VOICE_PY (python.exe of the voice engine) and LOR_VOICE_SERVER (the script).
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 8765;
const PY = process.env.LOR_VOICE_PY || 'E:\\EscapegoatStudio\\tools\\tts-env\\Scripts\\python.exe';
const SCRIPT = process.env.LOR_VOICE_SERVER || 'E:\\EscapegoatStudio\\tools\\voice_server.py';
const LOG = path.join(os.homedir(), 'Documents', 'Land of Rebirth Data', 'logs', 'voice-server.log');

function ping() {
  return new Promise((resolve) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    r.on('error', () => resolve(false));
    r.on('timeout', () => { r.destroy(); resolve(false); });
  });
}

/** Is anything listening on the port? While the engine loads its models it can be too busy to answer /health in
 *  time; then it is busy, not gone, and starting a second copy would double-bind the port on Windows (requests
 *  would land on the new copy, which knows none of the jobs: "unknown job"). */
function listening() {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: PORT });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(1000, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

let starting = null;
async function ensureRunning() {
  if (await ping()) return true;
  if (await listening()) return true;            // busy loading: let the request wait for it
  if (!starting) {
    starting = (async () => {
      if (!fs.existsSync(PY) || !fs.existsSync(SCRIPT)) return false;
      fs.mkdirSync(path.dirname(LOG), { recursive: true });
      const out = fs.openSync(LOG, 'a');
      const p = spawn(PY, ['-u', SCRIPT, '--port', String(PORT)], {
        cwd: path.dirname(SCRIPT), detached: true, windowsHide: true, stdio: ['ignore', out, out],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      p.unref();
      for (let i = 0; i < 60; i++) {          // the service itself starts in a few seconds (the engine loads later)
        await new Promise((r) => setTimeout(r, 500));
        if (await ping()) return true;
      }
      return false;
    })().finally(() => { starting = null; });
  }
  return starting;
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// The narrator's voice choice lives with the rest of the owner's data, not in the repo or the browser.
const SETTINGS = path.join(os.homedir(), 'Documents', 'Land of Rebirth Data', 'desk', 'voice.json');

async function settings(req, res) {
  if (req.method === 'GET') {
    try { return sendJson(res, 200, JSON.parse(fs.readFileSync(SETTINGS, 'utf8'))); } catch (_) { return sendJson(res, 200, {}); }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let v;
  try { v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (_) { return sendJson(res, 400, { error: 'bad json' }); }
  if (!v || typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > 4000) return sendJson(res, 400, { error: 'bad settings' });
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS + '.tmp', JSON.stringify(v, null, 1));
  fs.renameSync(SETTINGS + '.tmp', SETTINGS);
  return sendJson(res, 200, { ok: true });
}

/** Connect middleware. Anything outside /voice/ goes to next(). `root` (the repo) is accepted for symmetry; all
 *  paths here are absolute (engine on E:, settings in Documents), so nothing depends on where the config is bundled. */
export function voiceMiddleware(_opts = {}) {
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/voice/')) return next();
    if (req.url.split('?')[0] === '/voice/settings' && (req.method === 'GET' || req.method === 'POST')) {
      return settings(req, res);
    }
    if (!(await ensureRunning())) {
      return sendJson(res, 503, {
        error: 'The voice engine could not start. Check that E:\\EscapegoatStudio\\tools\\tts-env exists. ' +
               'Details: Documents\\Land of Rebirth Data\\logs\\voice-server.log',
      });
    }
    const up = http.request({
      host: '127.0.0.1', port: PORT, method: req.method, path: req.url.slice('/voice'.length),
      // pass the body length on: voice_server.py (http.server) reads exactly Content-Length bytes, so without it
      // the body arrives empty ("no text")
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        ...(req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {}),
      },
    }, (r) => {
      res.statusCode = r.statusCode || 502;
      for (const h of ['content-type', 'content-length', 'cache-control']) if (r.headers[h]) res.setHeader(h, r.headers[h]);
      r.pipe(res);
    });
    up.on('error', (e) => sendJson(res, 502, { error: 'Voice engine: ' + e.message }));
    req.pipe(up);
  };
}
