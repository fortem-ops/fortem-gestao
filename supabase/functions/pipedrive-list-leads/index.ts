import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PIPEDRIVE_API_KEY = Deno.env.get("PIPEDRIVE_API_KEY");

const GATEWAY = "https://connector-gateway.lovable.dev/pipedrive";

const BodySchema = z.object({
  stageId: z.number().int().optional().nullable(),
  ownerId: z.number().int().optional().nullable(),
  since: z.string().optional().nullable(), // ISO date
  status: z.enum(["open", "won", "lost", "all_not_deleted"]).optional().default("open"),
  limit: z.number().int().min(1).max(500).optional().default(100),
}).default({});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pdHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": PIPEDRIVE_API_KEY!,
  };
}

async function pdGet(path: string): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, { headers: pdHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`Pipedrive ${path} → ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!LOVABLE_API_KEY || !PIPEDRIVE_API_KEY) return json({ error: "Pipedrive not configured" }, 500);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const [isAdmin, isCoord] = await Promise.all([
      admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
    ]);
    if (!isAdmin.data && !isCoord.data) return json({ error: "Forbidden" }, 403);

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { stageId, ownerId, since, limit, status } = parsed.data;

    // Fetch deals. Pipedrive supports start/limit and filter by stage_id, user_id, status.
    const qs = new URLSearchParams();
    qs.set("status", status);
    qs.set("limit", String(limit ?? 100));
    qs.set("start", "0");
    if (stageId) qs.set("stage_id", String(stageId));
    if (ownerId) qs.set("user_id", String(ownerId));

    const dealsRes = await pdGet(`/deals?${qs.toString()}`);
    let deals: any[] = Array.isArray(dealsRes?.data) ? dealsRes.data : [];

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        deals = deals.filter((d) => {
          const ad = d.add_time ? new Date(d.add_time.replace(" ", "T") + "Z") : null;
          return ad ? ad >= sinceDate : true;
        });
      }
    }

    // Check duplicates in pipeline_metadata
    const dealIds = deals.map((d) => String(d.id));
    const personIds = deals.map((d) => d.person_id?.value ?? d.person_id).filter(Boolean).map(String);

    const dupDeals = dealIds.length
      ? (await admin.from("pipeline_metadata").select("pipedrive_deal_id").in("pipedrive_deal_id", dealIds)).data ?? []
      : [];
    const dupPersons = personIds.length
      ? (await admin.from("pipeline_metadata").select("pipedrive_person_id").in("pipedrive_person_id", personIds)).data ?? []
      : [];
    const dupDealSet = new Set(dupDeals.map((r: any) => r.pipedrive_deal_id));
    const dupPersonSet = new Set(dupPersons.map((r: any) => r.pipedrive_person_id));

    const items = deals.map((d) => {
      const personId = d.person_id?.value ?? d.person_id ?? null;
      const personName = d.person_id?.name ?? d.person_name ?? d.title ?? "—";
      const phone = Array.isArray(d.person_id?.phone)
        ? (d.person_id.phone[0]?.value ?? "")
        : (d.person_id?.phone ?? "");
      const email = Array.isArray(d.person_id?.email)
        ? (d.person_id.email[0]?.value ?? "")
        : (d.person_id?.email ?? "");
      const ownerName = d.user_id?.name ?? d.owner_name ?? "—";
      const stageName = d.stage_id?.name ?? d.stage_name ?? null;
      return {
        dealId: String(d.id),
        personId: personId ? String(personId) : null,
        name: personName,
        phone: phone || "",
        email: email || "",
        ownerName,
        ownerId: d.user_id?.id ?? d.user_id ?? null,
        stageId: d.stage_id?.id ?? d.stage_id ?? null,
        stageName,
        value: d.value ?? null,
        currency: d.currency ?? null,
        addedAt: d.add_time ?? null,
        alreadyImported: dupDealSet.has(String(d.id)) || (personId && dupPersonSet.has(String(personId))),
      };
    });

    return json({ items, total: items.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
