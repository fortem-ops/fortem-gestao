// Valida o token público de um link de pagamento da Corrida e devolve
// tudo o que a tela /corrida/pagamento/:token precisa para concluir o pagamento
// de uma venda/contrato que já existem (não cria pedido novo).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { ok } = await checkRateLimit(admin, req, "validar-link-pagamento", 30, 60);
    if (!ok) return json(429, { ok: false, error: "muitas_tentativas" });

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    if (!token || token.length > 128) return json(200, { ok: false, estado: "invalido" });

    const { data: link } = await admin
      .from("corrida_links_pagamento")
      .select("id, venda_id, expira_em")
      .eq("token", token)
      .maybeSingle();

    if (!link) return json(200, { ok: false, estado: "invalido" });
    if (new Date(link.expira_em).getTime() < Date.now()) {
      return json(200, { ok: false, estado: "expirado" });
    }

    const { data: venda } = await admin
      .from("vendas")
      .select("id, aluno_id, plano_id, valor_final, parcelas, forma_pagamento, nome_snapshot, status_pagamento, observacoes")
      .eq("id", link.venda_id)
      .maybeSingle();

    if (!venda) return json(200, { ok: false, estado: "invalido" });
    if (venda.status_pagamento === "pago") return json(200, { ok: false, estado: "ja_pago" });

    const { data: aluno } = await admin
      .from("alunos")
      .select("id, nome, email, telefone")
      .eq("id", venda.aluno_id)
      .maybeSingle();

    // contrato da venda: mesmo caminho usado pelo webhook do Pix (via plano)
    const { data: contrato } = venda.plano_id
      ? await admin
        .from("contratos")
        .select("id")
        .eq("plano_id", venda.plano_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      : { data: null as any };

    const contratoId: string | null = contrato?.id ?? null;

    let documentosPendentes: { id: string; nome: string; conteudo_gerado: string }[] = [];
    if (contratoId) {
      const { data: docs } = await admin
        .from("contratos_documentos")
        .select("id, aceite, conteudo_gerado, contrato_templates(nome)")
        .eq("contrato_id", contratoId);

      documentosPendentes = (docs ?? [])
        .filter((d: any) => !d.aceite)
        .map((d: any) => ({
          id: d.id,
          nome: d.contrato_templates?.nome ?? "Contrato",
          conteudo_gerado: d.conteudo_gerado ?? "",
        }));
    }

    // novo token de checkout do cartão (o original do pedido pode ter expirado)
    const cartaoToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error: tokErr } = await admin.from("links_cartao").insert({
      aluno_id: venda.aluno_id,
      token: cartaoToken,
      origem: "link_cadastro",
      criado_por: null,
      expira_em: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
    if (tokErr) throw tokErr;

    let resumo: any = null;
    let rota = "";
    try {
      const obs = JSON.parse(String(venda.observacoes ?? "{}"));
      resumo = obs?.pedidoResumo ?? null;
      rota = String(obs?.rota ?? "");
    } catch { /* observacoes não-JSON */ }

    const linhas = Array.isArray(resumo?.linhas)
      ? resumo.linhas.map((l: any) => ({ label: String(l?.label ?? ""), valor: Number(l?.valor ?? 0) }))
      : [{ label: String(venda.nome_snapshot ?? "Pedido Corrida Fortem"), valor: Number(venda.valor_final ?? 0) }];

    // Pix à vista: mesma regra do checkout — indisponível para Somente Provas
    // e para o plano mensal no cartão (recorrência).
    const pixDisponivel = rota !== "somente_provas" && venda.forma_pagamento !== "cartao_recorrencia";

    return json(200, {
      ok: true,
      estado: "pendente",
      venda: {
        id: venda.id,
        valor_final: Number(venda.valor_final ?? 0),
        parcelas: Math.max(1, Number(venda.parcelas ?? 1)),
        nome_snapshot: venda.nome_snapshot,
      },
      resumo_linhas: linhas,
      pix_disponivel: pixDisponivel,
      aluno: {
        nome: aluno?.nome ?? "",
        email: aluno?.email ?? "",
        telefone: aluno?.telefone ?? "",
      },
      pedido: {
        aluno_id: venda.aluno_id,
        contrato_id: contratoId,
        venda_id: venda.id,
        cartao_token: cartaoToken,
        contratos_documentos_ids: documentosPendentes.map((d) => d.id),
        contratos_documentos: documentosPendentes,
      },
    });
  } catch (err) {
    console.error("corrida-validar-link-pagamento error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
