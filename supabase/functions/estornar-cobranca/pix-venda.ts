// Devolução Pix de venda avulsa do portal (origem portal_avulso), sem cobrança/contrato.
// Reaproveita devolverPixSite (mesma ordem e travas); reserva/resultado em estornos_pix_venda.
import { interCobFetch } from "../_shared/inter-cob.ts";
import { devolverPixSite } from "./pix-site.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
export async function devolverPixVenda(supabase: any, userId: string, body: any, headers: HeadersInit,
  erro: (m: string, s?: number, e?: Record<string, unknown>) => Response): Promise<Response> {
  const vendaId = String(body.venda_id ?? "").trim();
  if (!UUID_RE.test(vendaId)) return erro("Venda inválida");

  // Consulta de devolução em conferência: pergunta ao Inter e registra o resultado.
  if (body.acao === "consultar") {
    const { data: e } = await supabase.from("estornos_pix_venda").select("*")
      .eq("venda_id", vendaId).in("status", ["reservado", "desconhecido"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!e) return erro("Não há devolução em conferência para esta venda", 404);
    if (!e.e2e_id) {
      await supabase.rpc("fn_estorno_pix_venda_resultado", {
        _estorno_id: e.id, _status: "recusado", _e2e: null, _retorno: { motivo: "sem_e2e_consulta" }, _motivo: e.motivo, _user_id: userId,
      });
      return erro("A devolução não chegou ao banco. Pode tentar de novo.", 422);
    }
    const c = await interCobFetch(`/pix/v2/pix/${e.e2e_id}/devolucao/${e.devolucao_id}`, { method: "GET" });
    const st = String(c.data?.status ?? "");
    if (c.status === 404 || st === "NAO_REALIZADO") {
      await supabase.rpc("fn_estorno_pix_venda_resultado", {
        _estorno_id: e.id, _status: "recusado", _e2e: e.e2e_id, _retorno: { consulta: c.status, status: st }, _motivo: e.motivo, _user_id: userId,
      });
      return erro("O banco não fez a devolução. Pode tentar de novo.", 422);
    }
    if (st === "DEVOLVIDO") {
      const { data: r } = await supabase.rpc("fn_estorno_pix_venda_resultado", {
        _estorno_id: e.id, _status: "devolvido", _e2e: e.e2e_id, _retorno: { consulta: c.status, status: st }, _motivo: e.motivo, _user_id: userId,
      });
      return new Response(JSON.stringify({ success: true, ...(r ?? {}) }), { status: 200, headers });
    }
    return erro(`Devolução ainda em processamento no banco (${st || "sem status"}). Consulte mais tarde.`, 409);
  }

  const idempotencyKey = String(body.idempotency_key ?? "").trim();
  const motivo = String(body.motivo ?? "").trim();
  if (!UUID_RE.test(idempotencyKey)) return erro("Chave de idempotência inválida");
  if (motivo.length < 10) return erro("Informe o motivo da devolução (mínimo 10 caracteres)");

  let final: Record<string, unknown> = {};
  const r = await devolverPixSite({
    reservar: async () => {
      const { data, error } = await supabase.rpc("fn_estorno_pix_venda_reservar", {
        _venda_id: vendaId, _idempotency_key: idempotencyKey, _user_id: userId,
      });
      if (error) return { ok: false, erro: "Não foi possível iniciar a devolução" };
      return data;
    },
    consultarE2e: async (txid) => {
      const c = await interCobFetch(`/pix/v2/cob/${txid}`, { method: "GET" });
      return c.data?.pix?.[0]?.endToEndId ?? null;
    },
    devolver: (e2e, devId, valor) =>
      interCobFetch(`/pix/v2/pix/${e2e}/devolucao/${devId}`, { method: "PUT", json: { valor } }),
    resultado: async (id, st, e2e, retorno) => {
      const { data } = await supabase.rpc("fn_estorno_pix_venda_resultado", {
        _estorno_id: id, _status: st, _e2e: e2e, _retorno: retorno ?? {}, _motivo: motivo, _user_id: userId,
      });
      final = data ?? {};
    },
  });
  if (!r.ok) return erro(r.erro, r.http, { duplicado: r.duplicado === true, em_conferencia: r.http === 502 });
  return new Response(JSON.stringify({
    success: true, valor_estornado: r.valor, e2e: r.e2e, devolucao_id: r.devolucao_id,
    credito_usado: final.credito_usado ?? null, credito_retirado: final.credito_retirado ?? null,
  }), { status: 200, headers });
}
