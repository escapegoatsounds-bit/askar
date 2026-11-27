/*
 * Land of Rebirth Desk: extras (loaded after the main page script; uses its globals S, AGES, STYLES, ep(), esc()...).
 *   1. AI engine switch ("AI: Claude / Gemini" in the top bar; local Desk only)
 *   2. Feed an episode: YouTube transcripts, subtitle files and notes, turned into research notes by the AI
 *   3. Writing rules: the 4-part episode format and rich educational detail
 *   4. Social pyramid for every age/phase, beside the dynasty gods and rulers (map banner), also fed to the AI
 * The AI reads 2-4 through loreContext(), which every AI prompt in the Desk already includes.
 */
(function () {
  'use strict';
  const LOCAL = !!(window.claude && window.claude.local);
  const $id = (id) => document.getElementById(id);
  const say = (id, html) => { const m = $id(id); if (m) m.innerHTML = html; };
  const spin = '<span class="spin"></span>';

  // ======================================================================== styles
  const css = document.createElement('style');
  css.textContent = `
  /* The map banner lets clicks fall through to the map (pointer-events:none), which also made its buttons
     ("Dynasty gods", dynasty chips) dead. Buttons take clicks again; the rest still passes through. */
  .mapbanner button{pointer-events:auto}
  #aiChip{margin-left:auto;margin-right:10px;font-size:12px;padding:4px 10px}
  #aiChip.warn{border-color:#c98a2b;color:#f0c879}
  #aiDlg{max-width:640px}
  #aiDlg .opt{border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;cursor:pointer}
  #aiDlg .opt.on{border-color:var(--malachite)}
  #aiDlg .opt input[type=radio]{width:auto;margin-right:6px}
  .feed-item{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--deep)}
  .feed-item summary{cursor:pointer}
  .feed-item h4{margin:8px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--dust)}
  .feed-item ul{margin:0;padding-left:18px;font-size:13px}
  .feed-drop{outline:2px dashed var(--malachite)}
  .pyr-ages{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
  .pyr-ages button,.pyr-ph button{border:1px solid #c9b48a;background:#fbf3dc;color:#5b4129;border-radius:999px;padding:3px 9px;font-size:12px;cursor:pointer}
  .pyr-ages button.on,.pyr-ph button.on{background:#a3321c;border-color:#a3321c;color:#fff}
  .pyr-ph{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px}
  .pyr-now{font-size:13px;color:#5b4129;background:#efe0b6;border-radius:8px;padding:6px 10px;margin:6px 0}
  /* Social pyramid: carved stone blocks on parchment (owner's design, 27 Nov 2026) */
  .pyr-stage{position:relative;margin:10px 0;padding:22px 10px 22px;border-radius:10px;overflow:hidden;border:1px solid #d8c093;
    background:radial-gradient(ellipse 40% 34% at 50% 0%,rgba(255,238,185,.95),rgba(255,238,185,0) 75%),radial-gradient(ellipse 70% 40% at 50% 110%,rgba(120,70,30,.16),transparent 70%),linear-gradient(#f5e8cc,#e8d3ab)}
  .pyr-glyph{position:absolute;font-family:'Segoe UI Historic','Noto Sans Egyptian Hieroglyphs',serif;color:#8d6a43;opacity:.26;pointer-events:none;line-height:1}
  .pyr{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px}
  .pyr-cap{width:64px;height:32px;margin-bottom:-1px;clip-path:polygon(50% 0,100% 100%,0 100%);background:linear-gradient(165deg,#fff4cc,#e8bf62 45%,#9c6a24);filter:drop-shadow(0 0 12px rgba(255,214,120,.95))}
  .pyr-tier{position:relative;height:52px;border:0;padding:0;margin:0;background:none;cursor:pointer;filter:drop-shadow(0 5px 3px rgba(70,35,12,.42));transition:filter .15s}
  .pyr-tier:hover{filter:drop-shadow(0 5px 3px rgba(70,35,12,.42)) brightness(1.08)}
  .pyr-tier.on{filter:drop-shadow(0 0 8px rgba(255,208,110,.95)) drop-shadow(0 5px 3px rgba(70,35,12,.42)) brightness(1.12)}
  .pyr-tier:focus-visible{outline:none;filter:drop-shadow(0 0 0 2px #4fb39a) drop-shadow(0 0 6px #4fb39a)}
  .pyr-shape{position:absolute;inset:0;display:flex;gap:3px;clip-path:polygon(24px 0,calc(100% - 24px) 0,100% 100%,0 100%)}
  .pyr-blk{position:relative;height:100%;overflow:hidden;background-blend-mode:soft-light,soft-light,normal;
    box-shadow:inset 0 3px 0 rgba(255,240,205,.38),inset 0 -4px 0 rgba(30,10,0,.3),inset 3px 0 0 rgba(255,235,200,.12),inset -3px 0 0 rgba(30,10,0,.2)}
  .pyr-carve{position:absolute;top:50%;transform:translate(-50%,-50%);font-family:'Segoe UI Historic','Noto Sans Egyptian Hieroglyphs',serif;font-size:26px;line-height:1;color:rgba(45,18,5,.3);text-shadow:0 1px 0 rgba(255,236,200,.32),0 -1px 0 rgba(0,0,0,.15);pointer-events:none}
  .pyr-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 78px;pointer-events:none}
  .pyr-label b{font-family:var(--display);font-weight:400;font-size:16px;line-height:1.12;text-align:center;letter-spacing:.01em;
    background:linear-gradient(#fff6d2,#f0cd7c 50%,#c08d3c);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgba(35,12,2,.9)) drop-shadow(0 0 1.5px rgba(35,12,2,.75)) drop-shadow(0 0 4px rgba(35,12,2,.35))}
  .pyr-tier.light .pyr-label b{background:linear-gradient(#5e3a12,#3a2006);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 1px 0 rgba(255,240,200,.7))}
  .pyr-ico{position:absolute;top:50%;width:32px;height:32px;margin-top:-16px;overflow:visible;filter:drop-shadow(0 1px 0 rgba(255,242,205,.6)) drop-shadow(0 -1px 0 rgba(35,12,2,.55)) drop-shadow(0 2px 2px rgba(35,12,2,.4))}
  .pyr-ico.l{left:36px}.pyr-ico.r{right:36px}
  .pyr-tier.apex .pyr-ico.r{right:auto;left:66px}
  .pyr-tier.apex .pyr-label{padding-left:96px;padding-right:30px}
  @media (max-width:640px){.pyr-ico{width:24px;height:24px;margin-top:-12px}.pyr-ico.l{left:26px}.pyr-ico.r{display:none}.pyr-label{padding:0 22px 0 56px}.pyr-tier.apex .pyr-label{padding-left:56px}.pyr-label b{font-size:13px}.pyr-tier{height:46px}.pyr-carve{display:none}}
  .pyr-det{position:relative;background:linear-gradient(#fbf3dc,#f3e3bf);border:1.5px solid #b8904c;border-radius:8px;padding:10px 14px;font-size:13px;color:#2a1c10;box-shadow:inset 0 1px 0 #fff8e4,0 2px 6px rgba(80,50,20,.18)}
  .pyr-det p{margin:4px 0}
  .pyr-det .pyr-det-h{font-family:var(--display);font-size:18px;color:#7a2a12;margin:0 0 4px}
  `;
  document.head.appendChild(css);

  // ======================================================= 1. AI engine (local only)
  function aiChip() {
    if (!LOCAL || !window.claude.ai || $id('aiChip')) return;
    const st = $id('status');
    if (!st || !st.parentNode) return;
    const b = document.createElement('button');
    b.id = 'aiChip'; b.type = 'button'; b.className = 'tab'; b.dataset.aiopen = '1'; b.textContent = 'AI: …';
    st.parentNode.insertBefore(b, st);
    aiRefresh();
  }
  async function aiRefresh() {
    try {
      const s = await window.claude.ai.settings();
      S.aiEng = s;
      const ok = s.provider === 'gemini' ? s.gemini.hasKey : !!(s.claude && s.claude.signedIn);
      const b = $id('aiChip');
      if (b) {
        b.textContent = `AI: ${s.provider === 'gemini' ? 'Gemini' : 'Claude'}${ok ? '' : ' ⚠'}`;
        b.classList.toggle('warn', !ok);
        b.title = ok ? 'Which AI writes for the Desk (click to change)' : s.provider === 'gemini' ? 'No Gemini API key saved yet' : "Claude Code isn't signed in on this PC";
      }
      if ($id('aiDlg') && $id('aiDlg').open) aiDialog();
    } catch (_) { /* server not reachable */ }
  }
  function aiDialog() {
    let d = $id('aiDlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'aiDlg'; document.body.appendChild(d); }
    const s = S.aiEng || { provider: 'claude', gemini: {}, claude: {} };
    const c = s.claude || {};
    const models = S.aiModels || [];
    d.innerHTML = `<div class="stack">
      <div class="row-g" style="justify-content:space-between"><h2 style="margin:0;font-family:var(--display);font-weight:400">Which AI writes for the Desk</h2><button class="btn ghost sm" type="button" data-aiclose>Close</button></div>
      <p class="hint">Used for Break into frames, Fill fields, Rewrite, research briefs and the notes made from transcripts. Switch any time.</p>
      <label class="opt ${s.provider !== 'gemini' ? 'on' : ''}"><span><input type="radio" name="aiprov" value="claude" ${s.provider !== 'gemini' ? 'checked' : ''}><b>Claude</b> · Claude Code on this PC, your Claude subscription</span>
        <span class="hint">${!c.found ? "Claude Code wasn't found on this PC." : c.signedIn ? '✓ Signed in.' : 'Not signed in yet: double-click <b>Sign-In-Claude.cmd</b> in the Askar folder → <b>local</b>, sign in with your Claude account, then press Check again.'}</span>
        ${c.found && !c.signedIn ? '<button class="btn ghost sm" type="button" data-aicheck style="align-self:flex-start">Check again</button>' : ''}</label>
      <label class="opt ${s.provider === 'gemini' ? 'on' : ''}"><span><input type="radio" name="aiprov" value="gemini" ${s.provider === 'gemini' ? 'checked' : ''}><b>Gemini</b> · Google's Gemini API, your own API key</span>
        <span class="hint">${s.gemini && s.gemini.hasKey ? `✓ Key saved (ends in …${esc(s.gemini.keyEnd || '')}). Paste a new one to replace it.` : 'No key yet. Get one at aistudio.google.com → "Get API key", then paste it here.'}</span>
        <input id="aiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your Gemini API key">
        <div class="row-g"><button class="btn sm" type="button" data-aikey>Save key</button>${s.gemini && s.gemini.hasKey ? '<button class="btn ghost sm" type="button" data-aikeydel>Remove key</button><button class="btn ghost sm" type="button" data-aimodels>Load my models</button>' : ''}</div>
        <label>Model${models.length ? `<select id="aiModel">${models.map((m) => `<option value="${esc(m.id)}" ${m.id === (s.gemini && s.gemini.model) ? 'selected' : ''}>${esc(m.label)} (${esc(m.id)})</option>`).join('')}</select>` : `<input id="aiModel" value="${esc((s.gemini && s.gemini.model) || 'gemini-2.5-pro')}">`}</label>
        <span class="hint">The key stays on this PC only (Documents\\Land of Rebirth Data\\desk\\ai-engine.json) and is never shown again. Google may charge for use beyond its free tier, and on the free tier Google may use what you send to improve its products.</span></label>
      <div class="row-g"><button class="btn ochre sm" type="button" data-aitest>Test the chosen AI</button><span class="hint" id="aiMsg2"></span></div>
    </div>`;
    if (!d.open) d.showModal();
  }
  async function aiSave(patch, note) {
    try { S.aiEng = Object.assign({}, S.aiEng, await window.claude.ai.save(patch)); say('aiMsg2', note || 'Saved.'); } catch (err) { say('aiMsg2', 'Not saved: ' + esc(err.message || err)); }
    await aiRefresh();
  }
  async function aiOnClick(ev) {
    const t = ev.target;
    if (t.closest('[data-aiopen]')) { await aiRefresh(); aiDialog(); return; }
    const d = $id('aiDlg');
    if (!d || !d.contains(t)) return;
    if (t === d || t.closest('[data-aiclose]')) { d.close(); return; }
    if (t.matches('input[name=aiprov]')) { await aiSave({ provider: t.value }, `Now using ${t.value === 'gemini' ? 'Gemini' : 'Claude'}.`); return; }
    if (t.closest('[data-aicheck]')) { say('aiMsg2', spin + 'Checking…'); await aiRefresh(); return; }
    if (t.closest('[data-aikey]')) {
      const k = ($id('aiKey').value || '').trim();
      if (k.length < 20) { say('aiMsg2', 'That key looks too short.'); return; }
      const m = $id('aiModel') ? $id('aiModel').value.trim() : '';
      $id('aiKey').value = '';
      await aiSave({ geminiKey: k, geminiModel: m || undefined, provider: 'gemini' }, 'Key saved. Gemini is now the AI. Press Test to check it.');
      return;
    }
    if (t.closest('[data-aikeydel]')) { await aiSave({ geminiKey: '', provider: 'claude' }, 'Key removed. Back to Claude.'); return; }
    if (t.closest('[data-aimodels]')) {
      say('aiMsg2', spin + 'Asking Google which models your key can use…');
      try {
        const r = await window.claude.ai.geminiModels();
        if (r.error) { say('aiMsg2', esc(r.error)); return; }
        S.aiModels = r.models || []; aiDialog(); say('aiMsg2', `${S.aiModels.length} models. Pick one; it is saved when you choose.`);
      } catch (err) { say('aiMsg2', esc(err.message || err)); }
      return;
    }
    if (t.closest('[data-aitest]')) {
      if (!S.sample) { say('aiMsg2', 'No AI in this view.'); return; }
      say('aiMsg2', spin + 'Asking…');
      try { const r = await S.sample('Reply with one short sentence: which model are you?'); say('aiMsg2', '✓ It answered: ' + esc(String(r.text || '').slice(0, 160))); } catch (err) { say('aiMsg2', '✗ ' + esc(err.message || err)); }
    }
  }
  document.addEventListener('click', aiOnClick);
  document.addEventListener('change', (ev) => { if (ev.target && ev.target.id === 'aiModel' && ev.target.tagName === 'SELECT') aiSave({ geminiModel: ev.target.value }, 'Model saved.'); });

  // ================================================== 2. Feed an episode (research)
  const FEED_MAX = 300000; // characters of transcript sent to the AI (about 75k tokens)
  S.feedText = S.feedText || {};
  function ytId(u) {
    const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  /** Tidy a pasted YouTube transcript, a .vtt/.srt subtitle file or plain notes into "[m:ss] text" lines. */
  function cleanTranscript(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    const out = [];
    let stamp = '';
    const ts = (h, m, s) => (h && +h ? `${+h}:${String(m).padStart(2, '0')}` : `${+m}`) + ':' + String(s).padStart(2, '0');
    for (let l of lines) {
      l = l.replace(/<[^>]+>/g, '').trim();
      if (!l || /^WEBVTT/i.test(l) || /^(Kind|Language|NOTE)\b/i.test(l) || /^\d+$/.test(l)) continue;
      let m = l.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d{1,3})?\s*-->/);
      if (m) { stamp = ts(m[1], m[2], m[3]); continue; }
      m = l.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/); // YouTube "Show transcript": timestamp on its own line
      if (m) { stamp = ts(m[1], m[2], m[3]); continue; }
      if (/^\d+ (?:seconds?|minutes?|hours?)(?:,? \d+ (?:seconds?|minutes?))*$/i.test(l)) continue; // screen-reader time labels
      m = l.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/);
      if (m) { stamp = ts(m[1], m[2], m[3]); l = m[4]; }
      if (out.length && out[out.length - 1].text === l) continue; // auto-captions repeat lines
      out.push({ stamp, text: l });
      stamp = '';
    }
    return out.map((x) => (x.stamp ? `[${x.stamp}] ` : '') + x.text).join('\n');
  }
  const words = (t) => (String(t).match(/\S+/g) || []).length;

  const NOTE_KEYS = [['facts', 'Facts'], ['garments', 'Dress & adornment'], ['jobs', 'Jobs & ranks'], ['environment', 'Land, nature, homes'], ['food', 'Food & drink'], ['beliefs', 'Beliefs & rites'], ['objects', 'Objects & tools'], ['music', 'Music & sound'], ['visual', 'Visual details for frames'], ['doubts', "Doubtful: don't use"]];

  function feedPanel(e) {
    const items = (e.feed || []).map((f) => {
      const n = f.notes;
      const lists = n ? NOTE_KEYS.filter(([k]) => (n[k] || []).length).map(([k, l]) => `<h4>${l}</h4><ul>${n[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('') : '';
      return `<details class="feed-item"><summary><b>${esc(f.title)}</b> <span class="hint" style="display:inline">· ${f.kind === 'youtube' ? 'YouTube' : f.kind === 'file' ? 'Subtitle file' : 'Notes'} · ${(f.words || 0).toLocaleString()} words · ${n ? 'notes ready' : 'no notes yet'}</span></summary>
        ${f.url ? `<p class="hint"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a></p>` : ''}
        ${n && n.summary ? `<p class="desc">${esc(n.summary)}</p>` : ''}${lists}
        <div class="row-g" style="margin-top:8px">${S.sample ? `<button class="btn ghost sm" type="button" data-feednotes="${esc(f.id)}">${n ? 'Make the notes again' : 'Make notes'}</button>` : ''}<button class="btn ghost sm" type="button" data-feeddel="${esc(f.id)}">Remove</button></div></details>`;
    }).join('');
    return `<div class="panel stack" id="feedPanel">
      <div class="row-g" style="justify-content:space-between"><h2 style="margin:0">Feed this episode</h2><span class="hint">${(e.feed || []).length} added</span></div>
      <p class="hint">Add YouTube transcripts, subtitle files or any notes about this age. The AI turns each one into notes on dress, jobs, places, food and beliefs, and those notes go automatically into everything it writes for this episode: Break into frames, Fill fields, Rewrite and the research brief.</p>
      <details class="src"><summary><b>How to get a YouTube transcript</b></summary><p class="desc">Open the video on YouTube. Under the video, click the description's <b>…more</b>, then <b>Show transcript</b>. Select the whole transcript with the mouse (drag from the first line to the last), copy it, and paste it below. Or download the video's subtitles as a .vtt or .srt file and drop the file onto the box.</p></details>
      <label>YouTube link (optional, kept for reference)<input id="feedUrl" placeholder="https://www.youtube.com/watch?v=…"></label>
      <label>Title<input id="feedTitle" placeholder="e.g. Daily life in Predynastic Egypt (lecture)"></label>
      <label>Transcript or notes<textarea id="feedText" rows="6" placeholder="Paste the transcript here, or drop a .vtt / .srt / .txt file on this box"></textarea></label>
      <div class="row-g"><button class="btn ochre sm" type="button" data-feedadd>Add to this episode</button><span class="hint" id="feedMsg"></span></div>
      ${items}
    </div>`;
  }
  window.feedPanel = feedPanel;

  async function feedFullText(id) {
    if (S.feedText[id]) return S.feedText[id];
    try { const r = S.db && (await S.db.doc('feeds/' + id).get()); const d = r && (typeof r.data === 'function' ? r.data() : r.data || r); if (d && d.text) return (S.feedText[id] = d.text); } catch (_) { /* fall through */ }
    return null;
  }

  async function feedAdd() {
    const e = ep();
    if (!e) return;
    const raw = $id('feedText').value;
    const text = cleanTranscript(raw);
    if (words(text) < 40) { say('feedMsg', 'Paste a transcript or notes first (at least a few sentences).'); return; }
    const url = $id('feedUrl').value.trim();
    const vid = ytId(url);
    const id = 'feed-' + (vid ? 'yt-' + vid : uid().slice(0, 10));
    if ((e.feed || []).some((f) => f.id === id)) { say('feedMsg', 'That video is already in this episode.'); return; }
    const item = {
      id, kind: vid ? 'youtube' : S.feedFile ? 'file' : 'text',
      title: $id('feedTitle').value.trim() || S.feedFile || (vid ? 'YouTube video ' + vid : 'Notes ' + new Date().toISOString().slice(0, 10)),
      url: vid ? `https://www.youtube.com/watch?v=${vid}` : /^https?:\/\//.test(url) ? url : '',
      words: words(text), addedAt: new Date().toISOString(), notes: null,
    };
    S.feedFile = null;
    S.feedText[id] = text;
    try { if (S.db) await S.db.doc('feeds/' + id).set({ id, episode: e.id, title: item.title, url: item.url, text, addedAt: item.addedAt }); } catch (err) { toast("Couldn't keep the full text: " + (err && err.message || err)); }
    e.feed = [...(e.feed || []), item];
    markDirty();
    renderStab();
    await feedNotes(id);
  }

  async function feedNotes(id) {
    const e = ep();
    const f = e && (e.feed || []).find((x) => x.id === id);
    if (!f) return;
    if (!S.sample) { say('feedMsg', 'Added. Notes need the AI (AI: … in the top bar).'); return; }
    if (S.feedBusy) { say('feedMsg', 'Wait for the notes being made now.'); return; }
    const text = await feedFullText(id);
    if (!text) { say('feedMsg', "The full text isn't on this PC any more. Remove it and paste it again."); return; }
    const st = STYLES[e.style] || {};
    S.feedBusy = true;
    say('feedMsg', spin + `Reading "${esc(f.title)}" (${f.words.toLocaleString()} words)… this can take a few minutes.`);
    try {
      const r = await callClaude(`You are the historical researcher for "Land of Rebirth", a narrated series that shows real Egyptian history through ordinary people. The writer collected this ${f.kind === 'youtube' ? 'YouTube video transcript' : f.kind === 'file' ? 'subtitle file' : 'text'} for the episode "${e.title}" set in ${st.label || 'its era'}${e.year ? ' (' + e.year + ')' : ''}.
Pull out everything that can make the episode's frames and narration concrete and educational for THIS age: what people wore (materials, cut, colours, how it was worn, hair, jewellery, body paint), their jobs and ranks and how the work was done, tools and objects, homes, landscape, plants and animals, food and drink, beliefs and rites, music and sounds, and visual details a photographer could frame.
Rules: one short, specific line per item, in English. Add the timestamp like (12:34) when the text has one. Keep only what fits this age; note the period when the text is about a different one. Put legends, guesses, later-period details and anything that conflicts with mainstream scholarship in "doubts" (with why), not in the other lists. Never add details that are not in the text.
${f.title.startsWith('YouTube video ') || f.title.startsWith('Notes ') ? 'Also give the text a short descriptive "title".\n' : ''}Return ONLY JSON: {"title":string,"summary":"3-5 sentences","facts":[],"garments":[],"jobs":[],"environment":[],"food":[],"beliefs":[],"objects":[],"music":[],"visual":[],"doubts":[]}
TEXT${text.length > FEED_MAX ? ' (first part only; it is long)' : ''}:
"""${text.slice(0, FEED_MAX)}"""`);
      const n = { summary: String(r.summary || '') };
      for (const [k] of NOTE_KEYS) n[k] = (Array.isArray(r[k]) ? r[k] : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
      f.notes = n;
      f.notesAt = new Date().toISOString();
      if (r.title && (f.title.startsWith('YouTube video ') || f.title.startsWith('Notes '))) f.title = String(r.title).slice(0, 120);
      markDirty();
      renderStab();
      say('feedMsg', `✓ Notes ready for "${esc(f.title)}". They now go into Break into frames, Fill and the research brief.`);
    } catch (err) {
      say('feedMsg', "Couldn't make notes: " + esc(err && err.message || err));
    } finally { S.feedBusy = false; }
  }

  let delArm = null;
  async function feedDel(id, btn) {
    const e = ep();
    if (!e) return;
    if (delArm !== id) { delArm = id; btn.textContent = 'Click again to remove'; setTimeout(() => { if (delArm === id) { delArm = null; if (btn.isConnected) btn.textContent = 'Remove'; } }, 5000); return; }
    delArm = null;
    e.feed = (e.feed || []).filter((f) => f.id !== id);
    delete S.feedText[id];
    try { if (S.db) await S.db.doc('feeds/' + id).delete(); } catch (_) { /* keep going */ }
    markDirty();
    renderStab();
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('[data-feedadd]')) { feedAdd(); return; }
    const n = t.closest('[data-feednotes]');
    if (n) { feedNotes(n.dataset.feednotes); return; }
    const d = t.closest('[data-feeddel]');
    if (d) feedDel(d.dataset.feeddel, d);
  });
  document.addEventListener('dragover', (ev) => { if (ev.target && ev.target.id === 'feedText') { ev.preventDefault(); ev.target.classList.add('feed-drop'); } });
  document.addEventListener('dragleave', (ev) => { if (ev.target && ev.target.id === 'feedText') ev.target.classList.remove('feed-drop'); });
  document.addEventListener('drop', async (ev) => {
    const ta = ev.target;
    if (!ta || ta.id !== 'feedText') return;
    ev.preventDefault();
    ta.classList.remove('feed-drop');
    const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { say('feedMsg', 'That file is too big for a transcript.'); return; }
    ta.value = cleanTranscript(await file.text());
    S.feedFile = file.name.replace(/\.[^.]+$/, '');
    if (!$id('feedTitle').value) $id('feedTitle').value = S.feedFile;
    say('feedMsg', `Loaded "${esc(file.name)}" (${words(ta.value).toLocaleString()} words). Press Add to this episode.`);
  });

  /** What the AI gets from the episode's feed. */
  function feedContext(e) {
    const fs = ((e && e.feed) || []).filter((f) => f.notes);
    if (!fs.length) return '';
    const L = (n, k, label) => ((n[k] || []).length ? `\n  ${label}: ${n[k].join(' · ')}` : '');
    return `RESEARCH FED TO THIS EPISODE (transcripts and notes the writer collected; modern material, not period sources: use their concrete detail generously, but the codex, lore and period sources win when they disagree, and never use anything listed as doubtful):\n` +
      fs.map((f) => { const n = f.notes; return `- "${f.title}": ${n.summary || ''}${L(n, 'facts', 'FACTS')}${L(n, 'garments', 'DRESS')}${L(n, 'jobs', 'JOBS & RANKS')}${L(n, 'environment', 'LAND, NATURE, HOMES')}${L(n, 'food', 'FOOD')}${L(n, 'beliefs', 'BELIEFS')}${L(n, 'objects', 'OBJECTS')}${L(n, 'music', 'MUSIC & SOUND')}${L(n, 'visual', 'VISUAL')}${L(n, 'doubts', 'DO NOT USE')}`; }).join('\n');
  }

  // ======================================== 3. Episode format + educational detail
  function mmss(min) { const s = Math.round(min * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  /** The owner's 4-part format for every episode, scaled to the target length (11 min = 0-3 / 3-5 / 5-8 / 8-11). */
  window.partsGuide = function (tgt) {
    const T = +tgt || 11, a = (T * 3) / 11, b = (T * 5) / 11, c = (T * 8) / 11;
    return `EPISODE FORMAT (the owner's rule for every episode; times scaled to this ${T}-minute target):
Part 1 · Educational intro (0:00-${mmss(a)}): the world of the age, calm and full of life: how people lived, worked, dressed, ate, believed, made music and buried their dead. Show several ranks and jobs from the social order, real codex objects and rich description. Educational beats may run 12-18 s so the narration has room to describe.
Part 2 · The obstacle (${mmss(a)}-${mmss(b)}): the problem hits and grows, in sharp contrast with Part 1.
Part 3 · Soundtrack climax (${mmss(b)}-${mmss(c)}): the episode's song carries the fight against the obstacle; narration only on a few key lines; the song's drop lands on the peak moment.
Part 4 · Resolution and education (${mmss(c)}-${mmss(T)}): rescue and rebirth with a new opportunity, plus a new layer of history about the new life, as descriptive as Part 1 (dress, work, homes, food, beliefs).
Give every beat's "act" as "Part 1", "Part 2", "Part 3" or "Part 4". Keep a clear rise, the climax in Part 3 and a quiet resolution.`;
  };
  function eduRules() {
    return `EDUCATIONAL DETAIL (the owner's rule: the educational parts must be richly descriptive; the more concrete detail the better):
- In Part 1, Part 4 and any frame that shows daily life, "figures" names what each person wears (material such as hide, linen or wool; cut, colour and how it is tied or draped), their hair or wig, jewellery and body paint, their rank or job from the social order below, and what their hands are doing with which tool.
- "fg", "mg" and "bg" name the plants, animals, landscape, shelters or buildings, tools, vessels and food in view, true to the age.
- The narration shows one concrete practice per frame from the narrator's own life (what it is made of, who does it, how and why), in plain words, never like a lecture.
- Spread these frames over several ranks and jobs of the social order (not only the narrator's family). Use the research fed to this episode, the codex and the period sources; when they disagree, the codex and period sources win.`;
  }

  // ============================================ 4. Social pyramid for every age/phase
  // [title, who they are, what they wore, what they did]. Top of the pyramid first. Phases: [label, [[from, to]...], note, tiers]
  const SOCIAL = {
    prehistoric: [
      ['Herders and hunters (before c. 4000 BC)', [[-10000, -4000]], 'No writing and no kings yet. This order is reconstructed from camps, graves and monuments (Nabta Playa, Gebel Ramlah, the Badarian villages), so treat it as a best guess.', [
        ['Elders and ritual leaders', 'Older men and women whose age, herds and knowledge of rain, stars and water gave them a say. Some graves at Gebel Ramlah and Badari are richer than the rest.', 'Hide and leather garments, red-ochre and green-malachite face paint, beads of shell, stone and ostrich eggshell, ivory bangles and combs (Badarian).', 'Decide when to move, settle quarrels, lead burials and gatherings at sacred places such as the stone circle and cattle burials of Nabta Playa.'],
        ['Herding families', 'Most people: households whose wealth was their long-horned cattle, with sheep and goats.', 'Hide wraps and kilts, leather sandals, simple bead strings; small children mostly naked.', 'Move the herds between rain pools, wells and the valley edge; milk and guard the animals; make leather, rope, baskets and ostrich-egg water flasks.'],
        ['Hunters and gatherers', 'The old way of life went on beside herding: everyone gathered, many hunted.', 'Hide clothing, feathers, body paint.', 'Hunt gazelle, hare and ostrich with bows and chert-tipped arrows, fish the lakes and river, gather and grind wild sorghum and millet on grinding stones (sorghum is attested at Nabta Playa).'],
        ['Craftworkers', 'Skilled people within each family, not yet full-time specialists.', 'The same as their families, often with the finest beads.', 'Thin, rippled Badarian pottery, chert blades and arrowheads, slate palettes for grinding eye paint, beads of shell, carnelian and, by c. 4500-4000 BC, a little copper.'],
        ['Children and dependants', 'Children, the old and the sick, cared for by the group.', 'Children naked or in small hide aprons, with bead strings.', 'Herd the goats and sheep, carry water and firewood, learn the crafts by watching.'],
      ]],
      ['Naqada chiefdoms (c. 4000-3150 BC)', [[-4000, -3150]], 'Villages grow into towns (Nekhen, Nubt, Abdju) led by chiefs who become the first kings. Signs of writing appear at Abdju c. 3300 BC (labels in tomb U-j).', [
        ['Chief, later the first kings', 'Rulers of a town and its region; by the end the strongest unite the south.', 'Linen kilt with an animal tail at the belt, pear-shaped stone mace, gold, lapis lazuli and carnelian jewellery. The red crown is already drawn on a Naqada pot.', 'Lead war and trade, hold feasts, lie in big painted or many-roomed tombs (the Painted Tomb at Nekhen, tomb U-j at Abdju).'],
        ['Elite families and ritual specialists', "The chief's relatives and allies and the keepers of the shrines (the ceremonial court at Nekhen).", 'Fine linen, ivory combs and pins, cosmetic palettes, imported lapis and obsidian.', 'Run feasts and rites, control the trade goods, hold the best land and herds.'],
        ['Specialist craftsmen', 'The first full-time craftsmen, working for the elite.', 'Linen kilts and loincloths.', 'Painted pottery with boats, ripple-flaked flint knives, hard-stone vessels, copper tools, and beer brewed on a large scale (the brewery at Nekhen).'],
        ['Traders and boatmen', 'Men who carried goods along the river and beyond.', 'Loincloths and kilts, cloaks for travel.', 'Reed and wooden boats; trade with the north (Maadi, Buto) and the Levant for copper, oils, wine and lapis lazuli.'],
        ['Farmers and herders', 'Most people, in villages of reed and mud houses.', 'Simple linen or leather loincloths and wraps; women in long wraps; bead necklaces.', 'Sow emmer, barley and flax on the flood mud, keep cattle, goats and pigs, fish the river.'],
      ]],
    ],
    'early-dynastic': [
      ['Early Dynastic (c. 3150-2686 BC)', [[-3150, -2686]], 'One king for the Two Lands. Writing, taxes and a royal administration begin; the kings are buried at Abdju, the great officials at Saqqara.', [
        ['King', 'The ruler of the Two Lands, "the Horus", whose Horus name is written in a palace-front frame (serekh). The title nesu-bity is first attested under Den.', "White crown of the south and red crown of the north, short kilt with a bull's tail, false beard; on Narmer's palette a servant carries his sandals.", 'Wins wars, founds temples, leads the "Following of Horus" tour and the cattle count every two years, is buried at Abdju.'],
        ['Royal family and great nobles', "The king's relatives and closest men, who hold the top offices.", 'Fine linen kilts and dresses, wigs, gold and stone-bead jewellery.', "Govern in the king's name; huge mudbrick mastaba tombs at Saqqara."],
        ['Officials and seal-bearers', 'Administrators of the treasury (the "white house"), granaries, vineyards and royal estates.', 'Linen kilts, cylinder seals worn on a cord.', "Count cattle and grain, seal jars and storerooms, record taxes. The vizier's office takes shape by the end of the period."],
        ['Priests', 'Servants of the gods and of the dead kings.', 'Clean white linen, shaved heads.', "Offer food and drink at the shrines (Abdju, Nekhen) and keep the royal tombs' offerings."],
        ['Scribes', 'A small, prized group: writing is new.', 'Linen kilt, reed brushes and ink.', 'Write year labels, seal texts and lists of goods. The oldest known (blank) papyrus roll comes from a 1st-dynasty tomb at Saqqara (Hemaka).'],
        ['Craftsmen', 'Workers in the royal workshops.', 'Linen loincloths and kilts.', 'Stone vessels by the thousand, carpentry, copper tools, ivory carving, faience, mudbrick tomb building.'],
        ['Farmers and labourers', 'Most people.', 'Loincloth or short kilt; women in simple wraps or sheath dresses.', "Farm the flood land, pay taxes in grain and cattle, work on the king's projects when called."],
        ['Retainers and servants', 'Household servants. In Dynasty 1 some were buried around the king\'s tomb at Abdju, probably killed to serve him in death; the practice ends after Dynasty 1.', 'Simple linen.', 'Serve, carry, cook and brew for the palace and the great households.'],
      ]],
    ],
    'old-kingdom': [
      ['Old Kingdom: the pyramid age (2686-2181 BC)', [[-2686, -2181]], 'Strong kings rule from Men-nefer and build the pyramids; the whole land works for the king and the gods.', [
        ['King', 'The nesu, "the Horus" and, from Dynasty 4, "son of Ra": a god on earth who owns the land.', 'Striped nemes headcloth or the white, red or double crown, pleated royal kilt with a bull\'s tail, false beard, broad collar.', 'Keeps maat (order), builds his pyramid and temples, sends expeditions to Sinai and Nubia.'],
        ['Vizier (tjaty)', 'Head of government and the courts; in Dynasty 4 often a royal relative (Hemiunu, the builder under Khufu).', 'Fine kilt, shoulder-length wig, broad collar, staff of office.', 'Runs the treasury, granaries, courts and building works, the pyramids included.'],
        ['Nobles, officials and nomarchs', 'Governors of the provinces (nomes) and court officials, more independent in Dynasties 5-6.', 'Pleated linen kilts, wigs, broad collars; their wives in close-fitting sheath dresses with shoulder straps.', 'Collect taxes, judge, run estates. Their decorated mastabas at Giza and Saqqara show daily life in detail.'],
        ['Priests (hem-netjer, wab)', 'High priests such as the "Greatest of Seers" at Iunu, and part-time wab priests who serve one month in four in teams.', 'Shaved head and body, white linen, sandals; the sem priest wears a leopard skin.', 'Daily offerings, the sun temples of Dynasty 5, and the cults of dead kings and nobles paid for by their estates.'],
        ['Scribes (sesh)', "The best job a commoner's son could hope for, learned from childhood.", 'Linen kilt, reed pen behind the ear, palette and water pot.', 'Accounts, tax rolls, letters and work rosters (the Abusir papyri, and Merer\'s logbook from Khufu\'s reign found at Wadi al-Jarf).'],
        ['Artisans and builders', 'Sculptors, painters, coppersmiths, masons and the pyramid crews, organised in named gangs such as "Friends of Khufu".', 'Loincloths and short kilts, headbands.', 'Quarry and haul limestone and granite, carve and paint tombs. The Giza crews lived in a town with bakeries, breweries and rations of beef and fish.'],
        ['Farmers and herders', 'Most Egyptians, working land of the king, the temples or the nobles.', 'Short kilt or loincloth, often nothing in the fields; women in simple sheath dresses.', 'Plough with oxen, sow emmer, barley and flax, reap with sickles, herd cattle and donkeys, net fish and birds in the marshes; called up for building work in the flood season.'],
        ['Servants and dependants', "Household servants, estate workers and war captives tied to their masters' estates.", 'Loincloths and simple dresses.', 'Grind grain, bake, brew, carry and row.'],
      ]],
      ['First Intermediate Period (2181-2055 BC)', [[-2181, -2055]], 'Royal power collapses. Kings at Nen-nesut (north) and Waset (south) compete; local governors rule their own regions; low floods bring famine.', [
        ['Rival kings', 'Kings at Nen-nesut and at Waset, each claiming the whole land.', 'The royal kilt and crowns, less splendid than before.', 'Fight each other for the middle of the country.'],
        ['Nomarchs and local strongmen', 'Provincial governors who boast of feeding their towns in famine (Ankhtifi of Hefat).', 'Fine kilts, wigs, collars.', 'Raise their own soldiers, fight neighbours, keep the granaries.'],
        ['Soldiers', 'Local troops, including Nubian archers in service (the soldier models from Asyut).', 'Kilts, cowhide shields, bows, spears.', 'Guard towns and fight for their lords.'],
        ['Priests and scribes', 'Fewer royal commissions; local temples and tombs.', 'White linen.', 'Keep local cults and records.'],
        ['Craftsmen', 'Provincial workshops with their own style.', 'Loincloths and kilts.', 'Tomb models of bakers, brewers and boats, coffins painted with spells.'],
        ['Farmers', 'Most people; famine and low floods are remembered in later texts.', 'Loincloths and simple dresses.', 'Farm and herd, and suffer most when the river fails.'],
      ]],
    ],
    'middle-kingdom': [
      ['Middle Kingdom (2055-1650 BC)', [[-2055, -1650]], 'Montuhotep II reunites the land; Dynasty 12 kings rule from Itj-tawy. A larger class of trained officials appears.', [
        ['King', 'Nesu-bity; the careworn statues of Senusret III show the king as a burdened shepherd of his people.', 'Nemes or crowns, royal kilt, false beard.', 'Builds forts in Nubia, reclaims land in the Fayum, cuts the power of the nomarchs (Senusret III).'],
        ['Vizier', 'Head of the administration and the courts.', 'Long kilt, wig, collar.', 'Runs the government and hears cases.'],
        ['Nomarchs and nobles', 'Powerful provincial lords early in Dynasty 12 (Khnumhotep II at Beni Hasan), reduced under Senusret III.', 'Longer kilts, some tied high under the chest, wigs; women in sheath dresses, some with bead nets.', 'Run provinces and estates; their rock tombs show wrestling, weaving, farming and hunting.'],
        ['Priests', 'Temple staff serving in rotation, high priests of great temples.', 'Shaved heads, white linen.', 'Rites, offerings and temple estates.'],
        ['Scribes and officials', 'A growing class of administrators. "Be a scribe!" says the Satire of the Trades, which mocks every other job.', 'Linen kilts, pen cases.', 'Taxes, household lists, letters and legal papers (the Lahun papyri).'],
        ['Soldiers', 'Garrisons in the Nubian forts (Buhen, Semna) and Medjay desert scouts.', 'Kilts, bows, cowhide shields, axes and spears.', 'Guard the southern border and the trade routes.'],
        ['Craftsmen', 'Jewellers, carpenters, potters and weavers; a planned workers\' town at Lahun.', 'Loincloths and kilts.', 'Fine jewellery (the Lahun treasure), furniture, linen.'],
        ['Farmers and labourers', 'Most people: farmers, herders and fishers.', 'Loincloths, short kilts, simple dresses.', 'Farm and herd; owe labour duty to the state, and officials chase workers who run away from it.'],
        ['Servants', "Household servants, including 'Asiatic' men and women from the Levant named in the Brooklyn papyrus.", 'Simple linen.', 'Weave, brew, cook and serve in households.'],
      ]],
      ['Second Intermediate Period (1650-1550 BC)', [[-1650, -1550]], 'Hyksos kings rule the north from Hut-waret (Avaris); Egyptian kings at Waset hold the south and fight back. Horses and chariots appear in Egypt.', [
        ['Hyksos kings', 'Rulers of Levantine origin, "heqa khasut" (rulers of foreign lands), at Hut-waret.', 'Mixed Levantine and Egyptian dress.', 'Control the Delta and trade with the Levant; take Egyptian royal titles.'],
        ['Theban kings (Dynasty 17)', 'Egyptian kings at Waset who start the war of liberation (Seqenenre Tao, Kamose).', 'Royal kilt and crowns.', 'Fight the Hyksos; Seqenenre\'s mummy shows the axe wounds that killed him.'],
        ['Officials and soldiers', 'The officials of both courts; soldiers, Medjay archers and the first chariot crews.', 'Kilts, leather armour, bows and axes.', 'Run the two halves of the land and fight their war.'],
        ['Traders and settlers', 'Levantine settlers and merchants in the Delta.', 'Their own woollen garments beside Egyptian linen.', 'Trade, herd and serve in the north.'],
        ['Farmers', 'Most people, paying taxes to whichever king holds their land.', 'Loincloths and simple dresses.', 'Farm and herd.'],
      ]],
    ],
    'new-kingdom': [
      ['New Kingdom (1550-1069 BC)', [[-1550, -1069]], 'An empire from Nubia to Syria. The temples of Amun grow vast; the army becomes a career.', [
        ['Pharaoh (per-aa)', '"The great house": the word for the palace becomes a name for the king himself in this period.', 'Blue khepresh crown, nemes or double crown; fine pleated translucent linen, gold collars and armlets, sandals.', 'Leads campaigns by chariot, builds at Ipet-sut (Karnak) and is buried in the Valley of the Kings; keeps maat.'],
        ['Great Royal Wife and royal family', 'Queens such as Hatshepsut (who ruled as king), Tiye and Nefertari; royal children raised with nobles\' sons in the palace nursery (kap).', 'Vulture crown or tall plumes, sheer pleated robes, wigs with side-locks.', 'Rule beside the king, run great estates, take part in the rites.'],
        ['Viziers and the Viceroy of Kush', 'Two viziers (south at Waset, north at Men-nefer); the "King\'s Son of Kush" governs Nubia.', "The vizier's long plain robe tied under the arms, wig, gold.", 'Report to the king every day, judge cases, gather taxes, guard the royal tombs (the duties are written in Rekhmire\'s tomb).'],
        ['High Priest of Amun and the priesthood', 'The High Priest at Ipet-sut controls huge estates and later rivals the king (Dynasty 21); the God\'s Wife of Amun is a royal woman.', 'Shaved heads, white linen; leopard skin for the sem priest.', 'Run temple estates with fields, herds, workshops and boats; lead festivals such as Opet.'],
        ['Army officers and charioteers', 'Generals, chariot warriors (a prestige corps since horses arrived c. 1650 BC), standard-bearers; foreign troops such as the Sherden.', 'Leather or scale armour, kilts, quivers, the curved khepesh sword.', 'Fight in Syria and Nubia; rewarded with land, gold and captives.'],
        ['Officials and scribes', 'Overseers of the granaries, treasury and cattle; army scribes who count the enemy dead.', 'Long pleated kilts, wigs, collars.', 'Measure fields with ropes, record harvests and taxes, run the temples and palaces.'],
        ['Skilled craftsmen', 'The royal tomb builders of Set-maat (Deir el-Medina), who went on the first recorded strike (Ramesses III, year 29).', 'Loincloths, linen kilts, headbands, sandals.', 'Cut and paint the royal tombs; live in a walled village whose ostraca record sick days, rations and quarrels.'],
        ['Farmers, herders and fishers', 'Most people, many as tenants on temple and crown land.', 'Loincloths and short kilts; women in simple sheath dresses.', 'Farm, herd and fish; lift water with the shaduf (seen from the 18th dynasty); pay harvest taxes.'],
        ['Servants and slaves', 'War captives from Syria and Nubia and household servants; slaves could be bought, sold, hired out and freed.', 'Simple linen.', 'Work in temples, estates and homes.'],
      ]],
    ],
    'late-persian': [
      ['Libyan and Kushite kings (1069-664 BC)', [[-1069, -664]], 'The land splits: kings of Libyan descent in the Delta, the High Priests of Amun at Waset, then Kushite kings from Napata reunite it.', [
        ['Kings', 'Kings of Meshwesh Libyan descent (Sheshonq I) at Djanet (Tanis) and Per-Bast, then the Kushite pharaohs (Piye, Taharqa).', 'Royal regalia; the Kushite kings wear a close cap crown with two uraei and ram-headed amulets.', 'Rule parts of the land, then all of it under Kush.'],
        ["High Priest and God's Wife of Amun", 'At Waset the High Priests rule in Dynasty 21; later the God\'s Wife of Amun, a royal daughter, heads the Theban temple estate.', 'Priestly white linen; the God\'s Wife in a tight dress with a vulture cap.', 'Govern Waset and its temple wealth.'],
        ['Libyan chiefs and warrior families', 'Great Chiefs of the Ma (Meshwesh) holding Delta towns.', 'A feather in the hair, the old Libyan sign, with Egyptian dress.', 'Rule their towns and lead their warriors.'],
        ['Priests and scribes', 'Rich temple families and the scribes who keep their records.', 'White linen.', 'Keep the cults, estates and archives.'],
        ['Craftsmen', 'Temple and court workshops.', 'Linen kilts.', 'Bronze statues and statuettes, faience, fine coffins.'],
        ['Farmers', 'Most people.', 'Loincloths and simple dresses.', 'Farm and herd, paying whichever lord rules their town.'],
      ]],
      ['Saite and last native kings (664-525, 404-343 BC)', [[-664, -525], [-404, -343]], 'Egyptian kings revive the old styles; Greeks arrive as soldiers and traders.', [
        ['Pharaoh', 'Saite kings (Psamtik I, Amasis), later the last native kings (Nakhtnebef).', 'Royal regalia in the old Old Kingdom style.', 'Rule from Sau (Sais), hire foreign troops, build temples.'],
        ["God's Wife of Amun", "A royal daughter adopted at Waset, ruling the Theban temple estate.", 'Tight dress, vulture cap, double plumes.', "Keeps the south loyal to the king."],
        ['Soldiers and mercenaries', 'Egyptian warrior families (machimoi) and Greek and Carian mercenaries, who carved their names on the colossi at Abu Simbel.', 'Egyptian kilts; Greek bronze helmets and round shields.', 'Guard the borders and fight Babylon and Persia.'],
        ['Greek traders', 'Merchants at Naukratis, the trading town granted to Greeks by Amasis.', 'Woollen chiton and himation.', 'Trade silver, oil and wine for grain, linen and papyrus.'],
        ['Priests', 'Rich temple families; animal cults grow huge.', 'Shaved heads, white linen.', 'Rites, animal burials, temple workshops and land.'],
        ['Scribes', 'Officials writing the new demotic script for daily business.', 'Linen kilts, reed pens.', 'Contracts, taxes and letters.'],
        ['Farmers', 'Most people.', 'Loincloths and simple dresses.', 'Farm and herd, paying taxes in grain.'],
      ]],
      ['Persian rule (525-404, 343-332 BC)', [[-525, -404], [-343, -332]], 'Egypt becomes a province (satrapy) of the Persian Empire.', [
        ['Great King of Persia', 'Cambyses, Darius I and their heirs: absent rulers, styled pharaohs in Egyptian texts.', 'Persian robes and crown; shown as pharaoh in temple images.', 'Rule from Persia through a governor.'],
        ['Satrap', 'The Persian governor at Men-nefer (Aryandes, Arsames, whose Aramaic letters survive).', 'Persian trousers, coat and soft cap.', 'Collects tribute, commands the garrisons.'],
        ['Persian officials and garrisons', 'Officials and soldiers, including the Jewish garrison at Yeb (Elephantine) whose Aramaic papyri survive.', 'Their own dress.', 'Guard the borders and the river.'],
        ['Egyptian collaborators and priests', 'Men such as Udjahorresnet, a priest and doctor who served Cambyses and Darius.', 'White linen, naophorous statues.', 'Advise the Persians and protect the temples.'],
        ['Scribes', 'Aramaic for the empire, demotic for Egyptians.', 'Linen kilts.', 'Keep the records of the satrapy.'],
        ['Farmers', 'Most people.', 'Loincloths and simple dresses.', 'Farm and pay tribute.'],
      ]],
    ],
    ptolemaic: [
      ['Ptolemaic Egypt (332-30 BC)', [[-332, -30]], 'Macedonian Greek kings rule from Alexandria; Greek is the language of government, while the Egyptian temples are kept rich and loyal.', [
        ['King and queen (the Ptolemies)', 'Greek-speaking Macedonian kings and powerful queens (Arsinoe II, Cleopatra VII): pharaohs in temple reliefs, basileus in Alexandria.', 'In Alexandria a white diadem ribbon and Greek cloak; in temple images the full pharaonic regalia.', 'Rule from Alexandria, fight the Seleucids, fund temples to win the priests.'],
        ['Court and Greek officials', 'The finance minister (dioiketes) and a governor (strategos) for each nome.', 'Greek chiton and himation.', 'Run the taxes and monopolies (oil, beer, linen, papyrus).'],
        ['Egyptian high priests', 'The priests of Ptah at Men-nefer crown the kings; priestly synods issue decrees such as the Rosetta Stone (196 BC).', 'Shaved heads, white linen, leopard skin.', 'Keep the temples and their land; new temples rise at Edfu, Dendera and Philae.'],
        ['Greek citizens and soldier-settlers', 'Citizens of Alexandria, Naukratis and Ptolemais, and cleruchs: soldiers given land, many in the Fayum.', 'Chiton, himation, the broad-brimmed petasos hat.', 'Farm their land plots, serve in the army, run businesses.'],
        ['Egyptian scribes and village officials', 'The village scribe (komogrammateus) and his colleagues.', 'Linen tunics and kilts.', 'Keep land and tax records in Greek and demotic.'],
        ['Egyptian farmers', 'Most people, many as "royal farmers" on crown land.', 'Linen kilts and tunics, simple dresses.', 'Farm under heavy taxes; strikes and revolts flare in the south.'],
        ['Slaves', 'Household slaves, fewer than in the Greek homeland.', 'Simple tunics.', 'Serve in homes and workshops.'],
      ]],
    ],
    roman: [
      ['Roman Egypt (30 BC-AD 395)', [[-30, 395]], "Egypt becomes the emperor's own province and Rome's granary.", [
        ['Emperor', "Rules from Rome; shown as pharaoh in Egypt's temples; rarely visits (Hadrian did, in AD 130).", 'Toga and laurel in Rome; pharaonic regalia in temple images.', 'Takes Egypt\'s grain and taxes.'],
        ['Prefect of Egypt', 'A knight (equestrian), never a senator; senators needed permission even to enter Egypt.', 'Toga or military dress.', 'Governs from Alexandria, tours the nomes to hear cases.'],
        ['Roman army and citizens', 'Legions at Nikopolis by Alexandria, auxiliaries along the frontiers; veterans and Roman citizens.', 'Tunic, armour, military cloak and belt.', 'Guard the land, the roads and the quarries.'],
        ['Greek citizens and the gymnasium class', 'Alexandrians and the "metropolites" of the nome capitals, who paid a lower poll tax.', 'Tunic and himation; Greek hairstyles (as in the Fayum mummy portraits).', 'Run the towns, the gymnasia and the local councils.'],
        ['Egyptian priests', 'Temple staff watched by the official called the Idios Logos, who limited their numbers and privileges.', 'Shaved heads, white linen.', 'Keep the old gods\' temples alive.'],
        ['Villagers', 'Egyptian farmers paying the full poll tax (laographia); a census every 14 years.', 'Tunics and mantles, sandals.', 'Grow the grain shipped to Rome, keep the canals, serve compulsory duties.'],
        ['Slaves', 'Household slaves, recorded in the census returns.', 'Simple tunics.', 'Serve in homes and on estates.'],
      ]],
    ],
    'coptic-byzantine': [
      ['Coptic and Byzantine Egypt (AD 395-641)', [[395, 641]], "Christian Egypt ruled from Constantinople; after 451 the Egyptian (Coptic) church splits from the emperor's church.", [
        ['Emperor', 'Rules from Constantinople.', 'Purple robes, jewelled diadem.', "Taxes Egypt and ships its grain to Constantinople."],
        ['Governors and the Patriarch', 'The Augustal prefect and the military duke; the Patriarch of Alexandria, the most powerful man in Egypt, with rival Coptic and imperial patriarchs after 451.', 'Officials in long tunics and cloaks; the patriarch in church vestments.', 'Govern, judge and lead the church.'],
        ['Great landowners', 'Families such as the Apions of Oxyrhynchus, with huge estates and their own guards.', 'Silk-trimmed tunics and cloaks.', 'Collect rents and taxes, run estates and private postal services.'],
        ['Bishops, clergy and monks', "Bishops, priests and the monks of the desert monasteries (Shenoute's White Monastery, Pachomius' communities, Scetis).", 'Monks: hooded tunic, leather belt and cloak.', 'Prayer, copying books, weaving baskets and linen, caring for the poor.'],
        ['Town officials and scribes', 'Pagarchs and village headmen; documents in Greek and Coptic.', 'Long tunics.', 'Collect taxes, keep the records.'],
        ['Tenant farmers (coloni)', 'Most people, tied to the estates they farm.', 'Linen or wool tunics with woven purple roundels and stripes (Coptic textiles).', 'Farm, pay rent in grain, do estate work.'],
        ['Slaves', 'Household slaves.', 'Simple tunics.', 'Serve in homes.'],
      ]],
    ],
    'early-islamic': [
      ['Early Islamic Egypt (AD 641-969)', [[641, 969]], "Arab conquest under 'Amr ibn al-'As (641). For two centuries a Muslim minority rules a Christian, Coptic-speaking majority.", [
        ['Caliph', 'In Medina, then Damascus (the Umayyads, 661) and Baghdad (the Abbasids, 750). The Tulunids (868-905) and Ikhshidids rule Egypt almost independently.', 'Turban, long robes, cloak.', 'Appoints the governor, receives the taxes.'],
        ['Governor (amir)', 'Rules from Fustat.', 'Turban, robes, sword.', 'Commands the army and leads the Friday prayer.'],
        ['Arab soldiers and settlers', "The army registered in the diwan and paid stipends ('ata'); tribes settled in Fustat's quarters.", 'Turban, long shirt (qamis), cloak, sword.', 'Garrison the land, fight on the frontiers, settle and trade.'],
        ['Judges and scholars', "Qadis and early Muslim scholars (Imam al-Shafi'i died in Fustat in 820).", 'Turban and long robes.', 'Judge, teach and write.'],
        ['Coptic patriarch, clergy and notables', 'They lead the Christian majority; Coptic officials and scribes keep the tax system running (in Greek and Coptic, then Arabic after 706).', 'Tunics, church vestments.', 'Run their community and the village administration.'],
        ['Peasants', "Mostly Coptic farmers paying land tax (kharaj) and poll tax (jizya); revolts such as the Bashmurian (831).", 'Woollen and linen tunics.', 'Farm the flood land and pay the taxes that feed the caliphate.'],
        ['Slaves and servants', 'Household slaves; Turkish and Black African soldier-slaves under Ibn Tulun.', 'Simple tunics.', 'Serve in homes and the army.'],
      ]],
    ],
    fatimid: [
      ['Fatimid Egypt (AD 969-1171)', [[969, 1171]], "Isma'ili Shi'i imam-caliphs found al-Qahira (Cairo) in 969 and rule much of the Mediterranean.", [
        ['Imam-Caliph', "Al-Mu'izz, al-Hakim, al-Mustansir: a semi-sacred ruler seen rarely, in great processions under a parasol.", 'Robes with inscribed tiraz bands, a turban with a jewel.', 'Rules from the palaces of al-Qahira.'],
        ['Vizier', "Head of government; from 1074 the military 'viziers of the sword' (Badr al-Jamali) hold the real power.", 'Rich robes of honour.', 'Runs the state and the army.'],
        ["Chief Qadi and Chief Da'i", "Isma'ili judges and missionaries.", 'Turban and robes.', "Judge, teach the doctrine in public 'sessions of wisdom'."],
        ['Army', 'Kutama Berbers, Turkish horsemen and Black African infantry, often rivals.', 'Mail, swords, lances, turbans.', 'Fight and, too often, fight each other.'],
        ['Officials, Muslim, Christian and Jewish', "Secretaries and treasurers, including Copts and Jews (the vizier Ya'qub ibn Killis was born a Jew).", 'Robes of office.', 'Run the treasury and the offices.'],
        ['Merchants', 'Traders of Fustat in the Mediterranean and India trade; their letters survive in the Cairo Geniza.', 'Turbans, robes, cloaks.', 'Trade flax, linen, spices, dyes and books.'],
        ['Artisans', 'Workshops of rock crystal, lustre pottery, carved wood and fine linen and silk (Tinnis).', 'Simple robes, aprons.', 'Make the luxury goods Fatimid Egypt was famous for.'],
        ['Peasants (fellahin)', 'Most people.', 'Long shirts, skullcaps or turbans.', 'Farm the flood land.'],
      ]],
    ],
    'ayyubid-mamluk': [
      ['Ayyubid and Mamluk Egypt (AD 1171-1517)', [[1171, 1517]], "Salah al-Din's Ayyubids (1171-1250), then Mamluk sultans who began as slave soldiers (1250-1517).", [
        ['Sultan', 'Salah al-Din and his family; then Mamluk sultans (Baybars, Qalawun, al-Nasir Muhammad, Qaytbay) ruling from the Citadel of Cairo.', 'Fine robes, a great turban, sword.', 'Rule, fight the Crusaders and the Mongols, build mosques, madrasas and hospitals.'],
        ['Abbasid caliph (in Cairo)', 'From 1261 a caliph without power lives in Cairo and confirms each sultan.', 'Black Abbasid robes.', 'Gives the sultans legitimacy.'],
        ['Amirs', "Commanders of 100, 40 or 10 horsemen, paid with the income of land grants (iqta').", "Belted coat (qaba'), sash, coloured cap wound with a turban, sword.", 'Command, govern districts, build monuments, compete for the throne.'],
        ['Mamluks', 'Boys bought from the Kipchak steppe and later the Caucasus (Circassians), raised in barracks, then freed as cavalrymen; only they could become amirs.', 'Coat, sash, cap, bow and sword.', 'Train, fight and guard the sultan.'],
        ['Ulama and Sufis', 'Judges of the four schools, teachers at al-Azhar and the madrasas, Sufi sheikhs in their lodges.', 'Large turban and scholar\'s shawl (taylasan).', 'Judge, teach, run endowments, preach.'],
        ['Civil secretaries', "Clerks of the treasury and offices, many of them Copts or converts. From 1301 Christians had to wear blue turbans and Jews yellow ones.", 'Robes with the turban colour of their community.', 'Keep the accounts of the state.'],
        ['Karimi merchants', 'Great spice traders between India, Yemen and Alexandria.', 'Rich robes and turbans.', 'Trade pepper, spices, sugar and textiles.'],
        ['Artisans', 'Makers of enamelled glass, inlaid brass, carpets and books in the crowded markets of Cairo.', 'Simple robes, aprons.', 'Make the famous Mamluk crafts.'],
        ['Peasants (fellahin)', "Most people, farming iqta' land; hit hard by the Black Death after 1347.", 'Long shirts, skullcaps or turbans.', 'Farm the land whose income pays the amirs.'],
      ]],
    ],
    ottoman: [
      ['Ottoman Egypt (AD 1517-1805)', [[1517, 1805]], 'Selim I conquers Egypt in 1517. It becomes an Ottoman province, where Mamluk households rise again.', [
        ['Ottoman Sultan', 'Rules from Istanbul.', 'Robes and great turban.', 'Takes the tribute and appoints the governor.'],
        ['Pasha (governor)', 'Sent from Istanbul, often for a year or two; lives in the Citadel and is often weak.', 'Kaftan, tall turban.', 'Collects the tribute for Istanbul.'],
        ['Beys and Mamluk households', 'Grandees with their own mamluks, the real power in the 18th century (Ali Bey al-Kabir).', 'Rich kaftans, turbans, weapons.', 'Rule districts, hold tax farms, fight each other.'],
        ['Military corps', 'Seven regiments, the Janissaries and Azeban among them, who also ran businesses and tax farms.', 'Uniform caps and coats by regiment.', 'Garrison Cairo and take a share of trade and taxes.'],
        ['Ulama', 'The sheikhs of al-Azhar and the judges; the people\'s voice in crises.', 'Large turbans and robes.', 'Teach, judge and mediate.'],
        ['Tax farmers (multazims)', 'Men who bought the right to collect a village\'s taxes (iltizam), often officers or beys.', 'Kaftans and turbans.', 'Collect taxes and keep a share.'],
        ['Merchants', 'Wealthy traders in coffee, spices and textiles.', 'Kaftans, turbans.', 'Trade through Cairo, Suez and Alexandria.'],
        ['Guild craftsmen', 'Artisans and shopkeepers in guilds (ta\'ifa) under a sheikh.', 'Long shirts, waistcoats, turbans.', 'Make and sell in the markets.'],
        ['Peasants (fellahin)', 'Most people.', 'Long shirts, skullcaps; women in long dresses and head cloths.', 'Farm and pay the tax farmers.'],
      ]],
    ],
    modern: [
      ["Muhammad Ali's dynasty and British rule (1805-1952)", [[1805, 1952]], "Muhammad Ali builds a modern state; his heirs rule as khedives and kings; Britain occupies Egypt from 1882.", [
        ['Pasha, Khedive, then King', 'Muhammad Ali, Ismail, Fuad I, Farouk.', 'Military uniforms or frock coat and tarbush (fez).', 'Build armies, canals, railways and cotton estates.'],
        ['British agents and foreign consuls', 'The British occupation from 1882 (Lord Cromer); foreigners tried in their own consular and Mixed Courts.', 'European suits and uniforms.', 'Control finance, the army and policy.'],
        ['Turco-Circassian elite and great landowners', 'Pashas and beys with cotton estates.', 'Tarbush, frock coat (stambouli), later Western suits.', 'Own the land, sit in government and parliament.'],
        ['Effendiyya', 'Egyptian-educated civil servants, lawyers, teachers and officers, the backbone of the 1919 revolution.', 'Western suit and tarbush.', 'Run the offices, schools and newspapers.'],
        ['Ulama', 'The sheikhs of al-Azhar.', 'Turban and robe (caftan).', 'Teach, judge, issue opinions.'],
        ['Workers and craftsmen', 'Railway, cotton-gin and cigarette workers; old crafts in decline.', 'Galabiya or work clothes, skullcap.', 'Work in the new factories, workshops and ports.'],
        ['Peasants (fellahin)', 'Most people; forced labour (corvée) dug canals, the Suez Canal included, until the 1880s.', 'Galabiya and skullcap or turban; women in long dresses and black head cloths.', 'Grow cotton and food on other men\'s land.'],
      ]],
      ['The Republic (1952 onward)', [[1952, 2030]], 'The 1952 revolution ends the monarchy.', [
        ['President', 'Gamal Abdel Nasser, Anwar Sadat, Hosni Mubarak and their successors.', 'Suit or military uniform.', 'Lead the state.'],
        ['Army officers and ministers', 'The Free Officers led the 1952 revolution; the army stays central to the state.', 'Uniforms and suits.', 'Govern and run large parts of the economy.'],
        ['Business elite', "Grows after the 1974 'Infitah' (opening) of the economy.", 'Suits.', 'Own companies, land and trade.'],
        ['Professionals and civil servants', 'Teachers, doctors, engineers and a large state bureaucracy.', 'Suits and everyday clothes.', 'Run schools, hospitals and offices.'],
        ['Religious leaders', 'The Sheikh of al-Azhar and the Coptic Pope.', 'Turban and robe; Coptic black robes and hood.', 'Lead Egypt\'s Muslims and Christians.'],
        ['Workers', 'Factory workers and the builders of the Aswan High Dam.', 'Work clothes or galabiya.', 'Build and make.'],
        ['Peasants (fellahin)', 'Land reform from 1952 gives many their own small plots; millions move to the cities.', 'Galabiya; women in long dresses and head scarves.', 'Farm the valley and the Delta.'],
      ]],
    ],
  };
  window.SOCIAL = SOCIAL;

  function phaseIndex(age, y) {
    const P = SOCIAL[age] || [];
    if (y == null || isNaN(y)) return 0;
    const i = P.findIndex((p) => p[1].some(([a, b]) => y >= a && y < b));
    return i < 0 ? 0 : i;
  }
  /** What the AI gets: the social order for the story's age and year. */
  function socialContext(age, y) {
    const P = SOCIAL[age];
    if (!P) return '';
    const p = P[phaseIndex(age, y)];
    return `SOCIAL ORDER OF THIS AGE, top to bottom (${p[0]}; ${p[2]}) Use it for who is who, what each rank wears and what they do:\n` +
      p[3].map((t, i) => `${i + 1}. ${t[0]}: ${t[1]} WEARS: ${t[2]} WORK: ${t[3]}`).join('\n');
  }

  // Every AI prompt in the Desk already includes loreContext(age): add the social order, the episode's feed and the education rules.
  if (typeof window.loreContext === 'function') {
    const base = window.loreContext;
    window.loreContext = function (age) {
      const e = ep();
      let y = null;
      try { y = e && e.year ? parseYearStr(e.year) : null; } catch (_) { y = null; }
      return [base(age), socialContext(age, y), wardrobeContext(age), feedContext(e), eduRules()].filter(Boolean).join('\n');
    };
  }

  // ---- Pyramid drawing: carved stone blocks, gold relief icons, parchment with faint hieroglyphs.
  // Gold relief icons (drawn once, used with <use>). Strokes/fills use one shared metallic gradient.
  const ICONS = {
    crown: '<path d="M5 23 6.5 9l6 7L16 6l3.5 10 6-7L27 23z"/><rect x="5" y="24.5" width="22" height="3.5" rx="1.2"/>',
    sceptre: '<path d="M14.5 30V12c0-6 9.5-7.5 9.5-1.5 0 3.2-3.3 4.2-5.3 2.8l1.3-1.9c.9.6 1.9.1 1.9-.9 0-2.9-5.4-2.4-5.4 1.5V30z"/><path d="M12 28h7v2.5h-7z"/>',
    feather: '<path d="M16 2c7.5 6.5 7.5 18.5 0 28-7.5-9.5-7.5-21.5 0-28z"/><path d="M16 5v24" fill="none" stroke="#4a2c0c" stroke-width=".9"/>',
    scroll: '<rect x="7" y="8" width="18" height="16" rx="1.5"/><rect x="4" y="6" width="5" height="20" rx="2.5"/><rect x="23" y="6" width="5" height="20" rx="2.5"/><path d="M11 13h10M11 16.5h10M11 20h7" stroke="#4a2c0c" stroke-width="1" fill="none"/>',
    pen: '<rect x="5" y="4" width="10" height="24" rx="2"/><circle cx="10" cy="9" r="2" fill="#4a2c0c"/><circle cx="10" cy="14" r="2" fill="#4a2c0c"/><path d="M19 28 25.5 4.5l2.4.7L21.5 28.6z"/>',
    eye: '<path d="M3 14c6-7.5 20-7.5 26 0-6 6.5-20 6.5-26 0z"/><circle cx="16" cy="14" r="3.6" fill="#4a2c0c"/><path d="M12.5 18.8 10.5 27h2.6l2.8-7.4z"/><path d="M20 19.5c2.5 4.5 6 5 8.5 2.2l-1.3-1.2c-1.6 1.6-3.7 1.3-5.4-1.9z"/>',
    sword: '<path d="M7.5 25.5l2.6-2.6 2.6 2.6-2.6 2.6z"/><path d="M11.5 22.5l3.8-3.8c1.2-6.4 7.4-11 13.7-10.2-5.8 1.6-9.4 5.6-10.4 11.4l-4.3 4.4z"/>',
    shield: '<path d="M8 6.5c0-2.6 16-2.6 16 0V19c0 5.4-8 10-8 10s-8-4.6-8-10z"/><path d="M11 9.5h10V19c0 3.4-5 6.4-5 6.4s-5-3-5-6.4z" fill="none" stroke="#4a2c0c" stroke-width="1"/>',
    hammer: '<rect x="4" y="5" width="14" height="9" rx="2"/><rect x="9.5" y="13" width="3.2" height="16" rx="1.2"/><path d="M21 4h3.5v15.5L22.8 25 21 19.5z"/>',
    vase: '<path d="M12 3h8v3.5c0 2 5 4.6 5 11.3C25 24 21 29 16 29s-9-5-9-11.2C7 11.1 12 8.5 12 6.5z"/><path d="M9.5 16h13" stroke="#4a2c0c" stroke-width="1" fill="none"/>',
    jars: '<path d="M5 9h6v2c0 1 3.5 3 3.5 8S12 28 8 28s-6.5-4-6.5-9S5 12 5 11z"/><path d="M19 6h7v2.5c0 1.4 4 3.6 4 9.5S27 28 22.5 28 15 24 15 18s4-8 4-9.5z"/>',
    boat: '<path d="M1.5 20.5c6.5 6 22.5 6 29 0l-2.3-1.4c-6.4 3.6-18 3.6-24.4 0z"/><path d="M15.2 3.5h1.8v17h-1.8z"/><path d="M17.8 5.5 27 18H17.8z"/>',
    wheat: '<path d="M15.2 9h1.6v21h-1.6z"/><ellipse cx="16" cy="5" rx="2" ry="3.4"/><ellipse cx="12.3" cy="10.5" rx="1.9" ry="3.3" transform="rotate(-32 12.3 10.5)"/><ellipse cx="19.7" cy="10.5" rx="1.9" ry="3.3" transform="rotate(32 19.7 10.5)"/><ellipse cx="12.3" cy="16.5" rx="1.9" ry="3.3" transform="rotate(-32 12.3 16.5)"/><ellipse cx="19.7" cy="16.5" rx="1.9" ry="3.3" transform="rotate(32 19.7 16.5)"/>',
    cow: '<path d="M9 11c-4.2 0-7-3.4-7-6.5 2.8 2 5 2.4 7.4 2.2 2.6-1.8 10.6-1.8 13.2 0 2.4.2 4.6-.2 7.4-2.2 0 3.1-2.8 6.5-7 6.5l-1.3 11.3c-.8 5.6-10.6 5.6-11.4 0z"/><circle cx="12.8" cy="14" r="1.3" fill="#4a2c0c"/><circle cx="19.2" cy="14" r="1.3" fill="#4a2c0c"/>',
    ankh: '<path fill-rule="evenodd" d="M16 2.5c-4.3 0-6.6 3-6.6 6.4 0 3 2.6 5.6 4.4 6.9H6.5v3.4h7.8V30h3.4V19.2h7.8v-3.4h-7.3c1.8-1.3 4.4-3.9 4.4-6.9 0-3.4-2.3-6.4-6.6-6.4zm0 3.2c2 0 3.2 1.3 3.2 3.3s-1.8 4.3-3.2 5.5c-1.4-1.2-3.2-3.5-3.2-5.5s1.2-3.3 3.2-3.3z"/>',
    scales: '<path d="M15 4.5h2v22h-2z"/><path d="M5.5 8.5h21v2h-21z"/><path d="M3 18.5 7 10.5l4 8c0 2.4-8 2.4-8 0z"/><path d="M21 18.5l4-8 4 8c0 2.4-8 2.4-8 0z"/><path d="M10 26.5h12v2.5H10z"/>',
    kilt: '<path d="M7.5 7h17v3.2h-17z"/><path d="M8 10.2h16l3.2 16H4.8z"/><path d="M16 10.2v16M12 10.2l-2.5 16M20 10.2l2.5 16" stroke="#4a2c0c" stroke-width=".9" fill="none"/>',
    dress: '<path d="M11 2.5h2.2l1.2 7h3.2l1.2-7h2.2l-1.2 8.5c2.2 4 3.4 10.4 3.4 18.5H8.8c0-8.1 1.2-14.5 3.4-18.5z"/>',
    child: '<circle cx="16" cy="7" r="4.3"/><path d="M11.8 6.5c-2.4.4-3 3.6-1.8 5.6l1.4-.6c-.6-1.2-.4-3 .9-3.4z"/><path d="M11 12.5h10l-1.2 9h-2l-.9 8h-1.8l-.9-8h-2z"/>',
    wig: '<path d="M16 2.5C9.4 2.5 6 7 6 13v14h5.2v-9.5c1.2 2.2 2.8 3.4 4.8 3.4s3.6-1.2 4.8-3.4V27H26V13c0-6-3.4-10.5-10-10.5z"/><ellipse cx="16" cy="14" rx="4.3" ry="5.4" fill="#4a2c0c"/>',
    collar: '<path d="M3.5 8.5c0 9.6 5.6 16 12.5 16s12.5-6.4 12.5-16h-5.6c0 6-3 10.2-6.9 10.2S9.1 14.5 9.1 8.5z"/><path d="M6.3 12.2c1.6 5.2 5.2 8.8 9.7 8.8s8.1-3.6 9.7-8.8" fill="none" stroke="#4a2c0c" stroke-width="1"/>',
    mirror: '<circle cx="16" cy="11" r="8.2"/><circle cx="16" cy="11" r="5.6" fill="none" stroke="#4a2c0c" stroke-width=".9"/><path d="M14.5 19h3v5.5h2.2V29h-7.4v-4.5h2.2z"/>',
    sandal: '<path d="M11 2.6c4.4-1.2 9.2 1.4 9.2 8.4 0 6.6-1.1 9.2-1.1 13.3 0 3.6-2 5.9-5 5.9s-5.1-3.1-5.1-7.1c0-4.2 2.1-6.2 2.1-11.2S9.9 3.5 11 2.6z"/><path d="M9.6 14.4c3.1 1.1 6.3 1.1 9.4 0M13.4 4.2l.8 10" fill="none" stroke="#4a2c0c" stroke-width="1.1"/>',
    spindle: '<path d="M15 1.5h2v29h-2z"/><ellipse cx="16" cy="23" rx="8.5" ry="2.8"/><path d="M11.5 7.5c3 1.6 6 1.6 9 0M11.5 11c3 1.6 6 1.6 9 0M11.5 14.5c3 1.6 6 1.6 9 0" fill="none" stroke="#4a2c0c" stroke-width="1.2"/>',
    hourglass: '<path d="M7.5 2.5h17v3c0 5.3-5.4 7.4-5.4 10.5s5.4 5.2 5.4 10.5v3h-17v-3c0-5.3 5.4-7.4 5.4-10.5S7.5 10.8 7.5 5.5z"/><path d="M11 26.5c1.8-2.6 3.4-3.6 5-3.6s3.2 1 5 3.6z" fill="#4a2c0c"/>',
    no: '<circle cx="16" cy="16" r="11.5" fill="none" stroke="url(#pyrGold)" stroke-width="3.6"/><path d="M7.8 24.2 24.2 7.8" fill="none" stroke="url(#pyrGold)" stroke-width="3.6"/>',
    basket: '<path d="M4.5 14h23L24.5 28h-17z"/><path d="M9 14c0-7 14-7 14 0" fill="none" stroke="url(#pyrGold)" stroke-width="2.4"/><path d="M8.5 19h15M9.5 23.5h13" stroke="#4a2c0c" stroke-width="1" fill="none"/>',
  };
  (function pyrDefs() {
    if ($id('pyrDefs')) return;
    const d = document.createElement('div');
    d.id = 'pyrDefs';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = `<svg width="0" height="0"><defs><linearGradient id="pyrGold" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#e2b35a"/><stop offset=".75" stop-color="#b17b2c"/><stop offset="1" stop-color="#7a4f16"/></linearGradient></defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="pyri-${k}" viewBox="0 0 32 32"><g fill="url(#pyrGold)" stroke="#5a3810" stroke-width=".6">${v}</g></symbol>`).join('')}</svg>`;
    document.body.appendChild(d);
  })();
  const icon = (k, side) => `<svg class="pyr-ico ${side}" aria-hidden="true"><use href="#pyri-${k}"/></svg>`;
  /** Two icons for a level, picked from its title and description. */
  const ICON_RULES = [
    [/\b(king|kings|pharaoh|caliph|sultan|emperor|president|pasha|khedive|chief|chiefs|imam|great king)\b/i, ['crown', 'sceptre']],
    [/queen|royal wife|royal family/i, ['crown', 'ankh']],
    [/priest|ulama|qadi|judge|clergy|bishop|monk|patriarch|religious|ritual|da'i|sufi|god's wife/i, ['eye', 'feather']],
    [/army|soldier|charioteer|mamluk|military|mercenar|regiment|warrior|corps/i, ['sword', 'shield']],
    [/vizier|satrap|governor|prefect|amir|bey|viceroy|nomarch|noble|court|landowner|elite|minister|official|seal|agent|consul|tax/i, ['scroll', 'ankh']],
    [/scribe|secretar|effendi|professional|civil|scholar/i, ['pen', 'scroll']],
    [/trader|merchant|boat|karimi|business/i, ['boat', 'scales']],
    [/craft|artisan|builder|worker|guild/i, ['hammer', 'vase']],
    [/farmer|peasant|fellahin|herd|villager|tenant|coloni|hunter|gatherer|settler/i, ['wheat', 'cow']],
    [/servant|slave|retainer|dependant|children|captive/i, ['basket', 'jars']],
  ];
  const iconsFor = (t) => (ICON_RULES.find(([re]) => re.test(t[0])) || ICON_RULES.find(([re]) => re.test(t[1])) || [0, ['ankh', 'feather']])[1];
  // Stone per level, top first: [top colour, bottom colour, light stone (dark lettering)?]
  const STONE = [['#f1d79a', '#b9873e', 1], ['#b48a60', '#74502f'], ['#c1573a', '#7b2816'], ['#a37462', '#674033'], ['#a0452a', '#5f2012'], ['#9f7049', '#654126'], ['#b35c36', '#6e3017'], ['#93714f', '#5a4129'], ['#913d2c', '#581d13']];
  // How each level is cut into blocks (fractions of its width)
  const CUTS = [[1], [0.2, 0.8], [0.79, 0.21], [0.24, 0.52, 0.24], [0.2, 0.58, 0.22], [0.3, 0.46, 0.24], [0.22, 0.56, 0.22], [0.27, 0.5, 0.23], [0.2, 0.6, 0.2]];
  const CARVE = ['\u{13080}', '\u{132F9}', '\u{131A3}', '\u{13143}', '\u{132B9}', '\u{131F3}', '\u{133DE}', '\u{131CB}', '\u{13216}', '\u{1329B}', '\u{130D2}']; // eye, ankh, scarab, falcon, god-flag, sun, scribe kit, reed, water, boat, bull
  // single quotes: this goes inside style="..." attributes (encodeURIComponent turns the SVG's own " into %22)
  const NOISE = `url('data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.07" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .5  0 0 0 0 .45  0 0 0 1.4 -.35"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}')`;
  function pyrStage(p, sel) {
    const n = p[3].length;
    const tiers = p[3].map((x, i) => {
      const [c1, c2, light] = STONE[i % STONE.length];
      const cut = i === 0 ? [1] : CUTS[i % CUTS.length];
      const blocks = cut.map((f, j) => {
        const shade = j % 2 ? 'rgba(255,240,210,.06)' : 'rgba(40,15,0,.05)';
        const carve = cut.length > 1 && (j === 0 || j === cut.length - 1) ? `<span class="pyr-carve" style="left:${j === 0 ? 46 : 54}%">${CARVE[(i * 3 + j) % CARVE.length]}</span>` : '';
        return `<span class="pyr-blk" style="flex:${f} 1 0;background:${NOISE} ${(i * 97 + j * 53) % 300}px ${(i * 41) % 120}px/320px 140px,linear-gradient(100deg,transparent 30%,rgba(255,245,215,.18) 48%,transparent 62%),linear-gradient(176deg,${shade},${shade}),linear-gradient(178deg,${c1},${c2})">${carve}</span>`;
      }).join('');
      const [li, ri] = iconsFor(x);
      const w = n > 1 ? 48 + (52 * i) / (n - 1) : 70;
      return `<button type="button" data-pyrtier="${i}" class="pyr-tier${i === 0 ? ' apex' : ''}${light ? ' light' : ''}${i === sel ? ' on' : ''}" style="width:${w.toFixed(1)}%" aria-pressed="${i === sel}" title="${esc(x[0])}">
        <span class="pyr-shape">${blocks}</span>${icon(li, 'l')}${icon(ri, 'r')}<span class="pyr-label"><b>${esc(x[0])}</b></span></button>`;
    }).join('');
    const glyphs = [[3, 8, 30], [9, 30, 22], [4, 52, 34], [11, 74, 24], [5, 90, 28], [90, 10, 26], [95, 32, 32], [88, 55, 22], [94, 78, 30], [89, 92, 24]]
      .map(([x, yy, s], k) => `<span class="pyr-glyph" style="left:${x}%;top:${yy}%;font-size:${s}px">${CARVE[(k * 5 + 2) % CARVE.length]}</span>`).join('');
    return `<div class="pyr-stage">${glyphs}<div class="pyr"><span class="pyr-cap" aria-hidden="true"></span>${tiers}</div></div>`;
  }

  // Pyramid dialog (in the same window as "Dynasty gods").
  function pyrOpen(age, y, ph, tier) {
    const P = SOCIAL[age] || [];
    const pi = ph != null ? ph : phaseIndex(age, y);
    const p = P[pi];
    S.pyr = { age, y, ph: pi, tier: tier == null ? 0 : tier };
    if (!p) return;
    let now = '';
    if (y != null && p[1].some(([a, b]) => y >= a && y < b)) {
      try {
        const dyn = dynAt(y).map((d) => d[5]).filter(Boolean);
        const rul = rulersAt(y).map((r) => r[0]).filter(Boolean);
        now = `<div class="pyr-now"><b>${esc(yfmt(y))}</b> on the map${rul.length ? ` · ruling: ${esc(rul.join(' / '))}` : ''}${dyn.length ? ` · patron god of the dynasty: ${esc(dyn.join(' / '))}` : ''}</div>`;
      } catch (_) { now = ''; }
    }
    const t = p[3][S.pyr.tier] || p[3][0];
    $id('sigBody').innerHTML = `<div class="dyn-head"><h2>Social pyramid</h2><button type="button" data-sigclose>✕</button></div>
      <div class="pyr-ages">${AGES.map(([k, l]) => `<button type="button" data-pyrage="${k}" class="${k === age ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
      ${P.length > 1 ? `<div class="pyr-ph">${P.map((x, i) => `<button type="button" data-pyrph="${i}" class="${i === pi ? 'on' : ''}">${esc(x[0])}</button>`).join('')}</div>` : `<p class="dyn-note"><b>${esc(p[0])}</b></p>`}
      <p class="dyn-note">${esc(p[2])}</p>${now}
      ${pyrStage(p, S.pyr.tier)}
      <div class="pyr-det"><p class="pyr-det-h">${esc(t[0])}</p><p>${esc(t[1])}</p><p><b>Dress:</b> ${esc(t[2])}</p><p><b>Work and life:</b> ${esc(t[3])}</p></div>
      <div class="ward-foot"><button type="button" class="dyn-all" data-wardfrom="${age}">Wardrobe of this age ▸</button></div>
      <p class="dyn-note">Top of the pyramid first; click a level for details. This pyramid also goes to the AI when it writes frames for a story in this age, so dress and jobs come out right.</p>`;
    if (!$id('sigDlg').open) $id('sigDlg').showModal();
  }
  window.pyrOpen = pyrOpen;
  $id('sigDlg') && $id('sigDlg').addEventListener('click', (ev) => {
    const T = ev.target;
    const a = T.closest('[data-pyrage]');
    if (a) { pyrOpen(a.dataset.pyrage, null, 0, 0); return; }
    const p = T.closest('[data-pyrph]');
    if (p && S.pyr) { pyrOpen(S.pyr.age, null, +p.dataset.pyrph, 0); return; }
    const t = T.closest('[data-pyrtier]');
    if (t && S.pyr) pyrOpen(S.pyr.age, S.pyr.y, S.pyr.ph, +t.dataset.pyrtier);
  });

  // ========================================================= 5. Wardrobe for every age
  // What people wore, hair, jewellery, make-up, footwear and fabrics per age. Includes notes from two talks the owner
  // collected (27 Nov 2026): Amandine Mérat (British Museum) on Egyptian textiles AD 600-1500, and a survey lecture on
  // Egyptian fashion (its doubtful claims are listed under "Treat with care", not as facts).
  // img = one line for image prompts; neg = what image generators must not draw for this age.
  const WARDROBE = {
    prehistoric: {
      title: 'Prehistoric & Predynastic (to c. 3150 BC)',
      note: 'Hide and leather first; woven linen spreads with farming (from c. 5000 BC in the Fayum) and is everyday wear by the Naqada period. Little clothing survives, so much of this comes from graves, figurines and rock art.',
      men: 'Hide or leather loincloths and short wrap kilts held by a belt; later linen kilts. Hunters on the Hunters Palette (late Naqada) wear an animal tail at the belt and feathers in the hair.',
      women: 'Wrap skirts of leather or linen tied at the waist, sometimes a long wrap; the upper body often bare. The Tarkhan Dress (c. 3482-3102 BC), the oldest woven garment known, is a finely pleated linen shirt with a V-neck and long sleeves.',
      kids: 'Mostly naked, with bead strings at the neck, waist or wrist.',
      hair: 'Long hair, held with carved ivory or bone combs and pins topped with animals and birds (Badarian and Naqada). Men on Naqada figurines are bearded; hunters wear feathers.',
      jewel: 'Beads of shell (some from the Red Sea), ostrich eggshell, bone, carnelian and glazed steatite (Badarian); ivory bangles; later turquoise from Sinai, imported lapis lazuli, gold and copper (Naqada II).',
      body: 'Green malachite (later also black galena) ground on slate palettes and painted around the eyes; red ochre on the skin. Tattoos: the Gebelein mummies (c. 3351-3017 BC) carry a wild bull and a Barbary sheep on a man\'s arm and S-shaped marks on a woman\'s shoulder.',
      feet: 'Barefoot almost always.',
      fabric: 'Hide, leather, plant fibre and undyed off-white linen. Colour comes from ochre, paint and beads, not dyed cloth.',
      changes: 'Green Sahara herders (before c. 4000 BC): mostly hide and leather. Badarian and Naqada villages: linen spreads. Late Naqada: an elite shows off gold, lapis and fine linen.',
      never: 'Tailored shirts and trousers, robes, cotton, silk, turbans, metal armour, Egyptian wigs and crowns, earrings, sandals as everyday wear.',
      see: 'Tarkhan Dress (UCL Petrie Museum, London); Gebelein mummies (British Museum); Badarian ivory combs and slate palettes; Hunters Palette (British Museum and Louvre).',
      img: 'people in hide and leather loincloths and wrap skirts or simple undyed linen, upper bodies often bare, long natural hair held with ivory combs, shell and ostrich-eggshell bead strings, green malachite around the eyes, barefoot',
      neg: 'tailored clothes, robes, turbans, cotton, silk, Egyptian wigs, crowns, earrings, sandals, metal armour',
    },
    'early-dynastic': {
      title: 'Early Dynastic (c. 3150-2686 BC)',
      note: 'The look of pharaonic Egypt takes shape: white linen, short kilts for men, sheath dresses for women, and the first royal regalia.',
      men: 'Short white linen wrap kilt tied with a belt; officials may add a cloak over one shoulder. The king wears a short kilt with a bull\'s tail hanging from the belt (Narmer Palette).',
      women: 'Ankle-length, close-fitting linen sheath dress with one or two shoulder straps, or a V-neck linen dress like the Tarkhan Dress.',
      kids: 'Usually naked.',
      hair: 'Short-cropped or shoulder-length hair. The king: white crown of the south, red crown of the north, and the double crown from Dynasty 1 (first shown under Den); a false beard tied on with a strap.',
      jewel: 'Bead bracelets and collars of gold, turquoise, lapis lazuli, amethyst and carnelian: four bracelets were found on an arm in King Djer\'s tomb at Abdju. Officials wear cylinder seals on a cord.',
      body: 'Eye paint of green malachite and black galena (kohl); scented oils.',
      feet: 'Mostly barefoot; on the Narmer Palette a servant carries the king\'s sandals.',
      fabric: 'White and off-white linen, finer for the elite; leather for belts and sandals.',
      changes: 'Royal regalia grows through the period: serekh name, crowns, bull\'s tail, false beard.',
      never: 'The nemes headcloth, the blue crown, pleated see-through robes, earrings, horses and chariots, wool or cotton garments, turbans, coins.',
      see: 'Narmer Palette and Djer\'s bracelets (Egyptian Museum, Cairo); 1st-dynasty ivory labels from Abdju.',
      img: 'men in short white linen wrap kilts with belts, women in ankle-length close-fitting linen sheath dresses with shoulder straps, gold and turquoise bead bracelets, eye paint, short dark hair, mostly barefoot',
      neg: 'nemes headcloth, blue crown, pleated see-through robes, earrings, horses, chariots, turbans, cotton',
    },
    'old-kingdom': {
      title: 'Old Kingdom (2686-2181 BC)',
      note: 'The classic Egyptian look: crisp white linen, short kilts, tight sheath dresses, heavy black wigs and broad bead collars. Clothes show rank: the higher the man, the longer and stiffer his kilt.',
      men: 'The shendyt: a white linen wrap kilt worn by every man from farmer to king, in many lengths and styles; for work it can be pulled up between the legs. Important men wear it starched, with a stiff projecting front panel; from Dynasties 5-6 officials wear longer, calf-length kilts. Workers often wear only a loincloth, or nothing in the fields. The king: pleated royal kilt, bull\'s tail, false beard.',
      women: 'A close-fitting, ankle-length linen sheath dress from below the breasts to the ankles, held by two broad shoulder straps. The rich wear a bead-net dress of faience beads over it (one from Giza is in Boston). Working women wear a wrap skirt and often nothing above; nudity was not shameful.',
      kids: 'Naked, the head shaved except for the side-lock of youth; girls may wear a belt or a few beads.',
      hair: 'Many elite men and women shave or crop their hair and wear wigs of human hair (padded with plant fibre, set with beeswax and resin); it was cleaner and helped against lice. Ordinary people often keep their own hair. Men: short round wigs or shoulder-length striated wigs. Women: long, heavy wigs to the shoulders or chest; Nofret\'s statue shows her own hair under the wig and a flowered headband. Men are clean-shaven. The king: the striped nemes headcloth of starched linen, crowns, a false beard tied on with a strap.',
      jewel: 'The broad bead collar (wesekh) on the shoulders, bracelets, anklets, chokers, headbands and diadems, amulets. No earrings yet.',
      body: 'Thick eye lines of black galena kohl and green malachite, ground and mixed with fat or gum into a paste, applied with sticks from little pots and tubes; scented oils; pumice and razors to remove body hair; mirrors of polished copper.',
      feet: 'Barefoot most of the time; the elite own sandals of papyrus or leather, often carried by a servant.',
      fabric: 'White and off-white linen, from coarse to very fine; colour comes from jewellery. Dyed red or yellow linen exists but is rare.',
      changes: 'Dynasty 4: simple and severe. Dynasties 5-6: longer kilts, more jewellery, fuller wigs. First Intermediate Period: the same styles in provincial versions.',
      never: 'Earrings, pleated see-through robes, the blue crown, horses and chariots, camels, cotton, turbans, coins, beards on Egyptian men (except the king\'s false beard).',
      myths: 'That every Egyptian went shaven-headed: many kept their own hair (Nofret shows hers under the wig). Wigs of horsehair: there were no horses in Egypt yet; wigs were human hair. The starched kilt front as a phallic symbol: one lecturer\'s reading, not established.',
      see: 'Rahotep and Nofret (Egyptian Museum, Cairo); the bead-net dress from Giza (Museum of Fine Arts, Boston); the tomb reliefs of Ti and Ptahhotep at Saqqara.',
      img: 'men in crisp short white linen shendyt kilts with belts, important men with stiff starched kilt fronts, women in tight ankle-length white linen sheath dresses with shoulder straps, heavy black wigs, broad bead collars, thick kohl eye lines, clean-shaven men, mostly barefoot, children shaved with a side-lock',
      neg: 'earrings, pleated see-through robes, blue crown, horses, chariots, camels, cotton, turbans, beards on ordinary men',
    },
    'middle-kingdom': {
      title: 'Middle Kingdom (2055-1650 BC)',
      note: 'Old Kingdom styles grow longer and more refined, and jewellery reaches its finest. The Hyksos period closes the age.',
      men: 'Longer kilts, often to the calf, some tied high under the chest; a second, sheer kilt over a short one; cloaks for officials. Soldiers: short kilts; Nubian archers in leather loincloths.',
      women: 'Sheath dresses as before, some patterned or covered with bead nets; long tunics.',
      kids: 'Naked with the side-lock; older children in small kilts or dresses.',
      hair: 'Women\'s "Hathor wig": heavy, parted in the middle, ending in two curls or spirals on the chest. Men: shoulder-length wigs or shaved heads, clean-shaven. Kings: nemes, crowns, false beard.',
      jewel: 'The finest goldwork of Egypt: pectorals inlaid with carnelian, turquoise and lapis (Sithathoriunet\'s pectoral of Senusret II), gold diadems (Princess Khnumet), girdles of gold cowrie shells, bracelets, anklets and amulets. Inlay, not enamel.',
      body: 'Kohl and malachite paste, perfumed oils, polished copper mirrors, cosmetic jars of stone and faience.',
      feet: 'Leather or papyrus sandals for the better-off.',
      fabric: 'White linen, very fine for the court. Foreigners stand out: the Aamu (Levantine travellers) painted at Beni Hasan wear patterned, colourful wool garments.',
      changes: 'Early Dynasty 12: grand provincial nobles. Late Dynasty 12: the careworn royal style. Hyksos period (1650-1550 BC): Levantine dress in the Delta, and earrings begin to arrive.',
      never: 'Pleated see-through New Kingdom robes, the blue crown, chariots before the Hyksos period, cotton, turbans, coins.',
      see: 'Sithathoriunet\'s jewellery (Metropolitan Museum, New York); Khnumet\'s diadem (Egyptian Museum, Cairo); Khnumhotep II\'s tomb paintings at Beni Hasan; Meketre\'s wooden models (Met and Cairo).',
      img: 'men in calf-length white linen kilts, some tied high under the chest, women in close-fitting linen sheath dresses, heavy centre-parted Hathor wigs ending in curls, gold pectorals and cowrie-shell girdles, kohl-lined eyes, leather sandals',
      neg: 'pleated see-through robes, blue crown, chariots, earrings, cotton, turbans',
    },
    'new-kingdom': {
      title: 'New Kingdom (1550-1069 BC)',
      note: 'Egypt at its most fashionable: finely pleated, see-through linen, big wigs, earrings and floral collars at banquets.',
      men: 'The shendyt is still the base: pleated kilts with a projecting front, worn under or over long, sheer pleated robes with wide sleeves, with sashes. Men sometimes wear the long pleated robe too. Soldiers: kilts with a stiff apron, leather loincloths cut in a net pattern, scale armour for charioteers. Workers: loincloths and short kilts.',
      women: 'Long, sheer, finely pleated linen robes, often a large shawl knotted under the breast (the Greeks later called such a garment a kalasiris), over a sheath dress; fringed edges. Dancers and servant girls wear very little; nudity was not shameful.',
      kids: 'Naked with the side-lock; royal children keep the side-lock as a sign of youth.',
      hair: 'Many shave or crop their hair and wear wigs; big layered wigs: the short layered "Nubian" wig (Amarna), long braided wigs, men\'s double ("duplex") wigs in the Ramesside period; wigs decorated with beads. At banquets, cones of scented wax on the head (real ones were found at Amarna). Royal: the blue crown (khepresh), linked with war and victory scenes; the striped nemes; the plain bag-like khat; queens\' vulture crown and double plumes; Nefertiti\'s flat-topped crown. Kings and Hatshepsut wear a false beard tied on with a strap: straight for the living king, curled at the tip for gods and the dead king.',
      jewel: 'Earrings and ear studs for men and women (from the 18th dynasty), the broad wesekh collar, gold "shebyu" collars of honour given by the king, gold flies of valour (Queen Ahhotep), bracelets, rings, scarabs and amulets; collars of real petals at feasts.',
      body: 'Heavy kohl and malachite paste, perfumed oils and ointments; cosmetic boxes with pots, applicators, tweezers and razors.',
      feet: 'Sandals of papyrus, palm or leather, some with upturned toes; gold sandals in royal burials.',
      fabric: 'Pleated white linen, almost transparent at its finest. Colour in woven bands and tapestry (the oldest Egyptian tapestry weaving comes from Thutmose IV\'s tomb), beadwork and collars.',
      changes: 'Early 18th dynasty: still simple. Amarna (c. 1350 BC): soft, flowing robes and Nubian wigs. Ramesside: very full pleats, big double wigs, more jewellery.',
      never: 'Camels, coins, cotton, silk, turbans, stirrups, Greek or Roman dress, beards on ordinary Egyptian men.',
      myths: 'Gold bee necklaces: the famous gold bee pendant is Minoan (Malia, Crete); Egypt has gold flies. "Enamel": Egyptian jewellery is inlay of stones and coloured glass. False beards of gold or copper: what they were made of is not known; the gold beard of Tutankhamun\'s mask belongs to the mask. Henna-dyed beards braided with gold thread: not well attested.',
      see: 'Tutankhamun\'s clothing, sandals and jewellery (Egyptian Museum / Grand Egyptian Museum); the Nebamun tomb paintings (British Museum); Rekhmire\'s tomb; the workmen\'s tombs at Deir el-Medina.',
      img: 'finely pleated semi-transparent white linen robes and kilts, sashes, big layered black wigs, gold earrings, broad bead and floral collars, scented cones on the head at banquets, kohl-lined eyes, papyrus sandals',
      neg: 'camels, coins, cotton, silk, turbans, stirrups, Greek or Roman dress',
    },
    'late-persian': {
      title: 'Late & Persian (1069-332 BC)',
      note: 'A mix: old Egyptian dress revived on purpose (Dynasties 25-26 copy Old Kingdom fashions in art), with Libyans, Kushites, Greeks and Persians in their own clothes.',
      men: 'Egyptians: linen kilts and fringed linen tunics; Herodotus (5th century BC) describes a linen tunic fringed at the legs with a white woollen cloak over it, never taken into temples or buried. Priests: linen only. Greek mercenaries: tunic, bronze helmet, round shield. Persians: trousers, belted coat and soft cap.',
      women: 'Sheath dresses and long linen tunics with shawls; Greek women in chiton and himation.',
      kids: 'Naked with the side-lock, as before.',
      hair: 'Priests shave head and body every third day (Herodotus). Kushite kings: close cap crown with two cobras; Libyan chiefs: a feather in the hair. Wigs and crowns in the old styles. Men let hair grow only in mourning (Herodotus).',
      jewel: 'Amulets everywhere (faience eyes of Horus, scarabs, gods); Kushite ram-head earrings and amulets; Saite gold.',
      body: 'Kohl and perfumed oils; priests strictly hairless.',
      feet: 'Priests wear only papyrus sandals (Herodotus); others leather sandals or bare feet.',
      fabric: 'Linen above all; wool for cloaks.',
      changes: 'Libyan and Kushite rule (1069-664 BC); the Saite revival (664-525 BC); Persian rule (525-404 and 343-332 BC).',
      never: 'Coins in everyday use before the 4th century BC, cotton, silk, turbans, Roman togas, camels as common transport (rare before the Persians).',
      see: 'Saite statues in the archaizing style; Kushite royal statues from Dukki Gel (Kerma Museum); Herodotus, Histories, book 2; the Elephantine papyri.',
      img: 'Egyptians in white linen kilts and fringed linen tunics with white woollen cloaks, shaven-headed priests in pure linen and papyrus sandals, faience amulets, Kushite cap crowns with two cobras where kings appear',
      neg: 'Roman togas, turbans, cotton, silk, coins, camels',
    },
    ptolemaic: {
      title: 'Ptolemaic / Greek (332-30 BC)',
      note: 'Two wardrobes side by side: Greek dress in Alexandria and the Greek towns, Egyptian linen in the villages and temples.',
      men: 'Greeks: knee-length chiton (tunic), himation (mantle) or a short chlamys cloak pinned at the shoulder, the petasos sun hat or the Macedonian kausia cap. Egyptians: linen kilts and tunics. Kings: a white ribbon diadem in Alexandria, full pharaonic regalia in temple images.',
      women: 'Greek women: long chiton and himation, drawn over the head outdoors. Egyptian women: linen dresses; the mantle tied in an "Isis knot" between the breasts appears late in the period.',
      kids: 'Greek children in short tunics; Egyptian children often naked.',
      hair: 'The "melon" hairstyle with a bun (Arsinoe II, Cleopatra VII on coins); Greek men clean-shaven with short curls; Egyptian priests shaved.',
      jewel: 'Hellenistic gold: snake bracelets and rings, Herakles-knot diadems, earrings with pendants of Eros or animal heads, garnets and emeralds (emeralds mined in Egypt\'s Eastern Desert).',
      body: 'Kohl continues; Egyptian perfumes (that of Mendes) are famous across the Greek world.',
      feet: 'Greek sandals and soft shoes; villagers often barefoot.',
      fabric: 'Linen and wool; dyed colours more common in Greek dress (red, saffron, blue); purple for the court.',
      changes: 'Early Ptolemies: Macedonian style. Later: more mixing; Greek-Egyptian families wear both.',
      never: 'Roman togas, Christian crosses, turbans, Islamic dress, cotton or silk as common cloth.',
      see: 'Ptolemaic coins with queens\' portraits; Hellenistic gold jewellery (British Museum, Benaki Museum); temple reliefs at Edfu and Dendera.',
      img: 'Greeks in draped chitons and himation mantles, short chlamys cloaks and petasos hats, Egyptians in white linen kilts and tunics, women with melon-style hair and a bun, Hellenistic gold snake bracelets',
      neg: 'Roman togas, turbans, Christian crosses, Islamic dress',
    },
    roman: {
      title: 'Roman (30 BC-AD 395)',
      note: 'The tunic becomes everyone\'s garment. The Fayum mummy portraits show the real faces, hairstyles and jewellery of the 1st-3rd centuries AD.',
      men: 'Linen or wool tunic, often with two vertical coloured stripes (clavi), and a draped mantle; Roman citizens may wear the toga on formal occasions. Soldiers: tunic, mail or plate armour, military belt, hobnailed sandals (caligae), cloak.',
      women: 'Long tunic with clavi stripes and a mantle drawn over the head outdoors; the knotted "Isis" mantle for her devotees.',
      kids: 'Small tunics; children\'s tunics and socks survive from graves.',
      hair: 'Women follow Rome: high curled fronts in the late 1st century, then plaits wound into a bun at the back. Men clean-shaven until Hadrian (AD 117-138), then bearded.',
      jewel: 'Gold necklaces with emeralds and pearls, pearl and gold hoop earrings, gold wreaths for the dead, rings with engraved gems.',
      body: 'Kohl and scented oils; in the mummy portraits the eyes are large and lined.',
      feet: 'Sandals and closed leather shoes; wool socks with a separate big toe, made to wear with sandals (3rd-5th century AD).',
      fabric: 'Linen and wool; purple and red stripes; a little cotton grown in the Western Desert oases (Kellis). From the 2nd century AD the dead are buried in their daily clothes wrapped in furnishing textiles, which is why so much survives; the tunic woven in one T-shaped piece, folded and sewn at the edges, is the Roman fashion of the time (Amandine Mérat, British Museum).',
      changes: '1st century: Greek and Egyptian styles still visible. 2nd-3rd centuries: Roman tunic and mantle everywhere.',
      never: 'Turbans, Islamic dress, crosses before the 4th century, silk as common cloth, pharaonic wigs on ordinary people.',
      see: 'Fayum mummy portraits (British Museum, Louvre, Egyptian Museum); child\'s socks and tunics (British Museum, Victoria and Albert Museum).',
      img: 'men and women in long tunics with two vertical coloured stripes and draped mantles, women with Roman-style curled hair or plaits in a bun, gold necklaces with emeralds and pearls, large kohl-lined eyes as in the Fayum portraits, sandals',
      neg: 'turbans, Islamic dress, pharaonic wigs on ordinary people, medieval clothes',
    },
    'coptic-byzantine': {
      title: 'Coptic & Byzantine (AD 395-641)',
      note: 'Christian Egypt dresses in tunics decorated with woven tapestry ornaments; graves preserved thousands of them.',
      men: 'Long T-shaped tunic woven in one piece, with tapestry stripes (clavi) and roundels on the shoulders and knees, belted; a mantle or hooded cloak.',
      women: 'Long tunics with richer tapestry bands at the neck, sleeves and hem; mantles and headscarves; hairnets.',
      kids: 'Small tunics with the same decoration; hooded children\'s cloaks.',
      hair: 'Women: hair parted in the middle, covered by a headscarf or net outdoors. Men: short hair; clergy and monks often bearded. Monks: a hood.',
      jewel: 'Gold or bronze earrings, bracelets and necklaces with crosses and saints; bone and glass beads for ordinary people.',
      body: 'Kohl continues.',
      feet: 'Leather shoes and boots, some red and gilded; sandals; wool socks with a separate big toe.',
      fabric: 'Linen with tapestry ornaments woven mostly in wool (purple, red, blue, yellow); classical motifs (birds, animals, dancers, vines in medallions) and later crosses and saints.',
      changes: 'Classical scenes (dancers, Dionysus) give way to crosses and saints; colours get brighter.',
      never: 'Turbans, Arabic inscriptions, Mamluk blazons, silk as common cloth, pharaonic kilts and wigs.',
      see: 'Coptic textiles (British Museum, Louvre, Victoria and Albert Museum, Coptic Museum Cairo).',
      img: 'people in long linen tunics with purple wool tapestry stripes and roundels, mantles and headscarves, monks in hooded robes with leather belts, small cross pendants, leather shoes',
      neg: 'turbans, Arabic inscriptions, pharaonic kilts and wigs, medieval European dress',
    },
    'early-islamic': {
      title: 'Early Islamic (AD 641-969)',
      note: 'The tunic stays, but new cuts and fabrics arrive with the Arabs (textile notes from Amandine Mérat, British Museum).',
      men: 'Two kinds of tunic side by side: the old one woven in one T-shaped piece (Roman fashion), and a new tunic cut from several pieces and sewn together, brought from the East after the conquest. Arab men add a waist wrap (izar), a shoulder wrap or cloak, and a turban (\'imama).',
      women: 'Long tunics and dresses, a head veil and a large wrap for going out; some face veils.',
      kids: 'Small tunics like the adults\'.',
      hair: 'Arab men: beards, hair under the turban. Women: long hair, often braided, under the veil; henna on hair, hands and feet.',
      jewel: 'Gold and silver earrings, bracelets, anklets and rings; amulets with inscriptions.',
      body: 'Kohl, henna, perfumes (musk, ambergris).',
      feet: 'Sandals, leather slippers, boots for riders.',
      fabric: 'Linen is still the main fibre. Silk becomes easier to get because the Arabs controlled the Silk Road trade, so 7th-8th century tapestry bands can be woven in silk. Tiraz (from the Persian for embroidery): bands of writing naming the caliph or quoting the Qur\'an, mostly on tunic sleeves, embroidered or tapestry-woven in state workshops (Tinnis, Damietta). Older classical motifs (birds and animals in vine medallions) carry on.',
      changes: 'AD 850: the Abbasid caliph orders Christians and Jews to wear distinguishing clothes (honey-coloured shawls, belts); enforcement varies. From the 9th-10th century tiraz bands often carry pseudo-inscriptions that look like Kufic writing but say nothing.',
      never: 'Mamluk blazons, Ottoman kaftans, the fez (tarbush), European dress, pharaonic dress.',
      see: 'Tiraz textiles (British Museum, Metropolitan Museum, Textile Museum Washington); British Museum "Curator\'s Corner": Amandine Mérat on Egyptian textiles.',
      img: 'men in long linen tunics with tiraz bands of Arabic script on the sleeves, waist wraps and cloaks, turbans, women in long tunics with head veils and outdoor wraps, henna on the hands, gold bracelets',
      neg: 'fez, tarbush, Ottoman kaftans, European clothes, pharaonic dress',
    },
    fatimid: {
      title: 'Fatimid (AD 969-1171)',
      note: 'A rich court in new Cairo: robes of honour, fine linen and silk from the Delta workshops, and famous gold jewellery.',
      men: 'Long tunics and robes; the caliph gives robes of honour with tiraz bands bearing his name. Turbans, very large for officials. The Fatimid court colour is white (the Abbasids used black).',
      women: 'Long dresses and tunics over trousers, head veils and large outdoor wraps; Cairo Geniza marriage lists record dresses, robes and jewellery in many colours.',
      kids: 'Small tunics, embroidered caps.',
      hair: 'Men: beards, turbans with a tail. Women: long hair under veils, henna.',
      jewel: 'Fatimid gold jewellery: filigree and granulation, crescent-shaped earrings and pendants; rock-crystal objects at court.',
      body: 'Kohl, henna, perfumes.',
      feet: 'Leather slippers and boots.',
      fabric: 'Very fine linen and silk woven at Tinnis and Damietta; tiraz bands in tapestry with Kufic writing, later pseudo-inscriptions.',
      changes: 'Early Fatimid: elaborate inscribed tiraz. Later: more decorative bands with animals.',
      never: 'Mamluk blazons, Ottoman kaftans, the fez, European clothes, pharaonic dress.',
      see: 'Fatimid tiraz and gold jewellery (Museum of Islamic Art Cairo, British Museum, Metropolitan Museum); Cairo Geniza documents (Cambridge University Library).',
      img: 'men in long white or light linen robes with inscribed tiraz bands on the sleeves and large turbans, women in long dresses with head veils and gold filigree crescent earrings, henna',
      neg: 'fez, tarbush, Ottoman kaftans, Mamluk blazons, European clothes',
    },
    'ayyubid-mamluk': {
      title: 'Ayyubid & Mamluk (AD 1171-1517)',
      note: 'A military elite with its own uniform and badges; cotton becomes one of the main fibres (textile notes from Amandine Mérat, British Museum).',
      men: 'Mamluks and amirs: the qaba\', a coat crossing over the chest with tight sleeves and tiraz bands on the upper sleeves, a belt or sash with metal plaques, boots, and a cap wound with a turban. Civilians: long tunics and robes; scholars: large turbans and a shawl over the head (taylasan). Tunics are now cut from several pieces and sewn; the old one-piece tunic is slowly abandoned.',
      women: 'Long tunics and trousers; outdoors a large enveloping wrap (izar) and a face veil (burqu\'); tall wooden clogs (qabqab) in the bathhouse.',
      kids: 'Sewn tunics like the adults\'.',
      hair: 'Men: beards and turbans whose size shows rank. Women: long braided hair under veils, henna.',
      jewel: 'Gold and silver jewellery, anklets. An amir\'s blazon (his badge) marks his belongings, clothes and tents: a cup for the cup-bearer, a pen box for the secretary.',
      body: 'Kohl, henna, perfumes.',
      feet: 'Boots for soldiers, leather slippers.',
      fabric: 'Cotton becomes one of the most used fibres, with linen and silk. Decoration turns geometric (tiny triangles, stripes). Blazons are woven into textiles, for example an amir\'s tent hanging in cotton.',
      changes: '1301: Christians must wear blue turbans, Jews yellow and Samaritans red. Late Mamluk (Circassian) period: more geometric patterns.',
      never: 'The fez, Ottoman fur kaftans, European clothes, pharaonic dress.',
      see: 'Mamluk textiles and blazoned objects (British Museum, Museum of Islamic Art Cairo, Victoria and Albert Museum); the "Baptistère de Saint Louis" brass basin (Louvre), which shows Mamluk dress; British Museum "Curator\'s Corner": Amandine Mérat on Egyptian textiles.',
      img: 'Mamluk soldiers in qaba coats crossing over the chest with tight sleeves and inscribed bands, sashes with metal plaques, boots, caps wound with turbans, heraldic blazons, scholars in large turbans and shawls, women in enveloping wraps with face veils, geometric-patterned cotton',
      neg: 'fez, tarbush, Ottoman fur kaftans, European clothes, pharaonic dress',
    },
    ottoman: {
      title: 'Ottoman (AD 1517-1805)',
      note: 'Layers of robes, with rank shown by headgear. The French expedition\'s Description de l\'Égypte (1809) drew Cairo dress at the very end of this age.',
      men: 'Inner robe, sash, wide trousers (shalwar) and an outer robe, or a fur-lined pelisse for the rich; officials and beys wear turbans of rank; Janissaries a tall felt cap.',
      women: 'Long shift, wide trousers, a long open robe and sash; to go out a black silk wrap (habara) and a long face veil.',
      kids: 'Small versions of adult dress; skullcaps.',
      hair: 'Men: shaved heads under turbans or caps, beards. Women: long braids, sometimes with coins and ornaments, henna.',
      jewel: 'Gold coins sewn on headdresses and necklaces, silver anklets and bracelets, amulets.',
      body: 'Kohl, henna; facial tattoos among country women.',
      feet: 'Yellow or red leather slippers, boots for soldiers, wooden clogs.',
      fabric: 'Cotton, linen, wool and silk; indigo-dyed blue cotton for peasants; striped silks and Indian cottons for the rich.',
      changes: 'Mamluk households rise again in the 1700s with their own luxurious style.',
      never: 'The fez as everyday wear (it comes in the 19th century), Western suits, pharaonic dress.',
      see: 'Description de l\'Égypte plates (1809); Ottoman costume albums; Museum of Islamic Art Cairo.',
      img: 'men in layered robes, sashes, wide trousers and large turbans, beys in fur-lined pelisses, Janissaries in tall felt caps, women in long robes with black silk outdoor wraps and long face veils, peasants in long indigo-blue cotton shirts and skullcaps',
      neg: 'fez, Western suits, pharaonic dress, modern clothes',
    },
    modern: {
      title: 'Modern Egypt (1805 onward)',
      note: 'From robes and turbans to the fez and the suit, and later the return of the headscarf. Check the decade of the scene.',
      men: '1800s: officials and effendis in the tarbush (fez) with a frock coat, later a Western suit; soldiers in uniform with the tarbush. Countrymen: the long galabiya, a skullcap or turban, a cloak in winter. After 1952 the tarbush disappears: suits or casual Western clothes in the cities, the galabiya in the countryside and Upper Egypt.',
      women: 'Upper-class women in the 1800s: Western dresses at home, outdoors a black habara and a white face veil. 1923: Huda Sha\'rawi publicly removes her face veil, and city women take up Western fashion. Countrywomen: long black dresses and a black head cloth (tarha) or wrap (milaya). From the 1970s many women wear the headscarf.',
      kids: 'School uniforms in the 20th century; galabiyas in the villages.',
      hair: '1800s: men shaved under the tarbush, with moustaches; 1920s-60s: short Western cuts. Women: braids under the tarha; bobbed hair in the 1920s-30s cities.',
      jewel: 'Gold bangles, coin necklaces, silver anklets in the countryside; wedding gold (shabka).',
      body: 'Kohl; facial and chin tattoos among older country women (fading in the 20th century); henna for weddings.',
      feet: 'Slippers, Western shoes in the cities, bare feet or sandals in the fields.',
      fabric: 'Egyptian long-staple cotton (from the 1820s) everywhere; wool for winter cloaks.',
      changes: '1800s Ottoman-European mix; 1920s-50s effendi suit and tarbush; after 1952 Western dress; from the 1970s more religious dress.',
      never: 'Pharaonic or medieval dress as everyday wear; anything from after the scene\'s decade.',
      see: 'Photographs by Lehnert & Landrock and Bonfils; Edward Lane, Manners and Customs of the Modern Egyptians (1836).',
      img: 'dress of the scene\'s decade: in the 1800s men in tarbush and frock coat or galabiya and turban, women in black habara with white face veil or black dress and tarha; until 1952 suits with the tarbush; gold bangles, kohl',
      neg: 'pharaonic dress, medieval armour',
    },
  };
  window.WARDROBE = WARDROBE;
  const WARD_SECTIONS = [['men', 'Men', 'kilt'], ['women', 'Women', 'dress'], ['kids', 'Children', 'child'], ['hair', 'Hair, wigs, beards and headwear', 'wig'], ['jewel', 'Jewellery and accessories', 'collar'], ['body', 'Make-up and body', 'mirror'], ['feet', 'Footwear', 'sandal'], ['fabric', 'Fabrics and colours', 'spindle'], ['changes', 'Changes within the age', 'hourglass'], ['never', 'Never show', 'no'], ['myths', 'Treat with care (popular claims)', 'feather'], ['see', 'Real pieces to look at', 'eye']];

  /** What the AI gets: the full wardrobe of the age (not the museum list). */
  function wardrobeContext(age) {
    const w = WARDROBE[age];
    if (!w) return '';
    return `WARDROBE OF THIS AGE (${w.title}; ${w.note}) Dress every figure from it; never use what it lists under NEVER SHOW or TREAT WITH CARE:\n` +
      WARD_SECTIONS.filter(([k]) => k !== 'see' && w[k]).map(([k, l]) => `- ${l.toUpperCase()}: ${w[k]}`).join('\n');
  }
  function wardText(age) {
    const w = WARDROBE[age];
    return w ? `${w.title}\n${w.note}\n\n` + WARD_SECTIONS.filter(([k]) => w[k]).map(([k, l]) => `${l}: ${w[k]}`).join('\n\n') + `\n\nFor image prompts: ${w.img}.\nAvoid: ${w.neg}.` : '';
  }

  // Every image prompt gets a short "period dress" line (before the last line) and the age's never-draw list.
  if (typeof window.buildImage === 'function') {
    const baseImg = window.buildImage;
    window.buildImage = function (s) {
      const r = baseImg(s);
      try {
        const w = WARDROBE[styleOf(s).age];
        if (w && r && typeof r.p === 'string') {
          const lines = r.p.split('\n');
          lines.splice(Math.max(0, lines.length - 1), 0, `Period dress (${w.title}): ${w.img}.`);
          r.p = lines.join('\n');
          if (w.neg) r.neg = (r.neg ? r.neg + ', ' : '') + w.neg;
        }
      } catch (_) { /* leave the prompt as it was */ }
      return r;
    };
  }

  const wcss = document.createElement('style');
  wcss.textContent = `
  .ward-band{position:relative;margin:10px 0 6px;padding:12px 16px;border-radius:6px;text-align:center;box-shadow:inset 0 3px 0 rgba(255,240,205,.4),inset 0 -4px 0 rgba(30,10,0,.3),0 4px 8px rgba(70,35,12,.3)}
  .ward-band b{font-family:var(--display);font-weight:400;font-size:21px;background:linear-gradient(#5e3a12,#3a2006);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgba(255,240,200,.7))}
  .ward-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:10px 0}
  .ward-card{background:linear-gradient(#fbf3dc,#f3e3bf);border:1.5px solid #b8904c;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.45;color:#2a1c10;box-shadow:inset 0 1px 0 #fff8e4,0 2px 6px rgba(80,50,20,.16)}
  .ward-card h3{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-family:var(--display);font-weight:400;font-size:16px;color:#7a2a12}
  .ward-card h3 svg{width:26px;height:26px;flex:none;filter:drop-shadow(0 1px 0 rgba(255,242,205,.6)) drop-shadow(0 -1px 0 rgba(35,12,2,.5))}
  .ward-card.never{border-color:#a3321c;background:linear-gradient(#fbe9dc,#f3d6c2)}
  .ward-card.myths{border-style:dashed}
  .ward-card.wide{grid-column:1/-1}
  .ward-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
  .ward-foot .dyn-all{cursor:pointer}
  `;
  document.head.appendChild(wcss);

  function wardOpen(age, y) {
    const w = WARDROBE[age];
    if (!w) return;
    S.ward = { age, y };
    const card = ([k, l, ic]) => (w[k] ? `<div class="ward-card ${k}${k === 'changes' || k === 'see' || k === 'myths' || k === 'never' ? ' wide' : ''}"><h3><svg aria-hidden="true"><use href="#pyri-${ic}"/></svg>${esc(l)}</h3>${esc(w[k])}</div>` : '');
    $id('sigBody').innerHTML = `<div class="dyn-head"><h2>Wardrobe</h2><button type="button" data-sigclose>✕</button></div>
      <div class="pyr-ages">${AGES.map(([k, l]) => `<button type="button" data-wardage="${k}" class="${k === age ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
      <div class="ward-band" style="background:${NOISE} 0 0/320px 140px,linear-gradient(100deg,transparent 30%,rgba(255,245,215,.2) 48%,transparent 62%),linear-gradient(178deg,#f1d79a,#b9873e);background-blend-mode:soft-light,normal,normal"><b>${esc(w.title)}</b></div>
      <p class="dyn-note">${esc(w.note)}</p>
      <div class="ward-grid">${WARD_SECTIONS.map(card).join('')}</div>
      <div class="ward-foot"><button type="button" class="dyn-all" data-wardcopy>Copy this wardrobe as text</button><button type="button" class="dyn-all" data-pyrfrom="${age}">Social pyramid of this age ▸</button><span class="hint" id="wardMsg"></span></div>
      <p class="dyn-note">This wardrobe also goes to the AI whenever it writes frames for a story in this age, and every image prompt gets a short "Period dress" line plus the things never to draw.</p>`;
    if (!$id('sigDlg').open) $id('sigDlg').showModal();
    $id('sigBody').scrollTop = 0;
  }
  window.wardOpen = wardOpen;
  $id('sigDlg') && $id('sigDlg').addEventListener('click', async (ev) => {
    const T = ev.target;
    const a = T.closest('[data-wardage]');
    if (a) { wardOpen(a.dataset.wardage, null); return; }
    const f = T.closest('[data-wardfrom]');
    if (f) { wardOpen(f.dataset.wardfrom, S.pyr && S.pyr.y); return; }
    const p = T.closest('[data-pyrfrom]');
    if (p) { pyrOpen(p.dataset.pyrfrom, S.ward && S.ward.y); return; }
    if (T.closest('[data-wardcopy]') && S.ward) {
      const text = wardText(S.ward.age);
      try { await navigator.clipboard.writeText(text); say('wardMsg', '✓ Copied'); return; } catch (_) { /* older way below */ }
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      $id('sigBody').appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      say('wardMsg', ok ? '✓ Copied' : "Couldn't copy here; select the text instead.");
    }
  });

  // ==================================== 6. Scene references from ComfyUI (local only)
  // "Generate a reference with ComfyUI" inside a scene's Visual references. The local server talks to ComfyUI
  // (local/comfy.mjs); finished images become Desk files and are added to the scene like uploaded references.
  S.comfyDraft = S.comfyDraft || {};
  const ccss = document.createElement('style');
  ccss.textContent = `
  .comfy{border:1px dashed #4a4636;border-radius:8px;padding:8px 10px}
  .comfy summary{cursor:pointer}
  .comfy .stack{margin-top:8px}
  .comfy-out{display:flex;flex-wrap:wrap;gap:6px}
  .comfy-out img{height:64px;border-radius:4px;border:1px solid var(--line)}
  `;
  document.head.appendChild(ccss);

  /** A short prompt for an image model, built from the scene (the full Desk image prompt is too long for SD-type models). */
  function comfyPrompt(s) {
    const st = styleOf(s), g = guide(), w = WARDROBE[st.age];
    const clean = (t) => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    return [
      g.photo ? 'award-winning documentary photograph, real camera, natural light' : st.medium,
      `${s.shot || 'wide'} shot`, clean(s.story), clean(s.figures), clean(s.location),
      TIMES[s.time] || '', clean(s.weather),
      s.fg ? 'foreground: ' + clean(s.fg) : '', s.bg ? 'background: ' + clean(s.bg) : '',
      w ? w.img : '', st.light || '', 'cinematic, highly detailed',
    ].filter(Boolean).join(', ');
  }
  function comfyNegative(s) {
    try { return buildImage(s).neg; } catch (_) { return 'text, watermark, modern objects, cartoon, deformed hands'; }
  }
  function comfyBlock(s) {
    const d = S.comfyDraft[s.id] || {};
    const st = S.comfySt;
    const ck = (st && st.checkpoints) || [];
    const stLine = !st ? 'checking…' : st.up ? `on this PC · ${esc(st.gpu || 'ComfyUI ' + st.version)}` : 'ComfyUI is not running';
    return `<details class="comfy" id="comfyBox" ${S.comfyOpen ? 'open' : ''}>
      <summary><b>Generate a reference with ComfyUI</b> <span class="hint" id="cfState">${stLine}</span></summary>
      <div class="stack">
        <label>Prompt (made from this scene; edit it freely)<textarea id="cfPrompt" rows="4">${esc(d.p != null ? d.p : comfyPrompt(s))}</textarea></label>
        <details><summary class="hint">Negative prompt (what to keep out, from this age's never-show list)</summary><textarea id="cfNeg" rows="3">${esc(d.n != null ? d.n : comfyNegative(s))}</textarea></details>
        <div class="three">
          <label>Model${st && st.customWorkflow ? '<input value="Your saved workflow" disabled>' : `<select id="cfCkpt">${ck.length ? ck.map((c) => `<option value="${esc(c)}" ${c === d.ckpt ? 'selected' : ''}>${esc(c.replace(/\.(safetensors|ckpt)$/i, ''))}</option>`).join('') : '<option value="">(no image model found)</option>'}</select>`}</label>
          <label>Size<select id="cfSize">${[['768x432', '16:9 · 768×432'], ['912x512', '16:9 · 912×512'], ['1024x576', '16:9 · 1024×576 (SDXL)'], ['512x512', 'Square · 512'], ['432x768', '9:16 · 432×768']].map(([v, l]) => `<option value="${v}" ${v === (d.size || '768x432') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>How many<select id="cfCount">${[1, 2, 4].map((n) => `<option ${n === (d.count || 1) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <div class="row-g"><button class="btn ochre sm" type="button" data-comfygo ${st && !st.up ? 'disabled' : ''}>Generate</button><button class="btn ghost sm" type="button" data-comfyreset>Rebuild the prompt from the scene</button><span class="hint" id="cfMsg">${S.comfyBusy ? spin + 'ComfyUI is working…' : ''}</span></div>
        <p class="hint">Finished images are added to this scene's references above (★ makes one the thumbnail, × removes it). SD 1.5 gives rough sketches; for better pictures add an SDXL or Flux model to ComfyUI, or export your own workflow (Workflow → Export (API)) to Documents\\Land of Rebirth Data\\desk\\comfy-workflow.json with "{{prompt}}" and "{{negative}}" where the texts go.</p>
      </div>
    </details>`;
  }
  async function comfyRefresh() {
    try { S.comfySt = await (await fetch('/local/desk/comfy/status', { cache: 'no-store' })).json(); } catch (_) { S.comfySt = { up: false }; }
    const el = $id('cfState');
    if (el && S.comfySt) {
      el.textContent = S.comfySt.up ? `on this PC · ${S.comfySt.gpu || 'ComfyUI ' + S.comfySt.version}` : 'ComfyUI is not running';
      const sel = $id('cfCkpt');
      if (sel && S.comfySt.up) {
        const cur = sel.value;
        sel.innerHTML = (S.comfySt.checkpoints || []).map((c) => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(c.replace(/\.(safetensors|ckpt)$/i, ''))}</option>`).join('') || '<option value="">(no image model found)</option>';
      }
      const go = document.querySelector('[data-comfygo]');
      if (go) go.disabled = !S.comfySt.up || S.comfyBusy;
    }
  }
  function comfyKeep(s) {
    const g = (id) => ($id(id) ? $id(id).value : undefined);
    S.comfyDraft[s.id] = { p: g('cfPrompt'), n: g('cfNeg'), ckpt: g('cfCkpt'), size: g('cfSize'), count: +g('cfCount') || 1 };
  }
  async function comfyGo() {
    const s = sc();
    if (!s || S.comfyBusy) return;
    comfyKeep(s);
    const d = S.comfyDraft[s.id];
    if (!String(d.p || '').trim()) { say('cfMsg', 'Write a prompt first.'); return; }
    const [w, h] = String(d.size || '768x432').split('x').map(Number);
    const epId = S.epId;
    S.comfyBusy = true;
    const go = document.querySelector('[data-comfygo]'); if (go) go.disabled = true;
    say('cfMsg', spin + 'Sending to ComfyUI…');
    const t0 = Date.now();
    try {
      const r = await (await fetch('/local/desk/comfy/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: d.p, negative: d.n, width: w, height: h, count: d.count, ckpt: d.ckpt }) })).json();
      if (r.error) throw new Error(r.error);
      let j = null;
      while (Date.now() - t0 < 15 * 60 * 1000) {
        await new Promise((ok) => setTimeout(ok, 1500));
        j = await (await fetch('/local/desk/comfy/job/' + encodeURIComponent(r.promptId), { cache: 'no-store' })).json();
        if (j.error) throw new Error(j.error);
        if (j.state === 'error') throw new Error(j.message);
        if (j.state === 'done') break;
        const secs = Math.round((Date.now() - t0) / 1000);
        say('cfMsg', spin + (j.state === 'queued' ? `Waiting in ComfyUI's queue (${j.ahead} ahead)… ${secs}s` : `ComfyUI is painting… ${secs}s`));
      }
      if (!j || j.state !== 'done') throw new Error('ComfyUI took too long. The image may still appear in ComfyUI\'s output folder.');
      const label = (k) => `ComfyUI · seed ${r.seed}${j.images.length > 1 ? ' #' + (k + 1) : ''}`.slice(0, 40);
      s.refs = [...(s.refs || []), ...j.images.map((im, k) => ({ kind: 'up', image: { id: im.id, url: im.url }, title: label(k), comfy: { seed: r.seed, n: k, prompt: String(d.p).slice(0, 600), size: `${r.width}x${r.height}`, workflow: r.workflow, ckpt: d.ckpt || '' } }))];
      try { if (typeof dirtyIds !== 'undefined') dirtyIds.add(epId); } catch (_) { /* fine */ }
      markDirty();
      const still = sc() === s;
      S.comfyBusy = false;
      if (still) { S.comfyOpen = true; renderScene(); }
      say('cfMsg', `✓ ${j.images.length} image${j.images.length > 1 ? 's' : ''} added to the references (${Math.round((Date.now() - t0) / 1000)}s).`);
    } catch (err) {
      say('cfMsg', "Couldn't generate: " + esc(err && err.message || err));
    } finally {
      S.comfyBusy = false;
      const g2 = document.querySelector('[data-comfygo]'); if (g2) g2.disabled = !(S.comfySt && S.comfySt.up);
    }
  }
  if (LOCAL && typeof window.refsPanel === 'function') {
    const baseRefs = window.refsPanel;
    window.refsPanel = function (s) {
      const html = baseRefs(s);
      const i = html.lastIndexOf('</div>');
      return i < 0 ? html : html.slice(0, i) + comfyBlock(s) + html.slice(i);
    };
    document.addEventListener('toggle', (ev) => {
      if (ev.target && ev.target.id === 'comfyBox') { S.comfyOpen = ev.target.open; if (ev.target.open) comfyRefresh(); }
    }, true);
    document.addEventListener('input', (ev) => { if (ev.target && /^cf(Prompt|Neg)$/.test(ev.target.id)) { const s = sc(); if (s) comfyKeep(s); } });
    document.addEventListener('change', (ev) => { if (ev.target && /^cf(Ckpt|Size|Count)$/.test(ev.target.id)) { const s = sc(); if (s) comfyKeep(s); } });
    document.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-comfygo]')) { comfyGo(); return; }
      if (ev.target.closest('[data-comfyreset]')) {
        const s = sc(); if (!s) return;
        delete S.comfyDraft[s.id];
        if ($id('cfPrompt')) $id('cfPrompt').value = comfyPrompt(s);
        if ($id('cfNeg')) $id('cfNeg').value = comfyNegative(s);
      }
    });
    comfyRefresh();
  }

  aiChip();
})();
