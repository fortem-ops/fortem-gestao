// Ligações reais (banco + Rede) do fluxo do cartão. Só usadas quando fn_checkout_2027_cartao_real = true.
import { aplicarConsultaToken } from "../_shared/planos-cartao-token.ts";
import { cobrar, consultarPorReferencia, consultarToken, tokenizar, type Acesso } from "./cartao-rede.ts";
import type { Deps, TentativaCartao } from "./fluxo-cartao.ts";

const COLS = "id, proposta_id, status, motivo, valor_centavos, parcelas, simulado, tokenizacao_id, consultado_em, created_at, updated_at";

export function depsReais(admin: any, acesso: Acesso, softDescriptor: string): Deps {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw new Error("falha " + fn);
    return data;
  };
  return {
    softDescriptor,
    rede: {
      tokenizar: (d) => tokenizar(acesso, d),
      consultarToken: (id) => consultarToken(acesso, id),
      cobrar: (i) => cobrar(acesso, i),
      consultarPorReferencia: (ref) => consultarPorReferencia(acesso, ref),
    },
    db: {
      tentativa: async (id) => {
        const { data } = await admin.from("checkout_2027_tentativas").select(COLS).eq("id", id).maybeSingle();
        return (data ?? null) as TentativaCartao | null;
      },
      registrarToken: async (t, tokenizationId) => {
        // Sem nome do titular, sem raw: só o id do token, a proposta e o status.
        const { data, error } = await admin.from("rede_tokenizacoes")
          .insert({ tokenization_id: tokenizationId, proposta_id: t.proposta_id, aluno_id: null, origem: "planos_site", status: "pending" })
          .select("id").single();
        if (error || !data) return false;
        await admin.from("checkout_2027_tentativas").update({ tokenizacao_id: data.id }).eq("id", t.id);
        return true;
      },
      token: async (id) => {
        const { data } = await admin.from("rede_tokenizacoes")
          .select("tokenization_id, status, token_code, token_expiration").eq("id", id).not("proposta_id", "is", null).is("aluno_id", null).maybeSingle();
        return data ?? null;
      },
      aplicarConsulta: async (tokId, consulta) => { await aplicarConsultaToken(admin, tokId, consulta); },
      // Não mexe em updated_at: os prazos de "cobrando" contam a partir da trava.
      marcar: async (id, campos) => { await admin.from("checkout_2027_tentativas").update(campos).eq("id", id); },
      travarCobranca: async (id) => {
        const { data } = await admin.from("checkout_2027_tentativas")
          .update({ motivo: "cobrando", updated_at: new Date().toISOString() })
          .eq("id", id).eq("status", "processando").neq("motivo", "cobrando").select("id");
        return (data ?? []).length === 1;
      },
      resultado: async (id, status, motivo) => { await rpc("fn_checkout_2027_cartao_resultado", { p_tentativa_id: id, p_status: status, p_motivo: motivo }); },
      liquidar: async (id, a) => {
        await rpc("fn_checkout_2027_cartao_liquidado", {
          p_tentativa_id: id, p_tid: a.tid, p_nsu: a.nsu, p_autorizacao: a.autorizacao, p_return_code: a.returnCode,
          p_valor_centavos: a.centavos, p_parcelas: a.parcelas, p_raw: a.raw,
        });
      },
    },
  };
}
