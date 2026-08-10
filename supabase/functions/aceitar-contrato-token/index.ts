import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "token obrigatório" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: rpcData, error: rpcError } = await admin.rpc("fn_validar_link_contrato", {
      p_token: token,
    });

    if (rpcError) return json({ error: rpcError.message }, 500);

    const result = (rpcData ?? {}) as Record<string, any>;
    if (!result.valido) {
      return json({ error: result.motivo ?? "Link inválido" }, 400);
    }

    if (result.aceite === true) {
      return json({ ok: true, already: true }, 200);
    }

    const contratoDocumentoId = result.contrato_documento_id;
    if (!contratoDocumentoId) {
      return json({ error: "Documento não encontrado" }, 404);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const agora = new Date().toISOString();

    const { error: upErr } = await admin
      .from("contratos_documentos")
      .update({
        aceite: true,
        data_aceite: agora,
        formato_aceite: "link_publico",
        ip_aceite: ip,
      })
      .eq("id", contratoDocumentoId);

    if (upErr) return json({ error: upErr.message }, 500);

    const { error: linkErr } = await admin
      .from("links_contrato")
      .update({ usado: true, usado_em: agora })
      .eq("token", token);

    if (linkErr) return json({ error: linkErr.message }, 500);

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
