import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";
import { extrairEventos, statusRec, statusCobr, podeAtualizarRec, mascararCpf } from "./eventos.ts";
import { processarPagamentoAprovadoCorrida } from "../_shared/corrida-pagamento-aprovado.ts";
import { ehCobrancaPlanos, baixarPixProposta } from "./planos-baixa.ts";


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

function tokenIgual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

// Exige ?token=<PIX_WEBHOOK_SECRET> na URL cadastrada no Inter. Sem token válido: 401, nada é processado.
async function autorizarWebhook(req: Request): Promise<Response | null> {
  const esperado = Deno.env.get("PIX_WEBHOOK_SECRET") ?? "";
  const recebido = new URL(req.url).searchParams.get("token") ?? "";
  if (esperado.length >= 16 && recebido.length > 0 && tokenIgual(recebido, esperado)) return null;
  try {
    await admin().from("system_logs").insert({
      modulo: "pix-webhook",
      acao: "requisicao_rejeitada",
      mensagem: !esperado ? "PIX_WEBHOOK_SECRET não configurado" : recebido ? "Token inválido" : "Token ausente",
      payload: { metodo: req.method, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null },
    });
  } catch (e) {
    console.error("pix-webhook: falha ao registrar rejeição", String(e));
  }
  return jsonResponse({ error: "Unauthorized" }, 401);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const negado = await autorizarWebhook(req);
  if (negado) return negado;
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
        .select("id, pedido_id, corrida_venda_id, proposta_id")
        .eq("txid", txid)
        .maybeSingle();
      if (!cob) {
        console.log("pix-webhook: txid não encontrado em pix_cobrancas", txid);
        continue;
      }
      // --- Planos do site (/planos): caminho isolado em planos-baixa.ts ---
      if (ehCobrancaPlanos(cob)) {
        await baixarPixProposta(sup, txid, ev);
        pixTratados.add(txid);
        continue;
      }
      // --- Corrida (Pix à vista): caminho isolado, não interfere na Loja ---
      if (!cob.pedido_id && cob.corrida_venda_id) {
        await sup.from("pix_cobrancas")
          .update({
            status: "LIQUIDADA",
            liquidado_em: new Date().toISOString(),
            raw_response: ev,
          })
          .eq("id", cob.id);
        try {
          const { data: vendaCorrida } = await sup
            .from("vendas")
            .select("id, aluno_id, plano_id")
            .eq("id", cob.corrida_venda_id)
            .maybeSingle();
          await sup.from("vendas")
            .update({ status_pagamento: "pago" })
            .eq("id", cob.corrida_venda_id);
          const { data: contratoCorrida } = vendaCorrida?.plano_id
            ? await sup.from("contratos").select("id").eq("plano_id", vendaCorrida.plano_id)
              .order("created_at", { ascending: false }).limit(1).maybeSingle()
            : { data: null };
          await processarPagamentoAprovadoCorrida(sup, {
            vendaId: cob.corrida_venda_id,
            contratoId: contratoCorrida?.id ?? null,
            alunoId: vendaCorrida?.aluno_id ?? null,
            modulo: "pix-webhook",
          });
        } catch (e) {
          console.error("pix-webhook: falha ao processar pagamento aprovado da Corrida", String(e));
        }
        pixTratados.add(txid);
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

    // Avisos de Pix Automático. Listas aceitas: rec|recs e cobr|cobrs|cobsr (ver eventos.ts).
    const eventos = extrairEventos(payload, pixRecebidos.filter((p: any) => !p?.txid || !pixTratados.has(p.txid)));
    const naoReconhecido = (motivo: string, origem: string, ev: unknown) =>
      sup.from("system_logs").insert({ modulo: "pix-webhook", acao: "aviso_nao_reconhecido", mensagem: `${origem}: ${motivo}`, payload: mascararCpf(ev) });

    for (const { origem, ev } of eventos) {
      const txid: string | undefined = ev?.txid;

      // --- Recorrências ---
      if (origem === "rec") {
        const idRec: string | undefined = ev?.idRec;
        const novo = statusRec(ev);
        if (!idRec || !novo) { await naoReconhecido(!idRec ? "sem idRec" : `status ${ev?.status ?? ev?.tipo}`, origem, ev); continue; }
        const { data: rec } = await sup.from("pix_recorrencias").select("status").eq("id_rec", idRec).maybeSingle();
        if (!rec) { await naoReconhecido("idRec não encontrado", origem, ev); continue; }
        if (podeAtualizarRec(rec.status, novo)) {
          await sup.from("pix_recorrencias").update({ status: novo }).eq("id_rec", idRec);
          await sup.from("system_logs").insert({ modulo: "pix-webhook", acao: "recorrencia_status", mensagem: `${idRec}: ${rec.status} -> ${novo}`, payload: { idRec, antes: rec.status, depois: novo, statusInter: ev?.status ?? null } });
        }
        continue;
      }

      // --- Cobranças (Pix Automático); itens "pix" sem status seguem sem ação, como antes ---
      const st = statusCobr(ev);
      if (!st) { if (origem === "cobr") await naoReconhecido(`status ${ev?.status ?? ev?.tipo}`, origem, ev); continue; }
      if (!txid) { await naoReconhecido("sem txid", origem, ev); continue; }
      const { data: cob } = await sup
        .from("pix_cobrancas")
        .select("id, aluno_id, valor, id_rec, pagamento_id, corrida_venda_id, status")
        .eq("txid", txid)
        .maybeSingle();
      if (!cob) { await naoReconhecido("txid não encontrado", origem, ev); continue; }
      if (cob.status === st) continue; // idempotente
      if (cob.status === "LIQUIDADA") { await naoReconhecido(`já LIQUIDADA, recebido ${st}`, origem, ev); continue; }

      if (st === "LIQUIDADA") {
        let pagamentoId = cob.pagamento_id ?? null;
        if (!pagamentoId) {
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
          .update({ status: "LIQUIDADA", liquidado_em: new Date().toISOString(), pagamento_id: pagamentoId, raw_response: ev })
          .eq("id", cob.id);
        const { data: aluno } = await sup.from("alunos").select("nome").eq("id", cob.aluno_id).maybeSingle();
        await notifyAdmins({
          titulo: `Pix recebido — ${aluno?.nome ?? "Aluno"}`,
          descricao: `Cobrança ${txid} liquidada no valor de ${brl(cob.valor)}.`,
          aluno_id: cob.aluno_id,
          prioridade: "media",
        });

        // --- Corrida (Pix à vista): adição isolada, não afeta o caminho da Loja ---
        if (cob.corrida_venda_id) {
          try {
            const { data: vendaCorrida } = await sup
              .from("vendas")
              .select("id, aluno_id, plano_id")
              .eq("id", cob.corrida_venda_id)
              .maybeSingle();
            await sup.from("vendas")
              .update({ status_pagamento: "pago" })
              .eq("id", cob.corrida_venda_id);
            const { data: contratoCorrida } = vendaCorrida?.plano_id
              ? await sup.from("contratos").select("id").eq("plano_id", vendaCorrida.plano_id)
                .order("created_at", { ascending: false }).limit(1).maybeSingle()
              : { data: null };
            await processarPagamentoAprovadoCorrida(sup, {
              vendaId: cob.corrida_venda_id,
              contratoId: contratoCorrida?.id ?? null,
              alunoId: vendaCorrida?.aluno_id ?? null,
              modulo: "pix-webhook",
            });
          } catch (e) {
            console.error("pix-webhook: falha ao processar pagamento aprovado da Corrida", String(e));
          }
        }
        continue;
      }

      if (st === "REJEITADA") {
        const motivo: string = ev?.motivo ?? ev?.descricaoMotivo ?? "Rejeitada pelo banco";
        await sup.from("pix_cobrancas")
          .update({ status: "REJEITADA", motivo_rejeicao: motivo, raw_response: ev })
          .eq("id", cob.id);
        const { data: aluno } = await sup.from("alunos").select("nome").eq("id", cob.aluno_id).maybeSingle();
        await notifyAdmins({
          titulo: `Pix rejeitado — ${aluno?.nome ?? "Aluno"}`,
          descricao: `Cobrança ${txid} (${brl(cob.valor)}) foi rejeitada. Motivo: ${motivo}.`,
          aluno_id: cob.aluno_id,
          prioridade: "alta",
        });
        continue;
      }

      // AGENDADA / CANCELADA / EXPIRADA
      await sup.from("pix_cobrancas").update({ status: st, raw_response: ev }).eq("id", cob.id);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("pix-webhook error", e);
    // Sempre 200 para o Inter não reenviar em looping; logamos o erro.
    return jsonResponse({ ok: false, error: String(e?.message ?? e) });
  }
});
