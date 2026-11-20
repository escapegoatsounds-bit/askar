import { useEffect, useState } from 'react';
import { supabase, BUCKET } from './supabase';
import type { Item } from './types';

// Private storage needs signed URLs. We batch requests and cache results.
const cache = new Map<string, { url: string; exp: number }>();
let queue: { path: string; resolve: (u: string | null) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const TTL = 60 * 60; // seconds

async function flush() {
  const batch = queue;
  queue = [];
  timer = null;
  const paths = [...new Set(batch.map((b) => b.path))];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, TTL);
  const map = new Map<string, string>();
  for (const d of data || []) if (d.signedUrl && d.path) map.set(d.path, d.signedUrl);
  const exp = Date.now() + (TTL - 120) * 1000;
  for (const [p, u] of map) cache.set(p, { url: u, exp });
  for (const b of batch) b.resolve(map.get(b.path) ?? null);
}

export function signedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    queue.push({ path, resolve });
    if (!timer) timer = setTimeout(flush, 15);
  });
}

function syncHit(path: string | null): string | null {
  if (!path) return null;
  const hit = cache.get(path);
  return hit && hit.exp > Date.now() ? hit.url : null;
}

/** Returns a displayable URL: our stored thumbnail first, then remote fallbacks. */
export function useThumb(item: Pick<Item, 'thumb_path' | 'thumb_url' | 'media_url'> | null): string | null {
  const path = item?.thumb_path ?? null;
  const fallback = item?.thumb_url || item?.media_url || null;
  const [url, setUrl] = useState<string | null>(syncHit(path) ?? (path ? null : fallback));
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(fallback);
      return;
    }
    signedUrl(path).then((u) => alive && setUrl(u ?? fallback));
    return () => {
      alive = false;
    };
  }, [path, fallback]);
  return url;
}

/** Full-size view: own upload, else the remote original. */
export function useFull(item: Pick<Item, 'storage_path' | 'media_url' | 'thumb_path' | 'thumb_url'> | null): string | null {
  const path = item?.storage_path ?? null;
  const remote = item?.media_url || null;
  const thumb = useThumb(item ? { thumb_path: item.thumb_path, thumb_url: item.thumb_url, media_url: null } : null);
  const [url, setUrl] = useState<string | null>(path ? syncHit(path) : remote);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(remote);
      return;
    }
    signedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path, remote]);
  return url || thumb;
}
