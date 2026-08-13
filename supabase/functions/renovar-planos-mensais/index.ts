import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

let _cachedSecret: string | null = null;
async function authorize(req: Request, admin: any, opts: { requireAdmin?: boolean } = {}) {
  const provided = req.headers.get("x-webhook-secret");
  if (provided) {
    if (!_cachedSecret) {
      const { data } = await admin.rpc("get_webhook_secret");
      _cachedSecret = typeof data === "string" ? data : null;
    }
    if (_cachedSecret && provided === _cachedSecret) return { ok: true as const };
  }
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: u, error } = await userClient.auth.getUser();
    if (!error && u?.user) {
      if (opts.requireAdmin) {
        const { data: isA } = await admin.rpc("is_admin", { _user_id: u.user.id });
        if (!isA) return { ok: false as const, status: 403 };
      }
      return { ok: true as const };
    }
  }
  return { ok: false as const, status: 401 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const auth = await authorize(req, supabase, { requireAdmin: true });
  if (!auth.ok) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: planos, error } = await supabase
      .from("planos")
      .select("id, aluno_id, tipo, valor, proxima_renovacao, desconto_recorrente, forma_pagamento_padrao, parcelas_padrao, atividade")
      .eq("ativo", true)
      .eq("renovacao_automatica", true)
      .lte("proxima_renovacao", today);

    if (error) throw error;

    // Cache de catálogo (por nome em minúsculas)
    const { data: catalogo, error: catErr } = await supabase
      .from("planos_catalogo")
      .select("id, nome, valor, periodo_meses")
      .eq("ativo", true);
    if (catErr) throw catErr;

    const byName = new Map<string, typeof catalogo>();
    for (const c of catalogo || []) {
      const k = (c.nome || "").toLowerCase().trim();
      if (!byName.has(k)) byName.set(k, [] as any);
      (byName.get(k) as any).push(c);
    }

    let geradas = 0;
    const erros: any[] = [];

    for (const p of planos || []) {
      const tipoKey = (p.tipo || "").toLowerCase().trim();
      const variantes = byName.get(tipoKey) || [];
      if (variantes.length === 0) {
        erros.push({ plano_id: p.id, motivo: `Catálogo não encontrado para "${p.tipo}"` });
        continue;
      }

      // Escolhe a variante: prioriza valor igual; senão pega a primeira mensal (periodo_meses=1).
      const valorAtual = Number(p.valor ?? 0);
      const exato = variantes.find((v: any) => Number(v.valor) === valorAtual);
      const mensal = variantes.find((v: any) => Number(v.periodo_meses) === 1);
      const escolhido = exato || mensal || variantes[0];

      const dataVenda = p.proxima_renovacao as string; // data em que a renovação venceu
      const valor = Number(p.valor ?? 0);
      const desconto = Number((p as any).desconto_recorrente ?? 0);
      const valorFinal = Math.max(0, valor - desconto);

      // Trava de idempotência: já houve renovação automática para este aluno nas últimas 20h?
      const desde = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: recentes, error: recErr } = await supabase
        .from("vendas")
        .select("id")
        .eq("aluno_id", p.aluno_id)
        .eq("origem", "renovacao_automatica")
        .gte("created_at", desde)
        .limit(1);

      if (recErr) {
        console.error(`Erro ao checar renovações recentes do plano ${p.id}:`, recErr);
        erros.push({ plano_id: p.id, motivo: `Falha ao verificar duplicidade: ${recErr.message}` });
        continue;
      }

      if (recentes && recentes.length > 0) {
        erros.push({
          plano_id: p.id,
          motivo: "Renovação já processada nas últimas 20h — pulando para evitar duplicata",
        });
        continue;
      }

      // 1) Desativa o plano antigo ANTES de criar a venda
      const { error: deactErr } = await supabase
        .from("planos")
        .update({ ativo: false })
        .eq("id", p.id);

      if (deactErr) {
        console.error(`Erro ao desativar plano antigo ${p.id}:`, deactErr);
        erros.push({ plano_id: p.id, motivo: `Não desativado, venda não criada: ${deactErr.message}` });
        continue;
      }

      // 2) Só então cria a venda (que dispara plano+contrato+cobrança)
      const { data: vendaCriada, error: vErr } = await supabase.from("vendas").insert({
        aluno_id: p.aluno_id,
        tipo: "plano",
        catalogo_id: escolhido.id,
        nome_snapshot: `${p.tipo} (renovação automática)`,
        valor,
        desconto,
        valor_final: valorFinal,
        forma_pagamento: (p as any).forma_pagamento_padrao ?? null,
        parcelas: (p as any).parcelas_padrao ?? 1,
        status_pagamento: "pendente",
        data_venda: dataVenda,
        origem: "renovacao_automatica",
      }).select("plano_id").maybeSingle();

      if (vErr) {
        console.error(`Erro ao gerar venda do plano ${p.id}:`, vErr);
        erros.push({ plano_id: p.id, motivo: vErr.message });
        continue;
      }

      // Correção isolada p/ atividade='corrida': o gatilho fn_processar_venda cria o novo
      // plano sem proxima_renovacao e fn_planos_autorenew_defaults não cobre 'corrida'.
      if ((p as any).atividade === "corrida" && vendaCriada?.plano_id) {
        const base = new Date(`${dataVenda}T00:00:00Z`);
        const hoje = new Date(`${today}T00:00:00Z`);
        const prox = new Date(base);
        do {
          prox.setUTCMonth(prox.getUTCMonth() + 1);
        } while (prox <= hoje);

        const { error: upErr } = await supabase
          .from("planos")
          .update({
            proxima_renovacao: prox.toISOString().split("T")[0],
            renovacao_automatica: true,
          })
          .eq("id", vendaCriada.plano_id);

        if (upErr) {
          console.error(`Erro ao definir proxima_renovacao do plano ${vendaCriada.plano_id}:`, upErr);
          erros.push({ plano_id: p.id, motivo: `proxima_renovacao não definida: ${upErr.message}` });
        }
      }

      geradas++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        planos_processados: planos?.length ?? 0,
        vendas_geradas: geradas,
        erros,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("renovar-planos-mensais erro:", e);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
