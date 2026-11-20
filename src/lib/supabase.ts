import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = !!url && !!key && !url.includes('YOUR-PROJECT');

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const BUCKET = 'media';

/** fetch() to our own /api with the user's session attached. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
  return body as T;
}
