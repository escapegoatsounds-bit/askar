import { apiFetch } from './supabase';

/** Shrink an image blob to a small WebP thumbnail (keeps aspect ratio). */
export async function makeThumb(blob: Blob, maxSide = 640): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.82));
  if (out) return out;
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('thumbnail failed'))), 'image/jpeg', 0.85));
}

/** Download a remote image through our members-only proxy (avoids browser CORS blocks). */
export async function fetchRemoteImage(url: string): Promise<Blob> {
  const r = await apiFetch(`/api/fetch-image?url=${encodeURIComponent(url)}`);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error || `Could not fetch image (${r.status})`);
  }
  return r.blob();
}

export function extFor(type: string): string {
  if (type.includes('webp')) return 'webp';
  if (type.includes('png')) return 'png';
  if (type.includes('gif')) return 'gif';
  if (type.includes('tif')) return 'tif';
  if (type.includes('heic') || type.includes('heif')) return 'heic';
  return 'jpg';
}
