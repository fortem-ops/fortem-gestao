import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_URL = "https://jmdgxyzqaujxnclmvxlh.supabase.co";
const SOURCE_PROJECT_REF = "jmdgxyzqaujxnclmvxlh";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeSecret = (value: string) => value.trim().replace(/^['"]|['"]$/g, "").trim();

const readJwtPayload = (jwt: string): Record<string, unknown> | null => {
  try {
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth: must be admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const localAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(localUrl, localAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const admin = createClient(localUrl, localServiceKey);
    const { data: isAdminRow } = await admin.rpc("is_admin", { _user_id: userId });
    if (!isAdminRow) {
      return jsonResponse({ error: "Forbidden — admin only" }, 403);
    }

    // --- Source client ---
    const rawSourceKey = Deno.env.get("CONSENT_CARE_SERVICE_ROLE_KEY");
    if (!rawSourceKey) {
      return jsonResponse({ error: "CONSENT_CARE_SERVICE_ROLE_KEY not configured" }, 500);
    }
    const sourceKey = normalizeSecret(rawSourceKey);
    const sourceClaims = readJwtPayload(sourceKey);
    if (sourceClaims?.ref !== SOURCE_PROJECT_REF || sourceClaims?.role !== "service_role") {
      return jsonResponse({
        error: "A chave configurada para o Consent & Care não é a service_role do projeto de origem.",
        expected_project: SOURCE_PROJECT_REF,
        received_project: sourceClaims?.ref ?? null,
        received_role: sourceClaims?.role ?? null,
      }, 400);
    }
    const source = createClient(SOURCE_URL, sourceKey);

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let totalSource = 0;
    const errorDetails: string[] = [];

    const PAGE = 500;
    let offset = 0;

    while (true) {
      const { data: rows, error: srcErr } = await source
        .from("legal_annexes")
        .select("*")
        .order("signed_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (srcErr) throw new Error(`Erro lendo origem: ${srcErr.message}`);
      if (!rows || rows.length === 0) break;
      totalSource += rows.length;

      for (const r of rows) {
        try {
          // Dedup by (cpf, signed_at)
          const { data: existing } = await admin
            .from("legal_annexes")
            .select("id")
            .eq("cpf", r.cpf)
            .eq("signed_at", r.signed_at)
            .maybeSingle();
          if (existing) { skipped++; continue; }

          const docType = r.document_type === "experimental" ? "experimental" : "anexo";
          const medical = r.medical_status === "restricao" ? "restricao" : "ok";

          const { error: insErr } = await admin.from("legal_annexes").insert({
            nome: r.nome,
            data_nascimento: r.data_nascimento,
            cpf: r.cpf,
            telefone: r.telefone,
            email: r.email,
            emergency_contact_name: r.emergency_contact_name,
            emergency_contact_phone: r.emergency_contact_phone,
            medical_status: medical,
            image_usage: !!r.image_usage,
            signature_data: r.signature_data,
            document_type: docType,
            ip_address: r.ip_address,
            signed_at: r.signed_at,
            valid_until: r.valid_until,
            created_at: r.created_at,
          });
          if (insErr) {
            errors++;
            errorDetails.push(`${r.cpf} @ ${r.signed_at}: ${insErr.message}`);
          } else {
            imported++;
          }
        } catch (e) {
          errors++;
          errorDetails.push(`${r.cpf}: ${(e as Error).message}`);
        }
      }

      if (rows.length < PAGE) break;
      offset += PAGE;
    }

    return new Response(JSON.stringify({
      ok: true,
      total_source: totalSource,
      imported,
      skipped,
      errors,
      error_samples: errorDetails.slice(0, 5),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("migrate-from-consent-care error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
