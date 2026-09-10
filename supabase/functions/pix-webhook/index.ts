import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";

async function notifyAdmins(params: {
  titulo: string;
  descricao: string;
  aluno_id: string | null;
  prioridade: "alta" | "media";
}) {
  const sup = admin();
  const { data: admins } = await sup
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (!admins?.length) return;

  const { data: notif, error: notifErr } = await sup
    .from("notificacoes")
    .insert({
      titulo: params.titulo,
      descricao: params.descricao,
      categoria: "financeiro",
      tipo: "simples",
      prioridade: params.prioridade,
      status: "nao_visualizada",
      aluno_id: params.aluno_id,
    })
    .select("id")
    .single();
  if (notifErr || !notif) {
    console.error("notify insert error", notifErr);
    return;
  }
  const rows = admins.map((a: any) => ({
    notificacao_id: notif.id,
    usuario_id: a.user_id,
  }));
  await sup.from("notificacao_destinatarios").insert(rows);
}

function brl(v: number | string | null | undefined) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: true });

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("pix-webhook payload", JSON.stringify(payload));
    const sup = admin();

    // --- Pix recebido (formato Bacen): a presença no array já significa pago ---
    const pixRecebidos: any[] = Array.isArray(payload?.pix) ? payload.pix : [];
    const pixTratados = new Set<string>();
    for (const ev of pixRecebidos) {
      const txid: string | undefined = ev?.txid;
      if (!txid) continue;
      const { data: cob } = await sup
        .from("pix_cobrancas")
        .select("id, pedido_id")
        .eq("txid", txid)
        .maybeSingle();
      if (!cob) {
        console.log("pix-webhook: txid não encontrado em pix_cobrancas", txid);
        continue;
      }
      if (!cob.pedido_id) continue; // mensalidade: segue no fluxo genérico abaixo
      await sup.from("pix_cobrancas")
        .update({
          status: "LIQUIDADA",
          liquidado_em: new Date().toISOString(),
          raw_response: ev,
        })
        .eq("id", cob.id);
      await sup.from("pedidos")
        .update({ status: "pago", forma_pagamento: "pix" })
        .eq("id", cob.pedido_id);
      try {
        await sup.rpc("fn_loja_vincular_aluno", { p_pedido_id: cob.pedido_id });
      } catch (e) {
        console.error("pix-webhook: falha ao vincular aluno", String(e));
      }
      try {
        await sup.functions.invoke("loja-enviar-confirmacao-email", {
          body: { pedido_id: cob.pedido_id },
        });
      } catch (e) {
        console.error("pix-webhook: falha ao enviar e-mail do pedido", String(e));
      }
      pixTratados.add(txid);
      console.log("pix-webhook: pedido da loja pago", cob.pedido_id, txid);
    }

    // O Inter envia listas como { rec: [...] } / { cobr: [...] } ou eventos avulsos.
    const eventos: any[] = []
      .concat(payload?.rec ?? [])
      .concat(payload?.cobr ?? [])
      .concat(pixRecebidos.filter((p: any) => !p?.txid || !pixTratados.has(p.txid)));
    if (eventos.length === 0 && payload?.tipo) eventos.push(payload);


    for (const ev of eventos) {
      const tipo: string = ev?.tipo ?? ev?.evento ?? "";
      const idRec: string | undefined = ev?.idRec;
      const txid: string | undefined = ev?.txid;

      // --- Recorrências ---
      if (tipo === "REC_AUTORIZADA" || ev?.status === "AUTORIZADA") {
        if (idRec) {
          await sup.from("pix_recorrencias")
            .update({ status: "AUTORIZADA" })
            .eq("id_rec", idRec);
        }
        continue;
      }
      if (tipo === "REC_CANCELADA" || ev?.status === "CANCELADA") {
        if (idRec) {
          await sup.from("pix_recorrencias")
            .update({ status: "CANCELADA" })
            .eq("id_rec", idRec);
        }
        continue;
      }
      if (tipo === "REC_REJEITADA" || ev?.status === "REJEITADA") {
        if (idRec) {
          await sup.from("pix_recorrencias")
            .update({ status: "REJEITADA" })
            .eq("id_rec", idRec);
        }
        continue;
      }

      // --- Cobranças ---
      if (!txid) continue;
      const { data: cob } = await sup
        .from("pix_cobrancas")
        .select("id, aluno_id, valor, id_rec, pagamento_id")
        .eq("txid", txid)
        .maybeSingle();

      if (tipo === "COBR_LIQUIDADA" || ev?.status === "LIQUIDADA") {
        let pagamentoId = cob?.pagamento_id ?? null;
        if (cob && !pagamentoId) {
          const { data: pag } = await sup
            .from("pagamentos")
            .insert({
              aluno_id: cob.aluno_id,
              valor_total: cob.valor,
              forma_pagamento: "pix_automatico",
              parcelas_qtd: 1,
              status: "pago",
              observacoes: `Pix Automático Inter — txid ${txid}`,
            })
            .select("id")
            .single();
          pagamentoId = pag?.id ?? null;
        }
        await sup.from("pix_cobrancas")
          .update({
            status: "LIQUIDADA",
            liquidado_em: new Date().toISOString(),
            pagamento_id: pagamentoId,
            raw_response: ev,
          })
          .eq("txid", txid);

        if (cob) {
          const { data: aluno } = await sup
            .from("alunos").select("nome").eq("id", cob.aluno_id).maybeSingle();
          await notifyAdmins({
            titulo: `Pix recebido — ${aluno?.nome ?? "Aluno"}`,
            descricao: `Cobrança ${txid} liquidada no valor de ${brl(cob.valor)}.`,
            aluno_id: cob.aluno_id,
            prioridade: "media",
          });
        }
        continue;
      }

      if (tipo === "COBR_REJEITADA" || ev?.status === "REJEITADA") {
        const motivo: string = ev?.motivo ?? ev?.descricaoMotivo ?? "Rejeitada pelo banco";
        await sup.from("pix_cobrancas")
          .update({ status: "REJEITADA", motivo_rejeicao: motivo, raw_response: ev })
          .eq("txid", txid);
        if (cob) {
          const { data: aluno } = await sup
            .from("alunos").select("nome").eq("id", cob.aluno_id).maybeSingle();
          await notifyAdmins({
            titulo: `Pix rejeitado — ${aluno?.nome ?? "Aluno"}`,
            descricao: `Cobrança ${txid} (${brl(cob.valor)}) foi rejeitada. Motivo: ${motivo}.`,
            aluno_id: cob.aluno_id,
            prioridade: "alta",
          });
        }
        continue;
      }

      if (tipo === "COBR_AGENDADA" || ev?.status === "AGENDADA") {
        await sup.from("pix_cobrancas")
          .update({ status: "AGENDADA", raw_response: ev })
          .eq("txid", txid);
        continue;
      }

      if (tipo === "COBR_CANCELADA" || ev?.status === "CANCELADA") {
        await sup.from("pix_cobrancas")
          .update({ status: "CANCELADA", raw_response: ev })
          .eq("txid", txid);
        continue;
      }
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("pix-webhook error", e);
    // Sempre 200 para o Inter não reenviar em looping; logamos o erro.
    return jsonResponse({ ok: false, error: String(e?.message ?? e) });
  }
});
