import { signedUrl } from './media';
import { fetchRemoteImage, extFor } from './thumbs';
import type { Item } from './types';

function safeName(s: string): string {
  return (s || 'image').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'image';
}

/** Get the best full-size file for an item as a Blob (own upload > original > thumbnail). */
export async function itemBlob(item: Item): Promise<Blob> {
  if (item.storage_path) {
    const u = await signedUrl(item.storage_path);
    if (u) {
      const r = await fetch(u);
      if (r.ok) return r.blob();
    }
  }
  const remote = item.media_url || item.thumb_url;
  if (remote && item.kind === 'image') {
    try {
      return await fetchRemoteImage(remote);
    } catch {
      /* fall back to our stored thumbnail */
    }
  }
  if (item.thumb_path) {
    const u = await signedUrl(item.thumb_path);
    if (u) {
      const r = await fetch(u);
      if (r.ok) return r.blob();
    }
  }
  throw new Error('This item has no downloadable image (videos and 3D models open on their source site).');
}

export function canDownload(item: Item): boolean {
  return item.kind === 'image' || item.kind === 'document' ? !!(item.storage_path || item.media_url || item.thumb_url || item.thumb_path) : false;
}

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Save one item's image to the device (Downloads folder / gallery). */
export async function downloadItem(item: Item): Promise<void> {
  const blob = await itemBlob(item);
  trigger(blob, `${safeName(item.title)}.${extFor(blob.type)}`);
}

/** Phone share sheet with the actual file (lets you "Save image", send to WhatsApp, etc.). */
export function canShareFiles(): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [new File([new Blob()], 'x.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}

export async function shareItem(item: Item): Promise<void> {
  const blob = await itemBlob(item);
  const file = new File([blob], `${safeName(item.title)}.${extFor(blob.type)}`, { type: blob.type || 'image/jpeg' });
  await navigator.share({ files: [file], title: item.title });
}

/** Download a whole board as a .zip, with a credits.txt listing sources and licenses. */
export async function downloadZip(items: Item[], name: string, onProgress?: (done: number, total: number) => void): Promise<{ failed: number }> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  const credits: string[] = [`${name}\nExported from Askar on ${new Date().toISOString().slice(0, 10)}\n`];
  let failed = 0;
  const list = items.filter(canDownload);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    onProgress?.(i, list.length);
    try {
      const blob = await itemBlob(it);
      let base = `${String(i + 1).padStart(3, '0')} ${safeName(it.title)}`;
      while (used.has(base)) base += '_';
      used.add(base);
      const file = `${base}.${extFor(blob.type)}`;
      zip.file(file, blob);
      credits.push(`${file}\n  Source: ${it.source_name ?? '—'} ${it.source_url ?? ''}\n  License: ${it.license ?? 'Unknown'}${it.credit ? `\n  Credit: ${it.credit}` : ''}\n`);
    } catch {
      failed++;
    }
  }
  zip.file('credits.txt', credits.join('\n'));
  onProgress?.(list.length, list.length);
  const out = await zip.generateAsync({ type: 'blob' });
  trigger(out, `${safeName(name)}.zip`);
  return { failed };
}
