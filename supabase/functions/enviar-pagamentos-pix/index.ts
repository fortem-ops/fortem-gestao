// Envia em lote pagamentos Pix (Banco Inter) para despesas escolhidas pelo Admin.
import { admin, corsHeaders, jsonResponse } from "../_shared/inter.ts";
import { enviarPix, exigirAdmin } from "../_shared/inter-pagamento.ts";

const UUID = /^[0-9a-f-]{36}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

function msgErro(data: any, raw: string, status: number) {
  if (data && typeof data === "object") {
    const v = data.violacoes?.map((x: any) => x.razao ?? x.propriedade).join("; ");
    return `HTTP ${status}: ${[data.title, data.detail, v].filter(Boolean).join(" — ") || raw.substring(0, 300)}`;
  }
  return `HTTP ${status}: ${String(raw).substring(0, 300)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const auth = await exigirAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  // Formato: { pagamentos: [{ despesa_id, data_pagamento: "YYYY-MM-DD" }] } (ou legado { despesa_ids })
  const datas = new Map<string, string | null>();
  if (Array.isArray(body?.pagamentos)) {
    for (const p of body.pagamentos) {
      if (typeof p?.despesa_id === "string" && UUID.test(p.despesa_id)) datas.set(p.despesa_id, typeof p.data_pagamento === "string" ? p.data_pagamento : null);
    }
  } else if (Array.isArray(body?.despesa_ids)) {
    for (const x of body.despesa_ids) if (typeof x === "string" && UUID.test(x)) datas.set(x, null);
  }
  const ids = [...datas.keys()];
  if (ids.length === 0 || ids.length > 100) return jsonResponse({ error: "informe de 1 a 100 despesas válidas" }, 400);
  const hj = hoje();

  const sup = admin();
  const detalhes: any[] = [];
  let enviados = 0, concluidos = 0, erros = 0, ignorados = 0;

  for (const id of ids) {
    const dataEsc = datas.get(id) ?? hj;
    if (!DATA.test(dataEsc) || isNaN(Date.parse(dataEsc)) || dataEsc < hj) {
      ignorados++;
      detalhes.push({ despesa_id: id, resultado: "ignorada", motivo: `data de pagamento inválida ou passada (${dataEsc})` });
      continue;
    }
    const { data: d } = await sup
      .from("despesas")
      .select("id, descricao, valor, valor_liquido_previsto, status, forma_pagamento, pix_status, fornecedor:fornecedores(nome, chave_pix)")
      .eq("id", id).maybeSingle();
    const chave = (d as any)?.fornecedor?.chave_pix?.trim();
    const valor = Number(d?.valor_liquido_previsto ?? d?.valor ?? 0);
    if (!d || d.status !== "pendente" || String(d.forma_pagamento).toUpperCase() !== "PIX" || !chave || !(valor > 0)
        || (d.pix_status && !["ERRO", "REJEITADO"].includes(d.pix_status))) {
      ignorados++;
      detalhes.push({ despesa_id: id, resultado: "ignorada", motivo: !d ? "não encontrada" : !chave ? "sem chave Pix" : d.pix_status ? `já em ${d.pix_status}` : "não elegível" });
      continue;
    }
    // Trava atômica contra envio duplicado
    const { data: trava } = await sup.from("despesas")
      .update({ pix_status: "AGUARDANDO_ENVIO", pix_erro: null })
      .eq("id", id).eq("status", "pendente")
      .or("pix_status.is.null,pix_status.in.(ERRO,REJEITADO)")
      .select("id");
    if (!trava?.length) { ignorados++; detalhes.push({ despesa_id: id, resultado: "ignorada", motivo: "alterada em paralelo" }); continue; }

    try {
      const r = await enviarPix(valor, chave, d.descricao ?? "Pagamento Fortem", crypto.randomUUID(), dataEsc);
      console.log("[enviar-pagamentos-pix]", id, r.status, r.raw.substring(0, 500));
      if (r.status === 200 && r.data?.codigoSolicitacao) {
        const direto = r.data.tipoRetorno && r.data.tipoRetorno !== "APROVACAO";
        const upd: Record<string, unknown> = { pix_codigo_solicitacao: r.data.codigoSolicitacao, pix_erro: null, pix_data_agendada: r.data.dataPagamento ?? dataEsc };
        if (direto) {
          Object.assign(upd, { pix_status: "CONCLUIDO", status: "pago", data_pagamento: r.data.dataPagamento ?? dataEsc, valor_pago: valor, conciliado: true });
          concluidos++;
        } else {
          upd.pix_status = "AGUARDANDO_APROVACAO";
        }
        await sup.from("despesas").update(upd).eq("id", id);
        enviados++;
        detalhes.push({ despesa_id: id, resultado: upd.pix_status, codigo: r.data.codigoSolicitacao, data_pagamento: r.data.dataPagamento ?? dataEsc, tipoRetorno: r.data.tipoRetorno });
      } else {
        const m = msgErro(r.data, r.raw, r.status);
        await sup.from("despesas").update({ pix_status: "ERRO", pix_erro: m }).eq("id", id);
        erros++;
        detalhes.push({ despesa_id: id, resultado: "ERRO", erro: m });
      }
    } catch (e) {
      const m = String((e as Error)?.message ?? e).substring(0, 500);
      await sup.from("despesas").update({ pix_status: "ERRO", pix_erro: m }).eq("id", id);
      erros++;
      detalhes.push({ despesa_id: id, resultado: "ERRO", erro: m });
    }
  }
  return jsonResponse({ enviados, concluidos, erros, ignorados, detalhes });
});
