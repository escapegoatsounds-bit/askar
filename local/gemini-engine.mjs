/**
 * Google Gemini for the local Desk (the alternative to Claude Code), through the Gemini API with the
 * owner's own API key. The key is kept in <data>\desk\ai-engine.json on this PC only (see desk.mjs) and is
 * never sent back to the page.
 *
 * API: POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 */
const API = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 12 * 60 * 1000;
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';

class EngineError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function explain(status, body) {
  const msg = body?.error?.message || `Gemini answered ${status}`;
  const st = body?.error?.status || '';
  if (status === 429 || st === 'RESOURCE_EXHAUSTED') return new EngineError('Gemini usage limit reached for this key. Wait a while, or check your plan in Google AI Studio.', 'rate_limited');
  if (/api key not valid|API_KEY_INVALID/i.test(msg) || status === 401 || status === 403) return new EngineError('Gemini refused the API key. Check it in the Desk under "AI: …" (top bar).', 'bad_key');
  if (status === 404 || /not found|is not supported/i.test(msg)) return new EngineError(`Gemini doesn't know the model you chose. Pick one from the list under "AI: …". (${msg.slice(0, 160)})`, 'bad_model');
  if (status === 503 || st === 'UNAVAILABLE') return new EngineError('Gemini is overloaded right now. Try again in a minute.', 'rate_limited');
  return new EngineError('Gemini: ' + msg.slice(0, 400), 'engine_error');
}

async function call(url, key, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(init.headers || {}) } });
    let body = null;
    try {
      body = await r.json();
    } catch {
      /* empty */
    }
    if (!r.ok) throw explain(r.status, body);
    return body;
  } catch (e) {
    if (e.name === 'AbortError') throw new EngineError('Gemini took too long (over 12 minutes) and was stopped. Try a smaller job.', 'timeout');
    if (e instanceof EngineError) throw e;
    throw new EngineError("Couldn't reach Gemini (check the internet connection): " + (e.message || e), 'engine_error');
  } finally {
    clearTimeout(t);
  }
}

/** Ask Gemini. `json` asks for a JSON reply (Gemini's JSON mode). Resolves to the reply text. */
export async function askGemini(prompt, { key, model, system, json } = {}) {
  if (!key) throw new EngineError('No Gemini API key saved yet. Add yours in the Desk under "AI: …" (top bar).', 'no_key');
  const m = String(model || DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
  if (!/^[a-z0-9][a-z0-9.-]{1,60}$/i.test(m)) throw new EngineError('That Gemini model name looks wrong.', 'bad_model');
  const body = {
    contents: [{ role: 'user', parts: [{ text: String(prompt) }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  };
  const res = await call(`${API}/models/${encodeURIComponent(m)}:generateContent`, key, { method: 'POST', body: JSON.stringify(body) });
  if (res?.promptFeedback?.blockReason) throw new EngineError(`Gemini blocked this request (${res.promptFeedback.blockReason}).`, 'blocked');
  const cand = res?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  if (!text) throw new EngineError(`Gemini returned nothing${cand?.finishReason ? ` (${cand.finishReason})` : ''}. Try again.`, 'engine_error');
  if (cand?.finishReason === 'MAX_TOKENS') throw new EngineError('Gemini ran out of room before finishing. Try a smaller job (fewer frames at once).', 'engine_error');
  return text;
}

/** Models this key can use for text generation (checks the key at the same time). */
export async function listGeminiModels(key) {
  if (!key) throw new EngineError('No Gemini API key saved yet.', 'no_key');
  const out = [];
  let page = '';
  for (let i = 0; i < 5; i++) {
    const res = await call(`${API}/models?pageSize=200${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, key);
    for (const m of res?.models || []) {
      if ((m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name)) out.push({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name });
    }
    page = res?.nextPageToken;
    if (!page) break;
  }
  return out;
}
