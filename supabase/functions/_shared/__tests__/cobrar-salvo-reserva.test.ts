import { describe, it, expect } from "vitest";
import {
  respostaIdempotente,
  decidirConflitoReserva,
  isUniqueViolation,
} from "../cobrar-salvo-reserva";

describe("respostaIdempotente", () => {
  it("aprovada devolve sucesso com o TID da primeira chamada", () => {
    expect(respostaIdempotente({ id: "p1", tid: "T1", status: "approved", amount: 10000 })).toEqual({
      success: true, idempotente: true, tid: "T1", valor_centavos: 10000, motivo: null,
    });
  });

  it("pendente devolve resultado incerto e não sucesso", () => {
    const r = respostaIdempotente({ id: "p1", tid: null, status: "pending", amount: 10000 });
    expect(r.success).toBe(false);
    expect(r.em_processamento).toBe(true);
    expect(r.motivo).toMatch(/processamento/i);
  });

  it("recusada devolve motivo legível, nunca o código cru", () => {
    const r = respostaIdempotente({
      id: "p1", tid: "T2", status: "denied", amount: 10000,
      return_code: "51", return_message: "insufficient funds",
    });
    expect(r.success).toBe(false);
    expect(r.motivo).toBe("Cartão sem limite");
  });
});

describe("decidirConflitoReserva", () => {
  it("mesma chave → devolve o resultado da primeira (sem chamar a Rede)", () => {
    const d = decidirConflitoReserva({ id: "p1", tid: "T1", status: "approved", amount: 500 });
    expect(d.tipo).toBe("idempotente");
    if (d.tipo === "idempotente") expect(d.resposta.tid).toBe("T1");
  });

  it("chave diferente para a mesma venda → venda ocupada", () => {
    const d = decidirConflitoReserva(null);
    expect(d.tipo).toBe("venda_ocupada");
    if (d.tipo === "venda_ocupada") expect(d.motivo).toMatch(/já existe cobrança/i);
  });
});

describe("isUniqueViolation", () => {
  it("reconhece 23505 e ignora os demais", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("classificarResultadoTransacao", () => {
  const base = { errorKind: null as string | null, stage: "transaction" as const, httpStatus: 200, returnCode: "00", approved: true };

  it("HTTP 5xx na transação é resultado incerto", () => {
    expect(classificarResultadoTransacao({ ...base, httpStatus: 502, approved: false, returnCode: null }))
      .toEqual({ tipo: "incerto", httpStatus: 502 });
  });

  it("corpo sem returnCode é resultado incerto", () => {
    expect(classificarResultadoTransacao({ ...base, returnCode: "", approved: false }))
      .toEqual({ tipo: "incerto", httpStatus: 200 });
  });

  it("recusa normal (51) é conclusiva", () => {
    expect(classificarResultadoTransacao({ ...base, returnCode: "51", approved: false }))
      .toEqual({ tipo: "concluido", aprovado: false });
  });

  it("aprovada (00) é conclusiva", () => {
    expect(classificarResultadoTransacao(base)).toEqual({ tipo: "concluido", aprovado: true });
  });

  it("erro de rede na transação é incerto e no criptograma é falha limpa", () => {
    expect(classificarResultadoTransacao({ ...base, errorKind: "network", httpStatus: 0, returnCode: null }))
      .toEqual({ tipo: "incerto", httpStatus: 0 });
    expect(classificarResultadoTransacao({ ...base, errorKind: "criptograma", stage: "cryptogram" as any, httpStatus: 400, returnCode: null }))
      .toEqual({ tipo: "falha_limpa" });
  });
});
