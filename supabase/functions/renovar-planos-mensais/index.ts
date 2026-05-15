import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    const { data: planos, error } = await supabase
      .from("planos")
      .select("id, aluno_id, tipo, valor, proxima_renovacao, desconto_recorrente, forma_pagamento_padrao, parcelas_padrao")
      .eq("ativo", true)
      .eq("renovacao_automatica", true)
      .lte("proxima_renovacao", today);

    if (error) throw error;

    let geradas = 0;
    for (const p of planos || []) {
      let proxima = new Date((p.proxima_renovacao as string) + "T00:00:00");
      const todayDt = new Date(today + "T00:00:00");

      while (proxima <= todayDt) {
        const dataVenda = proxima.toISOString().split("T")[0];
        const valor = Number(p.valor ?? 0);
        const desconto = Number((p as any).desconto_recorrente ?? 0);
        const valorFinal = Math.max(0, valor - desconto);

        const { error: vErr } = await supabase.from("vendas").insert({
          aluno_id: p.aluno_id,
          tipo: "plano",
          catalogo_id: p.id,
          plano_id: p.id,
          nome_snapshot: `${p.tipo} (renovação automática)`,
          valor,
          desconto,
          valor_final: valorFinal,
          forma_pagamento: (p as any).forma_pagamento_padrao ?? null,
          parcelas: (p as any).parcelas_padrao ?? 1,
          status_pagamento: "pendente",
          data_venda: dataVenda,
          origem: "renovacao_automatica",
        });
        if (vErr) {
          console.error(`Erro ao gerar venda do plano ${p.id}:`, vErr);
          break;
        }
        geradas++;
        proxima = new Date(proxima);
        proxima.setMonth(proxima.getMonth() + 1);
      }

      await supabase
        .from("planos")
        .update({ proxima_renovacao: proxima.toISOString().split("T")[0] })
        .eq("id", p.id);
    }

    return new Response(
      JSON.stringify({ ok: true, planos_processados: planos?.length ?? 0, vendas_geradas: geradas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("renovar-planos-mensais erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
