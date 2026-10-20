// Exclusivo de vendas manuais; checkout público e rotinas automáticas não importam este módulo.
export interface ReservaManual {
  handled: boolean;
  nova?: boolean;
  success?: boolean;
  em_processamento?: boolean;
  idempotente?: boolean;
  pagamento_id?: string;
  cobranca_id?: string;
  valor_centavos?: number;
  tid?: string;
}

export async function reservarPrimeiroCiclo(db: any, vendaId: string, chave: string, kind: string, cartaoId: string | null = null, alunoId: string | null = null): Promise<ReservaManual> {
  const { data, error } = await db.rpc("fn_manual_primeiro_ciclo_reservar", {
    p_venda_id: vendaId, p_chave: chave, p_kind: kind, p_cartao_id: cartaoId, p_aluno_id: alunoId,
  });
  if (error) throw new Error(error.message);
  return data as ReservaManual;
}

export async function liquidarPrimeiroCiclo(db: any, vendaId: string, reserva: ReservaManual, resultado: any) {
  if (!reserva.pagamento_id) throw new Error("Reserva sem pagamento");
  const { data, error } = await db.rpc("fn_manual_primeiro_ciclo_liquidar", {
    p_venda_id: vendaId, p_pagamento_id: reserva.pagamento_id,
    p_resultado: {
      tid: resultado.tid, nsu: resultado.nsu,
      authorization_code: resultado.authorizationCode ?? resultado.authorization_code,
      return_code: resultado.returnCode, return_message: resultado.returnMessage,
      raw_response: resultado.raw,
    },
  });
  if (error) throw new Error("Pagamento aprovado; conciliação pendente. Não recobrar. " + error.message);
  return data;
}

export async function executarPrimeiroCiclo(db: any, vendaId: string, chave: string, kind: string, cartaoId: string | null, alunoId: string | null, cobrar: (centavos: number) => Promise<any>) {
  const reserva = await reservarPrimeiroCiclo(db, vendaId, chave, kind, cartaoId, alunoId);
  if (!reserva.handled || !reserva.nova) return reserva;
  if (!reserva.valor_centavos) throw new Error("Valor da reserva inválido");
  let resultado: any;
  try {
    resultado = await cobrar(reserva.valor_centavos);
    if (resultado.approved && resultado.returnCode === "00") return await liquidarPrimeiroCiclo(db, vendaId, reserva, resultado);
  } catch (e) {
    // A reserva continua pendente: nunca tenta novamente uma captura sem confirmação.
    await db.from("system_logs").insert({ modulo: "cobrancas", acao: "manual_primeiro_ciclo_pendente",
      mensagem: "Reserva mantida; conferir resultado antes de qualquer nova cobrança",
      payload: { venda_id: vendaId, pagamento_id: reserva.pagamento_id, cobranca_id: reserva.cobranca_id,
        tid: resultado?.tid ?? null, nsu: resultado?.nsu ?? null, aprovado: resultado?.approved === true } });
    throw e;
  }
  // Resultado incerto permanece reservado, nunca autoriza nova chamada.
  if (resultado.stage === "cryptogram") {
    await db.from("pagamentos_rede").delete().eq("id", reserva.pagamento_id).eq("status", "pending");
  } else if (!resultado.errorKind && resultado.httpStatus < 500 && resultado.returnCode) {
    await db.from("pagamentos_rede").update({ status: "denied", return_code: resultado.returnCode, return_message: resultado.returnMessage, tid: resultado.tid, nsu: resultado.nsu }).eq("id", reserva.pagamento_id);
  }
  await db.from("system_logs").insert({ modulo: "cobrancas", acao: "manual_primeiro_ciclo_nao_confirmado",
    mensagem: "Primeiro ciclo sem confirmação de pagamento; nenhuma repetição automática",
    payload: { venda_id: vendaId, pagamento_id: reserva.pagamento_id, cobranca_id: reserva.cobranca_id,
      etapa: resultado.stage, http_status: resultado.httpStatus, return_code: resultado.returnCode } });
  return { ...reserva, nova: false, success: false, error: "Pagamento não confirmado; confira o resultado antes de tentar novamente." };
}