/**
 * Every API route is for invited people only (team members or project guests). We check the caller's Supabase session
 * token, then ask Supabase (with that same token) whether they're in the
 * members table. Row Level Security answers truthfully for us.
 */
export async function requireMember(req: Request): Promise<Response | null> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return json({ error: 'Server is missing Supabase settings.' }, 500);

  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return json({ error: 'Not signed in.' }, 401);

  const r = await fetch(`${url}/rest/v1/rpc/has_access`, {
    method: 'POST',
    headers: { apikey: key, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) return json({ error: 'Session expired. Sign in again.' }, 401);
  const allowed = await r.json();
  if (allowed !== true) return json({ error: 'You are not on the invite list.' }, 403);
  return null;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
