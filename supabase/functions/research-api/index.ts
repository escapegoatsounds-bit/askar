// Askar research API — used by the scheduled research sessions (which have no Supabase connector).
// Auth: header `X-Research-Token` must equal the RESEARCH_TOKEN secret. It can ONLY:
//   next        -> claim the next batch of places to research
//   update_place-> write research fields for one place (whitelisted columns)
//   add_images  -> insert openly licensed images for places (ignores duplicates)
//   reset_place -> put a place back in the queue with a note
//   log         -> record a run summary
import { createClient } from "npm:@supabase/supabase-js@2";

const FIELDS = new Set([
  "wikipedia_title", "summary", "culture", "dates_text", "facts", "rulers", "deities", "beliefs",
  "sources", "lat", "lng", "coords_verified", "research_status", "research_notes",
]);
const OPEN_LICENCE = /^(public domain|pd|cc0|cc[- ]by(-sa)?([ -]\d(\.\d)?)?)/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("RESEARCH_TOKEN") || "";
  const got = req.headers.get("x-research-token") || "";
  if (expected.length < 16 || got !== expected) return json({ error: "unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "send JSON" }, 400);
  }

  try {
    switch (body.action) {
      case "next": {
        const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 10);
        const { data, error } = await db
          .from("sites")
          .select("id, name, aliases, region, eras, lat, lng, description")
          .eq("research_status", "todo")
          .order("research_requested_at", { ascending: false, nullsFirst: false })
          .order("priority", { ascending: false })
          .order("id")
          .limit(limit);
        if (error) throw error;
        const ids = (data || []).map((r) => r.id);
        if (ids.length) {
          const { error: e2 } = await db.from("sites").update({ research_status: "in_progress" }).in("id", ids);
          if (e2) throw e2;
        }
        return json({ places: data || [] });
      }
      case "update_place": {
        const id = Number(body.id);
        if (!id) return json({ error: "id required" }, 400);
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body.fields || {})) if (FIELDS.has(k)) patch[k] = v;
        if (!["done", "needs_review"].includes(String(patch.research_status))) patch.research_status = "done";
        patch.researched_at = new Date().toISOString();
        patch.research_requested_at = null;
        const { error } = await db.from("sites").update(patch).eq("id", id);
        if (error) throw error;
        return json({ ok: true, updated: Object.keys(patch) });
      }
      case "add_images": {
        const rows = (Array.isArray(body.items) ? body.items : []).slice(0, 20).filter((it: any) =>
          it && it.media_url && it.external_id && it.site && OPEN_LICENCE.test(String(it.license || "").trim()),
        ).map((it: any) => ({
          kind: "image",
          title: String(it.title || "Untitled").slice(0, 300),
          description: it.description ? String(it.description).slice(0, 1000) : null,
          source_name: it.source_name || "Wikimedia Commons",
          source_url: it.source_url || null,
          media_url: it.media_url,
          thumb_url: it.thumb_url || it.media_url,
          external_id: String(it.external_id),
          license: String(it.license),
          credit: it.credit ? String(it.credit).slice(0, 300) : null,
          era_id: it.era_id || null,
          site: String(it.site),
          category: it.category || null,
          created_by: null,
          created_by_email: "research@askar",
        }));
        if (!rows.length) return json({ inserted: 0, note: "nothing valid (needs media_url, external_id, site and an open licence)" });
        const { data, error } = await db.from("items").upsert(rows, { onConflict: "external_id", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        return json({ inserted: (data || []).length, offered: rows.length });
      }
      case "reset_place": {
        const { error } = await db.from("sites").update({ research_status: "todo", research_notes: String(body.note || "").slice(0, 1000) }).eq("id", Number(body.id));
        if (error) throw error;
        return json({ ok: true });
      }
      case "log": {
        const { error } = await db.from("research_log").insert({
          places: Array.isArray(body.places) ? body.places.map(String) : [],
          summary: body.summary ? String(body.summary).slice(0, 2000) : null,
          images_added: Number(body.images_added) || 0,
        });
        if (error) throw error;
        return json({ ok: true });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
