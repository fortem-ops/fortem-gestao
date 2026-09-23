// ─────────────────────────────────────────────────────────────
// Decisões puras da "reserva antes de cobrar" em rede-cobrar-salvo.
// Sem banco e sem rede — testável isoladamente.
// ─────────────────────────────────────────────────────────────

import { motivoRecusaLegivel } from "./rede-recorrencia-core.ts";

export interface LinhaPagamento {
  id?: string;
  tid: string | null;
  status: string;
  amount?: number | null;
  return_code?: string | null;
  return_message?: string | null;
}

export interface RespostaIdempotente {
  success: boolean;
  idempotente: true;
  em_processamento?: boolean;
  tid: string | null;
  valor_centavos?: number | null;
  motivo: string | null;
}

/** Resultado devolvido quando a MESMA chave de idempotência já tem linha gravada. */
export function respostaIdempotente(linha: LinhaPagamento): RespostaIdempotente {
  if (linha.status === "approved") {
    return { success: true, idempotente: true, tid: linha.tid, valor_centavos: linha.amount ?? null, motivo: null };
  }
  if (linha.status === "pending") {
    return {
      success: false,
      idempotente: true,
      em_processamento: true,
      tid: linha.tid,
      valor_centavos: linha.amount ?? null,
      motivo: "Cobrança em processamento. Confira o resultado antes de tentar de novo.",
    };
  }
  return {
    success: false,
    idempotente: true,
    tid: linha.tid,
    valor_centavos: linha.amount ?? null,
    motivo: motivoRecusaLegivel(linha.return_code ?? null, linha.return_message ?? null),
  };
}

export type DecisaoConflito =
  | { tipo: "idempotente"; resposta: RespostaIdempotente }
  | { tipo: "venda_ocupada"; motivo: string };

/**
 * Chamado quando o INSERT da reserva violou unicidade (23505).
 * `linhaMesmaChave` = linha existente com a MESMA idempotency_key (se houver).
 * Em nenhum dos casos a Rede deve ser chamada.
 */
export function decidirConflitoReserva(linhaMesmaChave: LinhaPagamento | null | undefined): DecisaoConflito {
  if (linhaMesmaChave) return { tipo: "idempotente", resposta: respostaIdempotente(linhaMesmaChave) };
  return {
    tipo: "venda_ocupada",
    motivo: "Já existe cobrança aprovada ou em processamento para esta venda",
  };
}

/** Postgres unique_violation. */
export function isUniqueViolation(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === "23505";
}

// ─────────────────────────────────────────────────────────────
// Classificação do resultado da transação.
//
// `cobrarComToken` devolve errorKind null quando conseguiu ler uma
// resposta HTTP da Rede — mesmo que seja 5xx ou um corpo sem
// returnCode. Nesses casos a transação pode ter sido efetivada e
// tratar como "denied" liberaria uma segunda cobrança do mesmo valor.
// Só é recusa quando existe returnCode interpretável.
// ─────────────────────────────────────────────────────────────

export interface ResultadoTransacaoLike {
  errorKind: string | null;
  stage: "cryptogram" | "transaction";
  approved?: boolean;
  httpStatus: number;
  returnCode: string | null;
}

export type ClassificacaoTransacao =
  /** Reserva apagada; nada foi cobrado. */
  | { tipo: "falha_limpa" }
  /** Reserva mantida em pending; pode ter sido cobrado. */
  | { tipo: "incerto"; httpStatus: number }
  /** Resposta interpretável da Rede: aprovada ou recusada. */
  | { tipo: "concluido"; aprovado: boolean };

export function classificarResultadoTransacao(r: ResultadoTransacaoLike): ClassificacaoTransacao {
  if (r.errorKind) {
    return r.stage === "transaction"
      ? { tipo: "incerto", httpStatus: r.httpStatus }
      : { tipo: "falha_limpa" };
  }
  const semReturnCode = r.returnCode == null || String(r.returnCode).trim() === "";
  if (r.stage === "transaction" && (r.httpStatus >= 500 || semReturnCode)) {
    return { tipo: "incerto", httpStatus: r.httpStatus };
  }
  return { tipo: "concluido", aprovado: !!r.approved };
}
