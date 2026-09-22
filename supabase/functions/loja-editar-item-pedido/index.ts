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
    const itemId = String(body?.pedido_item_id ?? "").trim();
    const novaVarianteId = String(body?.nova_variante_id ?? "").trim();
    if (!UUID_RE.test(itemId) || !UUID_RE.test(novaVarianteId)) {
      return json(200, { ok: false, error: "parametros_invalidos" });
    }

    // ---------- item atual ----------
    const { data: item } = await admin
      .from("pedido_itens")
      .select("id, pedido_id, variante_id, quantidade, preco_unitario_snapshot")
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return json(200, { ok: false, error: "item_nao_encontrado" });
    if (item.variante_id === novaVarianteId) return json(200, { ok: false, error: "variante_igual_atual" });

    const { data: pedido } = await admin
      .from("pedidos")
      .select("id, status, desconto")
      .eq("id", item.pedido_id)
      .maybeSingle();
    if (!pedido) return json(200, { ok: false, error: "pedido_nao_encontrado" });
    if (pedido.status !== "pago") return json(200, { ok: false, error: "pedido_nao_pago" });

    const { data: varAtual } = await admin
      .from("produtos_variantes")
      .select("id, produto_id, tamanho, cor, preco, estoque_atual")
      .eq("id", item.variante_id)
      .maybeSingle();
    if (!varAtual) return json(200, { ok: false, error: "variante_atual_nao_encontrada" });

    const { data: varNova } = await admin
      .from("produtos_variantes")
      .select("id, produto_id, tamanho, cor, preco, estoque_atual, ativo")
      .eq("id", novaVarianteId)
      .maybeSingle();
    if (!varNova) return json(200, { ok: false, error: "variante_nova_nao_encontrada" });
    if (varNova.produto_id !== varAtual.produto_id) return json(200, { ok: false, error: "produto_diferente" });
    if (!varNova.ativo) return json(200, { ok: false, error: "variante_inativa" });

    const { data: produto } = await admin
      .from("produtos_catalogo")
      .select("id, nome, preco_base, permite_encomenda")
      .eq("id", varAtual.produto_id)
      .maybeSingle();

    const qtd = Number(item.quantidade ?? 1);

    // ---------- estoque: como a variante antiga foi tratada ----------
    const { data: movs } = await admin
      .from("estoque_movimentos")
      .select("id, tipo, quantidade, created_at")
      .eq("pedido_id", item.pedido_id)
      .eq("variante_id", item.variante_id)
      .in("tipo", ["reserva", "encomenda"])
      .order("created_at", { ascending: false })
      .limit(1);
    const movOriginal = movs?.[0] ?? null;
    const eraReserva = movOriginal?.tipo === "reserva";

    const estoqueNovo = Number(varNova.estoque_atual ?? 0);
    const temEstoque = estoqueNovo >= qtd;
    if (eraReserva && !temEstoque && !produto?.permite_encomenda) {
      return json(200, { ok: false, error: "sem_estoque_e_sem_encomenda" });
    }

    // ---------- troca da variante ----------
    const precoNovo =
      varNova.preco != null ? Number(varNova.preco) : Number(produto?.preco_base ?? item.preco_unitario_snapshot);
    const precoMudou = Number(item.preco_unitario_snapshot) !== precoNovo;

    const { error: updErr } = await admin
      .from("pedido_itens")
      .update({
        variante_id: novaVarianteId,
        ...(precoMudou ? { preco_unitario_snapshot: precoNovo } : {}),
      })
      .eq("id", itemId);
    if (updErr) {
      console.error("[loja-editar-item-pedido] update item", updErr);
      return json(200, { ok: false, error: "falha_atualizar_item" });
    }

    // ---------- estoque ----------
    let movimentoNovo: string | null = null;
    if (eraReserva) {
      // devolve estoque na variante antiga
      await admin
        .from("produtos_variantes")
        .update({ estoque_atual: Number(varAtual.estoque_atual ?? 0) + qtd })
        .eq("id", varAtual.id);
      await admin.from("estoque_movimentos").insert({
        variante_id: varAtual.id,
        tipo: "cancelamento_reserva",
        quantidade: qtd,
        motivo: `Troca de variante no pedido ${item.pedido_id}`,
        pedido_id: item.pedido_id,
        created_by: user.id,
      });

      if (temEstoque) {
        await admin
          .from("produtos_variantes")
          .update({ estoque_atual: estoqueNovo - qtd })
          .eq("id", varNova.id);
        movimentoNovo = "reserva";
      } else {
        movimentoNovo = "encomenda";
      }
      await admin.from("estoque_movimentos").insert({
        variante_id: varNova.id,
        tipo: movimentoNovo,
        quantidade: qtd,
        motivo: `Troca de variante no pedido ${item.pedido_id}`,
        pedido_id: item.pedido_id,
        created_by: user.id,
      });
    }

    // ---------- recalcula valor do pedido ----------
    const { data: itens } = await admin
      .from("pedido_itens")
      .select("quantidade, preco_unitario_snapshot")
      .eq("pedido_id", item.pedido_id);
    const total = (itens ?? []).reduce(
      (s, i) => s + Number(i.preco_unitario_snapshot ?? 0) * Number(i.quantidade ?? 0),
      0,
    );
    const desconto = Number(pedido.desconto ?? 0);
    const valorFinal = Math.max(0, total - desconto);
    await admin
      .from("pedidos")
      .update({ valor_total: total, valor_final: valorFinal, updated_at: new Date().toISOString() })
      .eq("id", item.pedido_id);

    // ---------- log ----------
    await admin.from("system_logs").insert({
      modulo: "loja",
      acao: "editar_item_pedido",
      mensagem: `Item trocado: ${varAtual.tamanho ?? "-"}/${varAtual.cor ?? "-"} → ${varNova.tamanho ?? "-"}/${varNova.cor ?? "-"}`,
      user_id: user.id,
      payload: {
        pedido_id: item.pedido_id,
        pedido_item_id: itemId,
        produto_id: varAtual.produto_id,
        produto_nome: produto?.nome ?? null,
        variante_anterior: { id: varAtual.id, tamanho: varAtual.tamanho, cor: varAtual.cor },
        variante_nova: { id: varNova.id, tamanho: varNova.tamanho, cor: varNova.cor },
        preco_anterior: Number(item.preco_unitario_snapshot),
        preco_novo: precoNovo,
        preco_alterado: precoMudou,
        estoque_origem: movOriginal?.tipo ?? null,
        estoque_destino: movimentoNovo,
        valor_final_pedido: valorFinal,
      },
    });

    return json(200, {
      ok: true,
      preco_alterado: precoMudou,
      preco_novo: precoNovo,
      valor_final: valorFinal,
      estoque: { origem: movOriginal?.tipo ?? null, destino: movimentoNovo },
    });
  } catch (err) {
    console.error("loja-editar-item-pedido error:", err);
    return json(500, { ok: false, error: "erro_interno" });
  }
});
