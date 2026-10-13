// Baixa do Pix à vista do /planos (cobrança com proposta_id, sem pedido e sem corrida).
// Só grava no banco: nunca chama Inter/Rede e nunca cria venda/pagamento financeiro.
import { mascararCpf } from "./eventos.ts";

export type CobPix = { id: string; pedido_id?: string | null; corrida_venda_id?: string | null; proposta_id?: string | null };

export function ehCobrancaPlanos(cob: CobPix | null | undefined): boolean {
  return !!cob && !cob.pedido_id && !cob.corrida_venda_id && !!cob.proposta_id;
}

export function valorEmCentavos(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

type Sup = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>; from: (t: string) => any;
  functions?: { invoke: (n: string, o: { body: unknown }) => Promise<unknown> };
};

export async function baixarPixProposta(sup: Sup, txid: string, ev: any): Promise<string> {
  try {
    const { data, error } = await sup.rpc("fn_checkout_2027_pix_liquidado", {
      p_txid: txid, p_valor_centavos: valorEmCentavos(ev?.valor), p_e2e: ev?.endToEndId ?? null, p_raw: mascararCpf(ev),
    });
    if (error) throw new Error(error.message);
    const r = String(data?.resultado ?? "erro");
    if (r !== "baixado" && r !== "ja_processado") {
      await sup.from("system_logs").insert({ modulo: "pix-webhook", acao: "planos_baixa_erro", mensagem: `${txid}: ${r}`, payload: mascararCpf({ resultado: data, ev }) });
    }
    if ((r === "baixado" || r === "ja_processado") && data?.proposta_id && sup.functions) {
      // E-mail de confirmação: idempotente no banco; falha não afeta a baixa.
      try { await sup.functions.invoke("planos-confirmacao", { body: { proposta_id: data.proposta_id } }); } catch { /* registrado lá */ }
    }
    return r;
  } catch (e) {
    await sup.from("system_logs").insert({ modulo: "pix-webhook", acao: "planos_baixa_erro", mensagem: `${txid}: ${String((e as Error)?.message ?? e).slice(0, 200)}`, payload: mascararCpf(ev) });
    return "erro";
  }
}
