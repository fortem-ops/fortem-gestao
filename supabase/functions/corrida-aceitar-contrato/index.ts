import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/corrida-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { ok, ip } = await checkRateLimit(admin, req, "aceitar-contrato", 10, 60);
    if (!ok) return json(429, { error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.contratos_documentos_ids)
      ? body.contratos_documentos_ids.filter((v: unknown) => typeof v === "string" && UUID_RE.test(v))
      : [];
    if (!ids.length) return json(400, { error: "contratos_documentos_ids_obrigatorio" });
    if (ids.length > 10) return json(400, { error: "muitos_documentos" });

    const formatoAceite =
      typeof body?.formato_aceite === "string" && body.formato_aceite.trim()
        ? body.formato_aceite.trim().slice(0, 60)
        : "checkout_corrida";

    const { data: docs, error: docsErr } = await admin
      .from("contratos_documentos")
      .select("id, aceite")
      .in("id", ids);
    if (docsErr) throw docsErr;

    const encontrados = new Set((docs ?? []).map((d: any) => d.id));
    const faltando = ids.filter((id) => !encontrados.has(id));
    if (faltando.length) return json(404, { error: "documento_nao_encontrado" });

    const pendentes = (docs ?? []).filter((d: any) => !d.aceite).map((d: any) => d.id);
    const agora = new Date().toISOString();

    if (pendentes.length) {
      const { error: upErr } = await admin
        .from("contratos_documentos")
        .update({
          aceite: true,
          data_aceite: agora,
          formato_aceite: formatoAceite,
          ip_aceite: ip,
        })
        .in("id", pendentes);
      if (upErr) throw upErr;
    }

    return json(200, { ok: true, aceitos: pendentes.length, ja_aceitos: ids.length - pendentes.length });
  } catch (err) {
    console.error("corrida-aceitar-contrato error:", err);
    return json(500, { error: "erro_interno" });
  }
});
