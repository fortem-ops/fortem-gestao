// Consulta no Inter os Pix aguardando aprovação e dá baixa/rejeita conforme o status.
// Chamável por Admin autenticado ou pelo agendamento interno (chave de serviço).
// Só lê o Inter — nunca envia pagamento.
import { admin, corsHeaders, jsonResponse } from "../_shared/inter.ts";
import { consultarPix, exigirAdmin } from "../_shared/inter-pagamento.ts";

const CONCLUIDO = new Set(["PAGO", "EFETIVADO", "REALIZADO", "CONCLUIDO", "PROCESSADO", "LIQUIDADO", "DEBITADO"]);
const REJEITADO = new Set(["CANCELADO", "REPROVADO", "REJEITADO", "EXPIRADO", "FALHA", "ERRO", "DEVOLVIDO", "NAO_APROVADO", "RECUSADO"]);
const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!service || bearer !== service) {
    const auth = await exigirAdmin(req);
    if ("error" in auth) return auth.error;
  }

  const sup = admin();
  const { data: pend } = await sup.from("despesas")
    .select("id, valor, valor_liquido_previsto, pix_codigo_solicitacao, pix_data_agendada")
    .eq("pix_status", "AGUARDANDO_APROVACAO")
    .not("pix_codigo_solicitacao", "is", null)
    .limit(200);

  const detalhes: any[] = [];
  let concluidos = 0, rejeitados = 0, aguardando = 0, erros = 0;
  for (const d of pend ?? []) {
    try {
      const r = await consultarPix(d.pix_codigo_solicitacao!);
      const st = String(r.data?.transacaoPix?.status ?? "").toUpperCase();
      if (r.status !== 200 || !st) {
        erros++; detalhes.push({ despesa_id: d.id, erro: `HTTP ${r.status}`, corpo: r.raw.substring(0, 300) }); continue;
      }
      if (CONCLUIDO.has(st)) {
        const hist: any[] = r.data?.historico ?? [];
        const ult = hist[hist.length - 1]?.dataHoraEvento;
        // Data confirmada pelo Inter: dataPagamento da transação > último evento do histórico > data agendada > hoje
        const tx = r.data?.transacaoPix ?? {};
        const confirmada = [tx.dataPagamento, r.data?.dataPagamento, tx.dataHoraMovimento]
          .find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));
        const data = confirmada ? String(confirmada).slice(0, 10)
          : ult ? new Date(new Date(ult).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
          : (d as any).pix_data_agendada ?? hoje();
        await sup.from("despesas").update({
          status: "pago", pix_status: "CONCLUIDO", data_pagamento: data,
          valor_pago: Number(r.data?.transacaoPix?.valor ?? d.valor_liquido_previsto ?? d.valor), conciliado: true, pix_erro: null,
        }).eq("id", d.id).eq("pix_status", "AGUARDANDO_APROVACAO");
        concluidos++;
      } else if (REJEITADO.has(st)) {
        await sup.from("despesas").update({ pix_status: "REJEITADO", pix_erro: `Inter: ${st}` })
          .eq("id", d.id).eq("pix_status", "AGUARDANDO_APROVACAO");
        rejeitados++;
      } else {
        aguardando++;
      }
      detalhes.push({ despesa_id: d.id, status_inter: st });
    } catch (e) {
      erros++; detalhes.push({ despesa_id: d.id, erro: String((e as Error)?.message ?? e) });
    }
  }
  return jsonResponse({ verificados: pend?.length ?? 0, concluidos, rejeitados, aguardando, erros, detalhes });
});
