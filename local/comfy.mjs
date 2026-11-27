/**
 * ComfyUI on this PC, for the Desk's "Generate a reference with ComfyUI" (scene → Visual references).
 *
 * ComfyUI must be running (default http://127.0.0.1:8188; override with LOR_COMFY). We send a text-to-image
 * workflow to its /prompt API, follow the job through /queue and /history, and hand the finished images back.
 *
 * Workflow: the built-in one below (checkpoint → text encoders → empty latent → KSampler → VAE decode → save),
 * which suits SD 1.5 / SDXL-style checkpoints. To use your own (e.g. Flux, or with LoRAs), export it from ComfyUI
 * with "Export (API)" and save it as <data>\desk\comfy-workflow.json, putting these placeholders where the
 * values go: "{{prompt}}", "{{negative}}", "{{seed}}", "{{width}}", "{{height}}", "{{steps}}", "{{cfg}}", "{{count}}".
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.mjs';

export const COMFY = (process.env.LOR_COMFY || 'http://127.0.0.1:8188').replace(/\/+$/, '');
export const CUSTOM_WORKFLOW = path.join(DATA_DIR, 'desk', 'comfy-workflow.json');
const VIDEO_MODEL = /ltx|wan2?[._-]|hunyuan|svd|mochi|cosmos|cogvideo|animatediff/i;

class ComfyError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function comfy(pathname, init = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(COMFY + pathname, { ...init, signal: ctrl.signal });
    return r;
  } catch (e) {
    throw new ComfyError(`ComfyUI isn't answering at ${COMFY}. Start ComfyUI, then try again.`, 'comfy_down');
  } finally {
    clearTimeout(t);
  }
}

/** Is ComfyUI up, which GPU, which still-image checkpoints, and is a custom workflow saved? */
export async function comfyStatus() {
  let stats;
  try {
    stats = await (await comfy('/system_stats', {}, 4000)).json();
  } catch (e) {
    return { up: false, url: COMFY, error: e.message };
  }
  let ckpts = [];
  try {
    ckpts = await (await comfy('/models/checkpoints')).json();
  } catch {
    /* older ComfyUI: no /models route */
  }
  const dev = stats?.devices?.[0];
  return {
    up: true,
    url: COMFY,
    version: stats?.system?.comfyui_version || '',
    gpu: dev ? `${String(dev.name || '').replace(/^cuda:\d+\s*/, '').replace(/\s*:.*$/, '')} · ${Math.round((dev.vram_total || 0) / 2 ** 30)} GB` : '',
    checkpoints: (Array.isArray(ckpts) ? ckpts : []).filter((n) => !/^\.cache[\\/]/.test(n) && !VIDEO_MODEL.test(n)),
    customWorkflow: fs.existsSync(CUSTOM_WORKFLOW),
  };
}

const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const to8 = (v) => Math.round(v / 8) * 8;

function builtInWorkflow({ prompt, negative, seed, width, height, steps, cfg, count, ckpt }) {
  return {
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['4', 1] } },
    5: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: count } },
    3: { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: 'LandOfRebirth/ref', images: ['8', 0] } },
  };
}

/** Fill "{{name}}" placeholders in the owner's exported workflow; whole-value placeholders keep their type. */
function fillCustom(wf, vals) {
  const walk = (v) => {
    if (typeof v === 'string') {
      const whole = v.match(/^\{\{(\w+)\}\}$/);
      if (whole && whole[1] in vals) return vals[whole[1]];
      return v.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vals ? String(vals[k]) : m));
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(wf);
}

