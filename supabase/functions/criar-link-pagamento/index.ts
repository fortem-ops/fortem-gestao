// Gera um link público de pagamento para uma venda da Corrida ainda pendente.
// Rota interna: exige usuário autenticado com papel de coordenação/administração.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const BASE_URL = "https://soufortem.com.br";

function gerarToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json(401, { ok: false, error: "nao_autenticado" });

    const { data: autorizado } = await admin.rpc("is_coordinator_or_admin", { _user_id: user.id });
    if (!autorizado) return json(403, { ok: false, error: "sem_permissao" });

    const body = await req.json().catch(() => ({}));
    const vendaId = String(body?.venda_id ?? "").trim();
    if (!UUID_RE.test(vendaId)) return json(400, { ok: false, error: "venda_id_invalido" });

    const { data: venda } = await admin
      .from("vendas")
      .select("id, status_pagamento")
      .eq("id", vendaId)
      .maybeSingle();

    if (!venda) return json(404, { ok: false, error: "venda_nao_encontrada" });
    if (venda.status_pagamento === "pago") return json(409, { ok: false, error: "venda_ja_paga" });

    const agora = new Date().toISOString();

    // reaproveita link ainda válido e não consumido
    const { data: existente } = await admin
      .from("links_pagamento")
      .select("token")
      .eq("venda_id", vendaId)
      .is("usado_em", null)
      .gt("expira_em", agora)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente?.token) {
      return json(200, { ok: true, reused: true, url: `${BASE_URL}/pagamento/${existente.token}` });
    }

    const token = gerarToken();
    const { error: insErr } = await admin
      .from("links_pagamento")
      .insert({ venda_id: vendaId, token, criado_por: user.id });
    if (insErr) throw insErr;

    return json(200, { ok: true, url: `${BASE_URL}/pagamento/${token}` });
  } catch (err) {
    console.error("criar-link-pagamento error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
