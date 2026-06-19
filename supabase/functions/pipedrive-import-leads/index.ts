import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ItemSchema = z.object({
  dealId: z.string().min(1),
  personId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(60).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  pipedriveStageId: z.number().int().optional().nullable(),
});
const BodySchema = z.object({
  items: z.array(ItemSchema).min(1).max(500),
  defaultResponsavelId: z.string().uuid().optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

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

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { items, defaultResponsavelId } = parsed.data;

    let imported = 0;
    let skipped = 0;
    const errors: { dealId: string; message: string }[] = [];
    const importedAlunoIds: string[] = [];

    for (const it of items) {
      try {
        // Idempotency: skip if deal or person already imported
        const { data: existing } = await admin
          .from("pipeline_metadata")
          .select("aluno_id, pipedrive_deal_id, pipedrive_person_id")
          .or(
            [
              `pipedrive_deal_id.eq.${it.dealId}`,
              it.personId ? `pipedrive_person_id.eq.${it.personId}` : null,
            ].filter(Boolean).join(","),
          )
          .limit(1)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const responsavelId = it.responsavelId || defaultResponsavelId || userId;

        const { data: aluno, error: insErr } = await admin
          .from("alunos")
          .insert({
            nome: it.name,
            telefone: it.phone || "",
            status: "lead",
            responsavel_id: responsavelId,
          })
          .select("id")
          .single();
        if (insErr || !aluno) throw new Error(insErr?.message || "Falha ao criar aluno");

        const alunoId = aluno.id as string;

        const { error: metaErr } = await admin
          .from("pipeline_metadata")
          .upsert(
            {
              aluno_id: alunoId,
              origem_lead: "Pipedrive",
              pipedrive_person_id: it.personId || null,
              pipedrive_deal_id: it.dealId,
              pipedrive_imported_at: new Date().toISOString(),
            },
            { onConflict: "aluno_id" },
          );
        if (metaErr) throw new Error(metaErr.message);

        const { error: moveErr } = await admin.rpc("fn_move_pipeline" as any, {
          _aluno_id: alunoId,
          _to_stage_name: "Novo lead",
          _source: "manual",
          _notes: `Importado do Pipedrive (deal ${it.dealId})`,
        });
        if (moveErr) throw new Error(moveErr.message);

        imported++;
        importedAlunoIds.push(alunoId);
      } catch (e) {
        errors.push({ dealId: it.dealId, message: (e as Error).message });
      }
    }

    return json({ imported, skipped, errors, importedAlunoIds });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