/** Queue a text-to-image job. Returns { promptId, seed, workflow: "built-in"|"custom" }. */
export async function comfyGenerate(opts) {
  const prompt = String(opts.prompt || '').trim();
  if (!prompt) throw new ComfyError('Write a prompt first.', 'bad_input');
  const vals = {
    prompt,
    negative: String(opts.negative || '').trim(),
    seed: Number.isFinite(+opts.seed) && opts.seed !== '' && opts.seed != null ? Math.abs(Math.round(+opts.seed)) % 2 ** 48 : Math.floor(Math.random() * 2 ** 48),
    width: to8(clampInt(opts.width, 256, 1536, 768)),
    height: to8(clampInt(opts.height, 256, 1536, 432)),
    steps: clampInt(opts.steps, 1, 60, 25),
    cfg: Math.min(15, Math.max(1, Number(opts.cfg) || 7)),
    count: clampInt(opts.count, 1, 4, 1),
  };
  let wf;
  let kind = 'built-in';
  if (fs.existsSync(CUSTOM_WORKFLOW) && opts.useCustom !== false) {
    try {
      wf = fillCustom(JSON.parse(fs.readFileSync(CUSTOM_WORKFLOW, 'utf8')), vals);
      kind = 'custom';
    } catch (e) {
      throw new ComfyError(`Your saved workflow (${CUSTOM_WORKFLOW}) isn't readable JSON: ${e.message}`, 'bad_workflow');
    }
  } else {
    const st = await comfyStatus();
    if (!st.up) throw new ComfyError(st.error, 'comfy_down');
    const ckpt = st.checkpoints.includes(opts.ckpt) ? opts.ckpt : st.checkpoints[0];
    if (!ckpt) throw new ComfyError('ComfyUI has no still-image checkpoint in models/checkpoints. Add one (e.g. an SDXL model), then try again.', 'no_model');
    wf = builtInWorkflow({ ...vals, ckpt });
  }
  const r = await comfy('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf, client_id: 'land-of-rebirth-desk' }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.prompt_id) {
    const ne = body.node_errors && Object.values(body.node_errors)[0];
    const detail = ne?.errors?.[0] ? `${ne.class_type}: ${ne.errors[0].message} ${ne.errors[0].details || ''}` : body.error?.message || `HTTP ${r.status}`;
    throw new ComfyError('ComfyUI refused the job: ' + String(detail).slice(0, 300), 'comfy_refused');
  }
  return { promptId: body.prompt_id, seed: vals.seed, workflow: kind, width: vals.width, height: vals.height };
}

/**
 * Where is the job? { state: "queued", ahead } | { state: "running" } | { state: "done", files: [{ name, bytes }] } | { state: "error", message }
 */
export async function comfyJob(promptId) {
  if (!/^[\w-]{8,80}$/.test(promptId)) throw new ComfyError('Bad job id', 'bad_input');
  const hist = await (await comfy('/history/' + encodeURIComponent(promptId))).json().catch(() => ({}));
  const h = hist && hist[promptId];
  if (h) {
    if (h.status && h.status.status_str === 'error') {
      const m = (h.status.messages || []).find((x) => x[0] === 'execution_error');
      return { state: 'error', message: m ? `${m[1].node_type || ''}: ${m[1].exception_message || 'failed'}`.trim() : 'ComfyUI reported an error.' };
    }
    const imgs = Object.values(h.outputs || {}).flatMap((o) => o.images || []).filter((i) => i.type !== 'temp');
    if (!imgs.length) return { state: 'error', message: 'The workflow finished without saving an image (does it end in a "Save Image" node?).' };
    const files = [];
    for (const im of imgs) {
      const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
      const r = await comfy('/view?' + q.toString(), {}, 60000);
      if (!r.ok) continue;
      files.push({ name: im.filename, bytes: Buffer.from(await r.arrayBuffer()) });
    }
    return { state: 'done', files };
  }
  const queue = await (await comfy('/queue')).json().catch(() => ({}));
  if ((queue.queue_running || []).some((x) => x[1] === promptId)) return { state: 'running' };
  const pending = (queue.queue_pending || []).map((x) => x[1]);
  const i = pending.indexOf(promptId);
  if (i >= 0) return { state: 'queued', ahead: i + (queue.queue_running || []).length };
  return { state: 'running' }; // between queue and history for a moment
}
