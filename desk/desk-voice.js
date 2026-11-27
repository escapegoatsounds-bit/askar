/*
 * Land of Rebirth Desk: real voices (loaded after desk-extras.js; uses the page globals S, $, esc, speak, renderVoice).
 *   1. Every ▶ Listen in the Desk (Voice, Names, Lore, Reader) speaks with the voice engine on this PC
 *      (Chatterbox + Kokoro on the GPU, through /voice/* -> E:\EscapegoatStudio\tools\voice_server.py), via the
 *      window.LOR_VOICE hand-over in local/desk-runtime.js. If the engine can't start, the Desk uses the browser voice.
 *   2. A "Narrator's voice" panel on the Voice page: preset (Land of Rebirth cast first), language, gender,
 *      voice, age, emotion, emotion strength, speed and pitch, with a test button.
 *      Saved in Documents\Land of Rebirth Data\desk\voice.json.
 * The first line after a while loads the engine (~1 minute); after that a line takes a few seconds.
 */
(function () {
  'use strict';
  if (!(window.claude && window.claude.local)) return;          // only in the Desk on this PC
  const KEY = 'lor.voice';
  const DEF = { preset: '', accent: 'uk', gender: 'M', speaker: 'George', age: 'Elder', emotion: 'Wise',
                intensity: 0.4, speed: 0.9, pitch: -1 };
  let cat = null;                    // voices catalogue from the engine
  let last = null;                   // {url, desc} of the last line made
  // Settings: Documents\Land of Rebirth Data\desk\voice.json (via /voice/settings); localStorage is only a fast cache
  const cached = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } };
  let V = { ...DEF, ...cached() };
  let saveT = null;
  const save = (v) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {}
    clearTimeout(saveT);
    saveT = setTimeout(() => fetch('/voice/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                         body: JSON.stringify(v) }).catch(() => {}), 400);
  };
  fetch('/voice/settings').then((r) => (r.ok ? r.json() : {})).then((s) => {
    if (s && Object.keys(s).length) { V = { ...DEF, ...s }; try { localStorage.setItem(KEY, JSON.stringify(V)); } catch (_) {} mount(); }
  }).catch(() => {});

  // ------------------------------------------------------------------ engine calls
  async function api(path, body) {
    let r;
    try {
      r = await fetch('/voice' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(body) } : {});
    } catch (_) {
      const e = new Error('The voice engine is not reachable'); e.code = 'voice_off'; throw e;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(j.error || ('Voice engine answered ' + r.status));
      // 404 = no /voice route (hook not in), 502/503 = engine can't start: let the page use the browser voice
      e.code = [404, 502, 503].includes(r.status) ? 'voice_off' : 'engine';
      throw e;
    }
    return j;
  }
  async function catalogue() {
    if (!cat) cat = await api('/voices');
    return cat;
  }

  let audio = null;
  let gen = 0;                       // a newer request replaces an older one
  const status = (t) => { const el = $('vcStatus'); if (el) el.innerHTML = t; };

  async function make(text, opts) {
    const mine = ++gen;
    const o = opts || {};
    const voice = { accent: V.accent, speaker: V.speaker, age: V.age, emotion: V.emotion,
                    intensity: V.intensity, speed: V.speed * (o.rate || 1), pitch: V.pitch };
    if ((o.language || o.lang) === 'ar') { voice.accent = 'ar'; voice.speaker = V.gender === 'F' ? 'Salma' : 'Karim'; }
    const job = await api('/speak', { text: String(text || ''), voice, preset: undefined });
    status(`<span class="spin"></span> ${esc(job.desc || '')}`);
    for (;;) {
      if (mine !== gen) { const e = new Error('interrupted'); e.code = 'interrupted'; throw e; }
      const j = await api('/job/' + job.id);
      if (j.status === 'done') {
        const a = await fetch('/voice' + j.url);
        if (!a.ok) { const e = new Error('Could not fetch the audio (' + a.status + ')'); e.code = 'engine'; throw e; }
        if (last && last.url.startsWith('blob:')) URL.revokeObjectURL(last.url);
        last = { url: URL.createObjectURL(await a.blob()), desc: j.desc };
        return last;
      }
      if (j.status === 'error') { const e = new Error(j.error || 'failed'); e.code = 'engine'; throw e; }
      status(`<span class="spin"></span> ${esc(j.msg || 'Working')}… <span class="hint">${esc(j.desc || '')}</span>`);
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  let stopPlay = null;
  function play(url) {
    return new Promise((resolve, reject) => {
      if (audio) audio.pause();
      if (stopPlay) stopPlay();
      audio = new Audio(url);
      stopPlay = () => { const e = new Error('interrupted'); e.code = 'interrupted'; reject(e); };
      audio.onended = () => { stopPlay = null; resolve(); };
      audio.onerror = () => { stopPlay = null; const e = new Error('Could not play the voice line'); e.code = 'speech_error'; reject(e); };
      audio.play().catch((err) => { stopPlay = null; reject(err); });
    });
  }

  // Hand-over point in local/desk-runtime.js: every ▶ Listen in the Desk calls window.LOR_VOICE.speak first.
  // Rejecting with code "voice_off" makes the Desk use the browser voice; other errors are shown to the user.
  window.LOR_VOICE = {
    async speak(text, opts) {
      try {
        const r = await make(text, opts);
        status(`Ready: <b>${esc(r.desc)}</b> · <a href="${r.url}" download="voice.wav">⬇ save</a>`);
        await play(r.url);
      } catch (err) {
        if (err.code === 'voice_off') status(`⚠ ${esc(err.message)} · using the browser voice for now`);
        else if (err.code !== 'interrupted') status(`⚠ ${esc(err.message)}`);
        throw err;
      }
    },
    stop() { gen++; if (audio) audio.pause(); if (stopPlay) stopPlay(); },
  };

  // ------------------------------------------------------------------ the panel
  const css = document.createElement('style');
  css.textContent = `
  #vcPanel .vcgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px 14px;align-items:end}
  #vcPanel label{display:flex;flex-direction:column;gap:4px;font-size:13px}
  #vcPanel input[type=range]{width:100%}
  #vcPanel .seg{display:flex;gap:4px}
  #vcPanel .seg button.on{border-color:var(--malachite);color:var(--malachite)}
  #vcPanel .val{float:right;color:var(--dust)}
  #vcStatus{font-size:13px;min-height:18px}`;
  document.head.appendChild(css);

  const opt = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('');

  function speakersFor(c) {
    const all = (cat && cat.speakers[V.accent]) || {};
    return Object.entries(all).filter(([, g]) => g === V.gender).map(([nm]) => nm);
  }

  function panelHtml() {
    if (!cat) return `<div class="panel stack" id="vcPanel"><h2 style="margin:0">🎙 Narrator's voice</h2>
      <p class="hint" id="vcStatus"><span class="spin"></span> Starting the voice engine on this PC…</p></div>`;
    const accents = Object.entries(cat.accents).map(([l, k]) => [k, l]);
    const spk = speakersFor();
    if (!spk.includes(V.speaker)) V.speaker = spk[0] || V.speaker;
    const presets = [['', '— your own settings —'], ...cat.presets.map((p) => [p.name, p.name])];
    const sl = (k, label, min, max, step, fmt) => `<label>${label}<span class="val" id="vcv_${k}">${fmt(V[k])}</span>
      <input type="range" data-vc="${k}" min="${min}" max="${max}" step="${step}" value="${V[k]}"></label>`;
    return `<div class="panel stack" id="vcPanel">
      <div class="row-g" style="justify-content:space-between"><h2 style="margin:0">🎙 Narrator's voice</h2>
        <span class="hint">Used by every ▶ Listen in the Desk · runs on this PC, free</span></div>
      <div class="vcgrid">
        <label style="grid-column:span 2">Preset<select data-vc="preset">${opt(presets, V.preset)}</select></label>
        <label>Language<select data-vc="accent">${opt(accents, V.accent)}</select></label>
        <label>Gender<span class="seg">${[['F', 'Female'], ['M', 'Male']].map(([g, l]) =>
          `<button class="btn ghost sm${V.gender === g ? ' on' : ''}" type="button" data-vcg="${g}">${l}</button>`).join('')}</span></label>
        <label>Voice<select data-vc="speaker">${opt(spk.map((s) => [s, s]), V.speaker)}</select></label>
        <label>Age<select data-vc="age">${opt(cat.ages.map((a) => [a, a]), V.age)}</select></label>
        <label>Emotion<select data-vc="emotion">${opt(cat.emotions.map((e) => [e, e]), V.emotion)}</select></label>
        ${sl('intensity', 'Emotion strength', 0.25, 2, 0.05, (x) => (x < 0.45 ? 'subtle' : x < 0.75 ? 'natural' : x < 1.15 ? 'strong' : 'very dramatic'))}
        ${sl('speed', 'Speed', 0.7, 1.3, 0.01, (x) => '×' + Number(x).toFixed(2))}
        ${sl('pitch', 'Pitch', -6, 6, 0.5, (x) => (x > 0 ? '+' : '') + x + ' st')}
      </div>
      <div class="row-g" style="gap:8px;align-items:center">
        <button class="btn sm" type="button" data-vcact="test">▶ Test this voice</button>
        <button class="btn ghost sm" type="button" data-vcact="narr">▶ Speak the respelled narration</button>
        <button class="btn ghost sm" type="button" data-vcact="stop">■ Stop</button>
        <span id="vcStatus" class="hint">${last ? `Last: <b>${esc(last.desc)}</b> · <a href="${last.url}" download="voice.wav">⬇ save</a>` : 'The first line loads the engine (about a minute); then a few seconds per line.'}</span>
      </div>
      <p class="hint" style="margin:0">Tip: switch the feeling mid-line by typing {sad}, {whisper}, {fearful}, {calm}… in the narration.</p>
    </div>`;
  }

  function mount() {
    const host = $('v-voice');
    if (!host || !host.querySelector('.cx-head')) return;
    const old = $('vcPanel');
    const html = panelHtml();
    if (old) old.outerHTML = html; else host.querySelector('.cx-head').insertAdjacentHTML('afterend', html);
  }

  if (typeof renderVoice === 'function') {
    const orig = renderVoice;
    // eslint-disable-next-line no-global-assign
    renderVoice = function () { orig.apply(this, arguments); mount(); };
  }
  catalogue().then(() => { if (S.view === 'voice') mount(); })
    .catch((e) => status(`⚠ ${esc(e.message)}`));

  function applyPreset(name) {
    const p = cat && cat.presets.find((x) => x.name === name);
    if (!p) return;
    const v = p.voice;
    const g = cat.speakers[v.accent][v.speaker];
    V = { ...V, preset: name, accent: v.accent, gender: g, speaker: v.speaker, age: v.age, emotion: v.emotion,
          intensity: Math.round(v.intensity * 100) / 100, speed: Math.round(v.speed * 100) / 100, pitch: v.pitch };
  }

  const host = $('v-voice');
  host.addEventListener('change', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.vc;
    if (!k) return;
    if (k === 'preset') { if (ev.target.value) applyPreset(ev.target.value); else V.preset = ''; }
    else {
      V[k] = ev.target.type === 'range' ? Number(ev.target.value) : ev.target.value;
      if (['accent', 'speaker', 'age', 'emotion'].includes(k)) V.preset = '';
    }
    save(V); mount();
  });
  host.addEventListener('input', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.vc;
    if (!k || ev.target.type !== 'range') return;
    V[k] = Number(ev.target.value); V.preset = ''; save(V);
    const lab = $('vcv_' + k);
    if (lab) lab.textContent = k === 'speed' ? '×' + V[k].toFixed(2) : k === 'pitch' ? (V[k] > 0 ? '+' : '') + V[k] + ' st'
      : (V[k] < 0.45 ? 'subtle' : V[k] < 0.75 ? 'natural' : V[k] < 1.15 ? 'strong' : 'very dramatic');
  });
  host.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.vcg) { V.gender = b.dataset.vcg; V.preset = ''; save(V); mount(); return; }
    const a = b.dataset.vcact;
    if (a === 'stop') { window.LOR_VOICE.stop(); status('Stopped'); return; }
    if (a === 'test') { speak('The river was still that morning. Three summers, and not one cloud kept its promise.', { language: V.accent === 'ar' ? 'ar' : 'en' }); return; }
    if (a === 'narr') { const t = $('vxTts'); if (t && t.textContent.trim()) speak(t.textContent, { language: 'en' }); }
  });
})();
