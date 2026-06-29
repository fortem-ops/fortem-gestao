import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ROLES = ["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"] as const;

const CreateSchema = z.object({
  action: z.literal("create"),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  specialty: z.string().trim().max(120).optional().nullable(),
  cpf: z.string().trim().max(14).optional().nullable(),
  pis_pasep: z.string().trim().max(14).optional().nullable(),
  role: z.enum(ROLES).optional().nullable(),
});

const UpdateSchema = z.object({
  action: z.literal("update"),
  user_id: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).max(72).optional().nullable(),
  full_name: z.string().trim().min(1).max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  specialty: z.string().trim().max(120).optional().nullable(),
  cpf: z.string().trim().max(14).optional().nullable(),
  pis_pasep: z.string().trim().max(14).optional().nullable(),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  user_id: z.string().uuid(),
});

const ListEmailsSchema = z.object({ action: z.literal("list-emails") });

const BodySchema = z.discriminatedUnion("action", [
  CreateSchema,
  UpdateSchema,
  DeleteSchema,
  ListEmailsSchema,
]);

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
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdminData, error: isAdminErr } = await admin.rpc("is_admin", { _user_id: callerId });
    if (isAdminErr) return json({ error: isAdminErr.message }, 500);
    if (!isAdminData) return json({ error: "Forbidden: admin only" }, 403);

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    if (body.action === "list-emails") {
      const emails: { user_id: string; email: string | null }[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) return json({ error: error.message }, 500);
        for (const u of data.users) emails.push({ user_id: u.id, email: u.email ?? null });
        if (data.users.length < perPage) break;
        page++;
      }
      return json({ emails });
    }

    if (body.action === "create") {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name },
      });
      if (cErr || !created.user) return json({ error: cErr?.message || "create failed" }, 400);
      const uid = created.user.id;

      const { error: pErr } = await admin.from("profiles").upsert(
        {
          user_id: uid,
          full_name: body.full_name,
          phone: body.phone ?? null,
          specialty: body.specialty ?? null,
          cpf: body.cpf ? body.cpf.replace(/\D/g, "") : null,
          pis_pasep: body.pis_pasep ? body.pis_pasep.replace(/\D/g, "") : null,
        },
        { onConflict: "user_id" },
      );
      if (pErr) return json({ error: pErr.message }, 500);

      if (body.role) {
        const { error: rErr } = await admin.from("user_roles").insert({ user_id: uid, role: body.role });
        if (rErr) return json({ error: rErr.message }, 500);
      }
      return json({ ok: true, user_id: uid });
    }

    if (body.action === "update") {
      const authPatch: Record<string, unknown> = {};
      if (body.email) authPatch.email = body.email;
      if (body.password) authPatch.password = body.password;
      if (Object.keys(authPatch).length > 0) {
        const { error: uErr } = await admin.auth.admin.updateUserById(body.user_id, authPatch);
        if (uErr) return json({ error: uErr.message }, 400);
      }

      // Validate CPF/PIS digit length (if provided non-null)
      const cpfDigits = body.cpf == null ? null : body.cpf.replace(/\D/g, "");
      const pisDigits = body.pis_pasep == null ? null : body.pis_pasep.replace(/\D/g, "");
      if (cpfDigits && cpfDigits.length !== 11) {
        return json({ error: "CPF deve conter 11 dígitos" }, 400);
      }
      if (pisDigits && pisDigits.length !== 11) {
        return json({ error: "PIS/PASEP deve conter 11 dígitos" }, 400);
      }

      // Read current profile to preserve required fields on upsert
      const { data: current } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, specialty, cpf, pis_pasep")
        .eq("user_id", body.user_id)
        .maybeSingle();

      const upsertRow: Record<string, unknown> = {
        user_id: body.user_id,
        full_name: body.full_name ?? current?.full_name ?? "Sem nome",
        phone: body.phone !== undefined ? body.phone : (current?.phone ?? null),
        specialty: body.specialty !== undefined ? body.specialty : (current?.specialty ?? null),
        cpf: body.cpf !== undefined ? (cpfDigits || null) : (current?.cpf ?? null),
        pis_pasep: body.pis_pasep !== undefined ? (pisDigits || null) : (current?.pis_pasep ?? null),
      };

      console.log("admin-users update", {
        user_id: body.user_id,
        had_profile: !!current,
        patch: { ...upsertRow, cpf: upsertRow.cpf ? "***" : null, pis_pasep: upsertRow.pis_pasep ? "***" : null },
      });

      const { data: saved, error: pErr } = await admin
        .from("profiles")
        .upsert(upsertRow, { onConflict: "user_id" })
        .select("user_id, full_name, phone, specialty, cpf, pis_pasep")
        .maybeSingle();
      if (pErr) {
        console.error("admin-users upsert error", pErr);
        return json({ error: pErr.message }, 500);
      }
      return json({ ok: true, profile: saved });
    }

    if (body.action === "delete") {
      if (body.user_id === callerId) return json({ error: "Não é permitido excluir o próprio usuário" }, 400);
      // Remove dependents that may not cascade from auth.users
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      await admin.from("profiles").delete().eq("user_id", body.user_id);
      const { error: dErr } = await admin.auth.admin.deleteUser(body.user_id);
      if (dErr) {
        const msg = dErr.message || (dErr as any).msg || JSON.stringify(dErr);
        console.error("deleteUser failed", dErr);
        return json({
          error: msg || "Falha ao excluir usuário. Pode haver vínculos (alunos, agendas, tarefas, etc.) referenciando este usuário.",
        }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = (e as Error)?.message || JSON.stringify(e);
    console.error("admin-users error", e);
    return json({ error: msg }, 500);
  }
});
