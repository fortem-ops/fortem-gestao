// Migra registros de `legal_annexes` do projeto Consent & Care para o Fortem.
//
// ARQUITETURA: Como projetos Lovable Cloud não expõem a service_role para fora,
// invertemos a direção: o Consent & Care expõe uma edge function pública
// (`export-legal-annexes`) protegida por um token compartilhado, e este Fortem
// consome esse endpoint. Sem necessidade de service_role do outro projeto.
//
// Secret necessário: CONSENT_CARE_MIGRATION_TOKEN — mesma string definida no
// secret MIGRATION_TOKEN do projeto Consent & Care.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCE_EXPORT_URL =
  "https://jmdgxyzqaujxnclmvxlh.supabase.co/functions/v1/export-legal-annexes";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface LegalAnnexRow {
  nome: string;
  data_nascimento: string | null;
  cpf: string;
  telefone: string | null;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_status: string | null;
  image_usage: boolean | null;
  signature_data: string | null;
  document_type: string | null;
  ip_address: string | null;
  signed_at: string;
  valid_until: string | null;
  created_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth: must be admin of Fortem ---
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

    // --- Token compartilhado para falar com Consent & Care ---
    const migrationToken = Deno.env.get("CONSENT_CARE_MIGRATION_TOKEN");
    if (!migrationToken) {
      return jsonResponse({
        error:
          "CONSENT_CARE_MIGRATION_TOKEN não configurado. Adicione o mesmo valor que está no secret MIGRATION_TOKEN do projeto Consent & Care.",
      }, 500);
    }

    // Body opcional: { dryRun?: boolean }
    let dryRun = false;
    try {
      if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
        const body = await req.json();
        dryRun = !!body?.dryRun;
      }
    } catch {
      // ignore
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let totalSource = 0;
    const errorDetails: string[] = [];

    const PAGE = 500;
    let offset = 0;

    while (true) {
      const url = `${SOURCE_EXPORT_URL}?limit=${PAGE}&offset=${offset}`;
      const resp = await fetch(url, {
        headers: { "x-migration-token": migrationToken },
      });

      if (!resp.ok) {
        const body = await resp.text();
        return jsonResponse({
          error: "Origem (Consent & Care) rejeitou a requisição",
          status: resp.status,
          body: body.slice(0, 400),
          hint:
            resp.status === 401
              ? "Verifique se o secret CONSENT_CARE_MIGRATION_TOKEN aqui no Fortem tem o mesmo valor do MIGRATION_TOKEN no Consent & Care."
              : resp.status === 404
              ? "A edge function `export-legal-annexes` ainda não foi criada/deployada no projeto Consent & Care."
              : undefined,
        }, 502);
      }

      const payload = await resp.json() as { data: LegalAnnexRow[]; total?: number };
      const rows = payload.data ?? [];
      if (rows.length === 0) break;
      totalSource += rows.length;

      if (dryRun) {
        skipped += rows.length;
      } else {
        for (const r of rows) {
          try {
            const { data: existing } = await admin
              .from("legal_annexes")
              .select("id")
              .eq("cpf", r.cpf)
              .eq("signed_at", r.signed_at)
              .maybeSingle();
            if (existing) {
              skipped++;
              continue;
            }

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
      }

      if (rows.length < PAGE) break;
      offset += PAGE;
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      total_source: totalSource,
      imported,
      skipped,
      errors,
      error_samples: errorDetails.slice(0, 5),
    });
  } catch (err) {
    console.error("migrate-from-consent-care error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
