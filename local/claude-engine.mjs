/**
 * Claude for the local Desk, through Claude Code on this PC (the owner's Claude subscription).
 *
 * The Desk's in-page AI (Break into frames, Fill fields, Research brief, YouTube notes...) calls
 * window.claude.use("sample"). Locally that ends up here: we run Claude Code in print mode with NO tools,
 * NO MCP servers and no saved session, in an empty working folder, so a request can only produce text.
 *
 * Which Claude Code: LOR_CLAUDE (a full path), else `claude` on PATH, else the newest copy bundled with
 * the Claude desktop app (%LOCALAPPDATA%\Claude-Data\*\claude-code\<version>\<hash>\claude.exe).
 * It must be signed in once:  "<that claude.exe>" auth login   (see local/Sign-In-Claude.cmd).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { DATA_DIR } from './store.mjs';

const WORK_DIR = path.join(DATA_DIR, 'desk', 'claude-work'); // empty folder: no project files or CLAUDE.md get loaded
const MAX_PARALLEL = 2;
const TIMEOUT_MS = 12 * 60 * 1000;

export const SYSTEM = [
  'You are the writing engine of the "Land of Rebirth" Production Desk, a tool for a narrated documentary series about Egyptian history.',
  'Do exactly what the message asks, in English. When it asks for JSON, reply with that JSON only: no code fences, no commentary before or after.',
  'Be historically careful and never invent documents, quotes or sources.',
].join(' ');

function versionKey(v) {
  return String(v).split('.').map((n) => String(Number(n) || 0).padStart(6, '0')).join('.');
}

/** Find a Claude Code executable. Returns a path or null. */
export function findClaude() {
  const cands = [];
  if (process.env.LOR_CLAUDE) cands.push(process.env.LOR_CLAUDE);
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['claude'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    cands.push(...out.split(/\r?\n/).map((s) => s.trim()).filter((s) => /\.(exe|cmd)$/i.test(s) || process.platform !== 'win32'));
  } catch {
    /* not on PATH */
  }
  cands.push(path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude'));
  const base = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Claude-Data');
  try {
    const bundled = [];
    for (const app of fs.readdirSync(base)) {
      const cc = path.join(base, app, 'claude-code');
      if (!fs.existsSync(cc)) continue;
      for (const ver of fs.readdirSync(cc)) {
        const vdir = path.join(cc, ver);
        if (!fs.statSync(vdir).isDirectory()) continue;
        for (const h of fs.readdirSync(vdir)) {
          const exe = path.join(vdir, h, 'claude.exe');
          if (fs.existsSync(exe)) bundled.push({ exe, ver });
        }
      }
    }
    bundled.sort((a, b) => (versionKey(b.ver) > versionKey(a.ver) ? 1 : -1));
    cands.push(...bundled.map((b) => b.exe));
  } catch {
    /* no desktop app copy */
  }
  return cands.find((c) => c && fs.existsSync(c)) || null;
}

class EngineError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

let running = 0;
const waiting = [];
async function slot() {
  if (running < MAX_PARALLEL) {
    running++;
    return;
  }
  await new Promise((r) => waiting.push(r));
  running++;
}
function release() {
  running--;
  const next = waiting.shift();
  if (next) next();
}

function signInHelp(exe) {
  return `Claude Code on this PC isn't signed in. Double-click "Sign-In-Claude.cmd" in the Askar folder's "local" folder (or run: "${exe}" auth login), sign in with your Claude account, then try again.`;
}

/**
 * Ask Claude. Resolves to the reply text. Errors carry a code:
 *   no_engine, not_signed_in, rate_limited, timeout, engine_error
 */
export async function ask(prompt, { model } = {}) {
  const exe = findClaude();
  if (!exe) throw new EngineError('Claude Code was not found on this PC. Install the Claude desktop app (or Claude Code), sign in, then try again.', 'no_engine');
  fs.mkdirSync(WORK_DIR, { recursive: true });
  await slot();
  try {
    const args = ['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--system-prompt', SYSTEM];
    if (model) args.push('--model', model);
    const { code, out, err, timedOut } = await new Promise((resolve) => {
      const child = spawn(exe, args, { cwd: WORK_DIR, windowsHide: true, env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'land-of-rebirth-desk' } });
      let out = '';
      let err = '';
      let timedOut = false;
      const t = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, TIMEOUT_MS);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => {
        clearTimeout(t);
        resolve({ code: -1, out, err: String(e.message || e), timedOut });
      });
      child.on('close', (c) => {
        clearTimeout(t);
        resolve({ code: c, out, err, timedOut });
      });
      child.stdin.end(String(prompt), 'utf8'); // stdin: no command-line length limit
    });
    if (timedOut) throw new EngineError('Claude took too long (over 12 minutes) and was stopped. Try a smaller job.', 'timeout');
    let res = null;
    try {
      res = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop() || 'null');
    } catch {
      /* not JSON */
    }
    const text = res && typeof res.result === 'string' ? res.result : '';
    if (!res || res.is_error) {
      const why = text || err.trim() || out.trim() || `Claude Code exited with code ${code}`;
      if (/not logged in|\/login|auth login|invalid api key|oauth/i.test(why)) throw new EngineError(signInHelp(exe), 'not_signed_in');
      if (/rate.?limit|usage limit|429|overloaded/i.test(why)) throw new EngineError('Your Claude usage limit is reached or Claude is busy. Wait a while and try again.', 'rate_limited');
      throw new EngineError('Claude Code: ' + why.slice(0, 400), 'engine_error');
    }
    return text;
  } finally {
    release();
  }
}

/** Is Claude Code here, and signed in? (Runs `auth status`; no model call.) */
export function status() {
  const exe = findClaude();
  if (!exe) return { found: false, signedIn: false, path: null };
  let out = '';
  try {
    out = execFileSync(exe, ['auth', 'status', '--json'], { encoding: 'utf8', timeout: 20000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stdout || ''); // exits non-zero when signed out, still printing the JSON
  }
  let signedIn = false;
  try {
    signedIn = JSON.parse(out).loggedIn === true;
  } catch {
    /* unreadable: treat as signed out */
  }
  return { found: true, signedIn, path: exe, help: signedIn ? '' : signInHelp(exe) };
}
