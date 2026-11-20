/**
 * Basic protection so the image/page fetcher can't be pointed at private
 * network addresses. (Not bulletproof against DNS tricks, but members-only
 * access is the main guard.)
 */
export function safeUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '0.0.0.0' ||
    h.startsWith('[') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)
  ) {
    return null;
  }
  return u;
}

export const UA = 'AskarArchive/0.1 (personal research archive; image collection)';

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}
