/**
 * Local-first stand-in for the Supabase client.
 *
 * Askar used to talk to Supabase (database + private storage + sign-in).
 * It now talks to the local store in local/store.mjs, which keeps JSON
 * tables and a normal media folder on this PC. This file keeps the same
 * `supabase.from(...).select(...).eq(...)` shape the pages already use, so
 * they did not need rewriting. Only the features Askar uses are implemented.
 */

export const configured = true;
export const BUCKET = 'media';

type Filter = { col: string; op: string; val?: unknown; inner?: string };
type Result<T = any> = { data: T; error: { message: string; code?: string } | null; count?: number | null; status?: number };

// ---------------------------------------------------------------- change events
// Replaces Supabase realtime: pages that `subscribe()` hear about local writes.
const bus = new EventTarget();
function announce(table: string) {
  bus.dispatchEvent(new CustomEvent('change', { detail: table }));
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Local server answered ${r.status}`);
  return r.json();
}

class Query<T = any> implements PromiseLike<Result<T>> {
  private q: any;
  private mode: 'many' | 'single' | 'maybe' = 'many';

  constructor(table: string) {
    this.q = { table, action: 'select', select: '*', filters: [] as Filter[], order: [] as any[] };
  }

  // ----- actions
  select(cols = '*', opts: { count?: string; head?: boolean } = {}) {
    if (this.q.action !== 'select') this.q.returning = true;
    this.q.select = cols;
    if (opts.head) this.q.head = true;
    if (opts.count) this.q.count = opts.count;
    return this;
  }
  insert(values: unknown) {
    this.q.action = 'insert';
    this.q.values = values;
    return this;
  }
  upsert(values: unknown, opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.q.action = 'upsert';
    this.q.values = values;
    this.q.onConflict = opts.onConflict;
    this.q.ignoreDuplicates = !!opts.ignoreDuplicates;
    return this;
  }
  update(values: unknown) {
    this.q.action = 'update';
    this.q.values = values;
    return this;
  }
  delete() {
    this.q.action = 'delete';
    return this;
  }

  // ----- filters
  private f(col: string, op: string, val?: unknown) {
    this.q.filters.push({ col, op, val });
    return this;
  }
  eq(c: string, v: unknown) { return this.f(c, 'eq', v); }
  neq(c: string, v: unknown) { return this.f(c, 'neq', v); }
  gt(c: string, v: unknown) { return this.f(c, 'gt', v); }
  gte(c: string, v: unknown) { return this.f(c, 'gte', v); }
  lt(c: string, v: unknown) { return this.f(c, 'lt', v); }
  lte(c: string, v: unknown) { return this.f(c, 'lte', v); }
  is(c: string, v: unknown) { return this.f(c, 'is', v); }
  in(c: string, v: unknown[]) { return this.f(c, 'in', v); }
  like(c: string, v: string) { return this.f(c, 'like', v); }
  ilike(c: string, v: string) { return this.f(c, 'ilike', v); }
  contains(c: string, v: unknown[]) { return this.f(c, 'contains', v); }
  overlaps(c: string, v: unknown[]) { return this.f(c, 'overlaps', v); }
  not(c: string, op: string, v: unknown) {
    this.q.filters.push({ col: c, op: 'not', inner: op, val: v });
    return this;
  }
  /** PostgREST-style "a.ilike.%x%,b.eq.1"; parsed by the local store. */
  or(expr: string) {
    this.q.filters.push({ col: '', op: 'or_raw', val: expr });
    return this;
  }

  // ----- modifiers
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.q.order.push({ col, ascending: opts.ascending !== false, nullsFirst: opts.nullsFirst });
    return this;
  }
  limit(n: number) {
    this.q.limit = n;
    return this;
  }
  range(from: number, to: number) {
    this.q.offset = from;
    this.q.limit = to - from + 1;
    return this;
  }
  single() {
    this.mode = 'single';
    return this as unknown as Query<any>;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this as unknown as Query<any>;
  }

  async exec(): Promise<Result<T>> {
    try {
      const r = await post<{ data: any; count: number | null; error: Result['error'] }>('/local/db', this.q);
      if (r.error) return { data: null as any, error: r.error, count: null };
      if (this.q.action !== 'select') announce(this.q.table);
      let data = r.data;
      if (this.mode !== 'many') {
        const arr = Array.isArray(data) ? data : data == null ? [] : [data];
        if (arr.length > 1) return { data: null as any, error: { message: 'More than one row returned', code: 'PGRST116' } };
        if (!arr.length) {
          if (this.mode === 'single') return { data: null as any, error: { message: 'No rows found', code: 'PGRST116' } };
          data = null;
        } else data = arr[0];
      }
      return { data, error: null, count: r.count, status: 200 };
    } catch (e) {
      return { data: null as any, error: { message: (e as Error).message } };
    }
  }

  then<A = Result<T>, B = never>(ok?: ((v: Result<T>) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.exec().then(ok, bad);
  }
}

// ---------------------------------------------------------------- storage
const fileUrl = (path: string) => `/local/files/${path.split('/').map(encodeURIComponent).join('/')}`;

const storage = {
  from(_bucket: string) {
    return {
      async upload(path: string, body: Blob, opts: { contentType?: string; upsert?: boolean } = {}) {
        try {
          const r = await fetch(`${fileUrl(path)}${opts.upsert ? '?upsert=1' : ''}`, { method: 'PUT', body, headers: opts.contentType ? { 'Content-Type': opts.contentType } : {} });
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            return { data: null, error: { message: b.error || `Upload failed (${r.status})` } };
          }
          return { data: { path }, error: null };
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      },
      async remove(paths: string[]) {
        await Promise.all(paths.map((p) => fetch(fileUrl(p), { method: 'DELETE' }).catch(() => null)));
        return { data: paths, error: null };
      },
      /** Local files need no signing: the URL is the file. Missing files get no URL, so callers fall back to the web link. */
      async createSignedUrls(paths: string[], _ttl: number) {
        const have = await post<Record<string, boolean>>('/local/exists', paths).catch(() => ({}) as Record<string, boolean>);
        return { data: paths.map((path) => ({ path, signedUrl: have[path] ? fileUrl(path) : null, error: have[path] ? null : 'missing' })), error: null };
      },
      async createSignedUrl(path: string, _ttl: number) {
        return { data: { signedUrl: fileUrl(path) }, error: null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: fileUrl(path) } };
      },
    };
  },
};

// ------------------------------------------------------------------- realtime
type Channel = { on: (type: string, opts: { table: string; [k: string]: unknown }, cb: () => void) => Channel; subscribe: () => Channel; _stop: () => void };
function channel(_name: string): Channel {
  const handlers: { table: string; cb: () => void }[] = [];
  let listener: ((e: Event) => void) | null = null;
  const ch: Channel = {
    on(_type, opts, cb) {
      handlers.push({ table: opts.table, cb });
      return ch;
    },
    subscribe() {
      listener = (e: Event) => {
        const t = (e as CustomEvent).detail;
        for (const h of handlers) if (h.table === t) h.cb();
      };
      bus.addEventListener('change', listener);
      return ch;
    },
    _stop() {
      if (listener) bus.removeEventListener('change', listener);
    },
  };
  return ch;
}

// ---------------------------------------------------------------------- auth
// No sign-in on your own PC. These exist so older code paths keep compiling.
const LOCAL_SESSION = { access_token: 'local', user: { email: 'owner@local' } } as any;
const auth = {
  async getSession() {
    return { data: { session: LOCAL_SESSION }, error: null };
  },
  onAuthStateChange(_cb: unknown) {
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async signOut() {
    return { error: null };
  },
};

export const supabase = {
  from: <T = any>(table: string) => new Query<T>(table),
  async rpc(fn: string, args?: Record<string, unknown>): Promise<Result> {
    try {
      return await post<Result>(`/local/rpc/${encodeURIComponent(fn)}`, args || {});
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },
  storage,
  channel,
  removeChannel(ch: Channel) {
    ch._stop();
  },
  auth,
};

/** fetch() to our own /api (no sign-in locally). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, init);
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
  return body as T;
}
