/*
 * Land of Rebirth Desk: local runtime.
 * The Desk page was written for the claude.ai artifact runtime (window.claude.use(...)). When the local
 * Askar app serves the Desk at /desk/, this file is loaded first and provides the same pieces from this PC
 * (see local/desk.mjs for the server side):
 *   db      records in Documents\Land of Rebirth Data\desk\db
 *   assets  uploaded images/videos in ...\desk\files (served as /_blob/<id>)
 *   mcp     only the Desk's "Sync from Askar" statements, answered from Askar's local outbox
 *   tts     this PC's own voices (browser speech)
 *   sample  Claude through Claude Code on this PC (text only, no image reading yet)
 */
(function () {
  'use strict';
  if (window.claude) return; // inside claude.ai the real runtime is already there

  async function asJson(r) {
    if (!r.ok) {
      let msg = r.status + ' ' + r.statusText;
      try { msg = (await r.json()).error || msg; } catch (_) { /* not JSON */ }
      throw new Error(msg);
    }
    return r.json();
  }

  // ------------------------------------------------------------- database
  // A collection is read once when the Desk subscribes. The Desk updates its own state before every save,
  // so saves are not echoed back (an echo could replace text typed after the save started).
  const db = {
    collection(col) {
      return {
        onSnapshot(cb, onErr) {
          let live = true;
          fetch('/local/desk/db/' + encodeURIComponent(col), { cache: 'no-store' })
            .then(asJson)
            .then((rows) => { if (live) cb(rows); })
            .catch((e) => { if (live && onErr) onErr(e); });
          return () => { live = false; };
        },
        async get() {
          return asJson(await fetch('/local/desk/db/' + encodeURIComponent(col), { cache: 'no-store' }));
        },
        doc(id) { return db.doc(col + '/' + id); },
      };
    },
    doc(p) {
      const cut = String(p).indexOf('/');
      const col = String(p).slice(0, cut);
      const id = String(p).slice(cut + 1);
      const url = '/local/desk/db/' + encodeURIComponent(col) + '/' + encodeURIComponent(id);
      return {
        id,
        async set(value, opts) {
          const merge = !!(opts && opts.merge);
          const r = await fetch(url + (merge ? '?merge=1' : ''), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
          });
          await asJson(r);
        },
        update(value) { return this.set(value, { merge: true }); },
        async get() {
          const r = await fetch(url, { cache: 'no-store' });
          return r.status === 404 ? null : asJson(r);
        },
        async delete() { await asJson(await fetch(url, { method: 'DELETE' })); },
      };
    },
  };

  // ----------------------------------------------------------------- files
  const assets = {
    async upload(file) {
      const r = await fetch('/local/desk/files', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || '') },
        body: file,
      });
      return asJson(r); // { id, url }
    },
    async delete(id) { await asJson(await fetch('/local/desk/files/' + encodeURIComponent(id), { method: 'DELETE' })); },
  };

  // -------------------------------------------------------- the Askar link
  const mcp = {
    async callTool(server, tool, args) {
      if (tool === 'execute_sql') {
        const r = await asJson(await fetch('/local/desk/askar-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args && args.query }),
        }));
        if (r.error) { const e = new Error(r.error); e.code = 'tool_error'; throw e; }
        return { payload: r.rows };
      }
      const e = new Error(server + " isn't connected in the Desk on this PC. Your Desk is already saved on this PC (Documents\\Land of Rebirth Data\\desk).");
      e.code = 'not_connected';
      throw e;
    },
  };

  // ---------------------------------------------------------------- speech
  // A real voice engine can take over every "▶ Listen" by setting window.LOR_VOICE = { speak(text, opts) -> Promise,
  // stop() } (desk/desk-voice.js does this). If it rejects with code "voice_off", the browser voice is used instead.
  const browserSpeak = (text, opts) => new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) { const e = new Error('No voice available'); e.code = 'speech_error'; reject(e); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ''));
    const lang = (opts && (opts.language || opts.lang)) || 'en';
    u.lang = lang === 'en' ? 'en-GB' : lang;
    u.onend = () => resolve();
    u.onerror = (ev) => {
      const err = new Error(ev.error || 'Speech failed');
      err.code = ev.error === 'interrupted' || ev.error === 'canceled' ? 'interrupted' : 'speech_error';
      reject(err);
    };
    speechSynthesis.speak(u);
  });
  const tts = {
    async speak(text, opts) {
      const v = window.LOR_VOICE;
      if (v && typeof v.speak === 'function') {
        try { return await v.speak(String(text || ''), opts || {}); } catch (e) { if (!e || e.code !== 'voice_off') throw e; }
      }
      return browserSpeak(text, opts);
    },
    stop() {
      try { if (window.LOR_VOICE && typeof window.LOR_VOICE.stop === 'function') window.LOR_VOICE.stop(); } catch (_) { /* ignore */ }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
  };

  // -------------------------------------------------------------------- AI
  // Claude Code on this PC (the owner's Claude subscription) or Google Gemini (the owner's API key), as chosen
  // under "AI: …" in the Desk's top bar. Text only. See local/claude-engine.mjs and local/gemini-engine.mjs.
  async function askLocal(prompt, opts, json) {
    const r = await asJson(await fetch('/local/desk/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: String(prompt), json: !!json }),
    }));
    if (r.error) { const e = new Error(r.error); e.code = r.code || 'engine_error'; throw e; }
    return String(r.text || '');
  }
  /** The first complete JSON object or array in a reply (Claude sometimes adds a fence or a sentence). */
  function parseJsonLoose(t) {
    const s = String(t).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (_) { /* look inside */ }
    for (const [open, close] of [['{', '}'], ['[', ']']]) {
      const a = s.indexOf(open), b = s.lastIndexOf(close);
      if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (_) { /* next */ } }
    }
    return undefined;
  }
  const sample = Object.assign(async (prompt, opts) => ({ text: await askLocal(prompt, opts) }), {
    async json(prompt, opts) {
      const obj = parseJsonLoose(await askLocal(prompt, opts, true));
      // not "parse_error": the Desk would then ask Claude the whole thing a second time
      if (obj === undefined) { const e = new Error("Claude's answer wasn't readable JSON. Try again."); e.code = 'bad_json'; throw e; }
      return obj;
    },
    async limits() { return { images: false }; }, // reading reference images is not wired up locally yet
  });
  // Engine settings for the Desk's "AI: …" dialog. The Gemini key goes to this PC's server and never comes back.
  const ai = Object.freeze({
    settings: () => fetch('/local/desk/ai/settings', { cache: 'no-store' }).then(asJson),
    save: (patch) => fetch('/local/desk/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch || {}) }).then(asJson),
    geminiModels: () => fetch('/local/desk/ai/gemini-models', { cache: 'no-store' }).then(asJson),
  });

  const caps = { db, assets, mcp, tts, sample };
  window.claude = Object.freeze({ local: true, ai, use: async (name) => caps[name] || null });
})();
