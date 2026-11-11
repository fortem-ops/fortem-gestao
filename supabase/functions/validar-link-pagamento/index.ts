// Valida o token público de um link de pagamento e devolve tudo o que a tela
// /pagamento/:token precisa para concluir o pagamento de uma venda/contrato
// que já existem (não cria pedido novo). Serve tanto para vendas da Corrida
// quanto para vendas internas genéricas (planos, VIP, etc).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/corrida-rate-limit.ts";
import { avaliarTurnstile } from "../_shared/planos-turnstile.ts";

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
      .from("links_pagamento")
      .select("id, venda_id, expira_em, humano_em")
      .eq("token", token)
      .maybeSingle();

    if (!link) return json(200, { ok: false, estado: "invalido" });
    if (new Date(link.expira_em).getTime() < Date.now()) {
      return json(200, { ok: false, estado: "expirado" });
    }

    const { data: venda } = await admin
      .from("vendas")
      .select("id, aluno_id, plano_id, valor_final, parcelas, forma_pagamento, nome_snapshot, status_pagamento, observacoes, origem, tipo, catalogo_id")
      .eq("id", link.venda_id)
      .maybeSingle();

    if (!venda) return json(200, { ok: false, estado: "invalido" });
    if (venda.status_pagamento === "pago") return json(200, { ok: false, estado: "ja_pago" });
    // venda desistida/expirada/estornada: o link deixa de valer
    if (["cancelado", "estornado", "falha"].includes(String(venda.status_pagamento))) {
      return json(200, { ok: false, estado: "expirado" });
    }

    // Plano Semestral: verificação Turnstile ligada ao link (exigida de novo na cobrança)
    const { data: cat } = venda.catalogo_id
      ? await admin.from("planos_catalogo").select("familia, nome, nome_exibicao").eq("id", venda.catalogo_id).maybeSingle()
      : { data: null };
    const semestral = cat?.familia === "semestral_2027";
    const cfg = async (chave: string) =>
      (await admin.from("sistema_config").select("valor").eq("chave", chave).maybeSingle()).data?.valor ?? null;
    const turnstileAtivo = semestral && (await cfg("planos_turnstile_ativo")) === true;
    if (body?.acao === "turnstile") {
      if (!semestral) return json(200, { ok: false, error: "nao_se_aplica" });
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const r = await avaliarTurnstile(turnstileAtivo, Deno.env.get("TURNSTILE_SECRET_KEY"), body?.turnstile_token, ip);
      if (r === "recusado") return json(200, { ok: false, error: "captcha" });
      await admin.from("links_pagamento").update({ humano_em: new Date().toISOString() }).eq("id", link.id);
      return json(200, { ok: true });
    }

    // origem da venda: Corrida (tem inscrição de prova) ou venda interna genérica
    const { data: inscricao } = await admin
      .from("corrida_inscricoes_prova")
      .select("id")
      .eq("venda_id", venda.id)
      .limit(1)
      .maybeSingle();
    const origem: "corrida" | "generica" = inscricao ? "corrida" : "generica";

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

    // Compra avulsa do portal nunca tem contrato nem aceite.
    const contratoId: string | null = venda.origem === "portal_avulso" ? null : (contrato?.id ?? null);

    let documentosPendentes: { id: string; nome: string; conteudo_gerado: string }[] = [];
    if (contratoId) {
      const { data: docs } = await admin
        .from("contratos_documentos")
        .select("id, aceite, conteudo_gerado, template_id")
        .eq("contrato_id", contratoId);

      const pendentes = (docs ?? []).filter((d: any) => !d.aceite);
      const templateIds = [...new Set(pendentes.map((d: any) => d.template_id).filter(Boolean))];
      const { data: templates } = templateIds.length
        ? await admin.from("contrato_templates").select("id, nome").in("id", templateIds)
        : { data: [] as any[] };
      const nomePorTemplate = new Map((templates ?? []).map((t: any) => [t.id, t.nome]));

      documentosPendentes = pendentes.map((d: any) => ({
        id: d.id,
        nome: nomePorTemplate.get(d.template_id) ?? "Contrato",
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

    let linhas: { label: string; valor: number }[];
    let pixDisponivel = false;
    let servicoPortal = false;

    if (semestral) {
      linhas = [{ label: `${cat?.nome_exibicao ?? cat?.nome ?? "Plano Semestral"} · 1ª mensalidade`, valor: Number(venda.valor_final ?? 0) }];
      pixDisponivel = false;
    } else if (origem === "corrida") {
      let resumo: any = null;
      let rota = "";
      try {
        const obs = JSON.parse(String(venda.observacoes ?? "{}"));
        resumo = obs?.pedidoResumo ?? null;
        rota = String(obs?.rota ?? "");
      } catch { /* observacoes não-JSON */ }

      linhas = Array.isArray(resumo?.linhas)
        ? resumo.linhas.map((l: any) => ({ label: String(l?.label ?? ""), valor: Number(l?.valor ?? 0) }))
        : [{ label: String(venda.nome_snapshot ?? "Pedido Corrida Fortem"), valor: Number(venda.valor_final ?? 0) }];

      // Pix à vista: mesma regra do checkout — indisponível para Somente Provas
      // e para o plano mensal no cartão (recorrência).
      pixDisponivel = rota !== "somente_provas" && venda.forma_pagamento !== "cartao_recorrencia";
    } else {
      // venda interna: resumo simples a partir dos próprios campos da venda.
      linhas = [{
        label: String(venda.nome_snapshot ?? "Pagamento Fortem"),
        valor: Number(venda.valor_final ?? 0),
      }];
      pixDisponivel = false;
      // Única exceção: compra avulsa de serviço feita pelo próprio aluno no portal
      // (item do catálogo com liberar_apos_pagamento). Demais vendas internas seguem só cartão.
      if (venda.origem === "portal_avulso" && venda.tipo === "servico" && venda.catalogo_id) {
        const { data: cat } = await admin
          .from("servicos_catalogo")
          .select("liberar_apos_pagamento")
          .eq("id", venda.catalogo_id)
          .maybeSingle();
        servicoPortal = Boolean(cat?.liberar_apos_pagamento);
        pixDisponivel = servicoPortal;
      }
    }

    return json(200, {
      ok: true,
      estado: "pendente",
      origem,
      venda: {
        id: venda.id,
        valor_final: Number(venda.valor_final ?? 0),
        parcelas: Math.max(1, Number(venda.parcelas ?? 1)),
        nome_snapshot: venda.nome_snapshot,
      },
      resumo_linhas: linhas,
      pix_disponivel: pixDisponivel,
      servico_portal: servicoPortal,
      // Semestral: só o primeiro nome (o link não expõe e-mail nem telefone).
      aluno: semestral
        ? { nome: String(aluno?.nome ?? "").trim().split(/\s+/)[0] ?? "", email: "", telefone: "" }
        : {
          nome: aluno?.nome ?? "",
          email: aluno?.email ?? "",
          telefone: aluno?.telefone ?? "",
        },
      semestral: semestral
        ? {
          plano: cat?.nome_exibicao ?? cat?.nome ?? "Plano Semestral",
          link_expira_em: link.expira_em,
          turnstile_ativo: turnstileAtivo,
          site_key: turnstileAtivo ? await cfg("planos_turnstile_site_key") : null,
        }
        : null,
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
    console.error("validar-link-pagamento error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
