import { describe, it, expect } from "vitest";
import { validarCobrancaSalvo, cartaoVencido } from "../cobrar-salvo-validacao";

const AGORA = new Date("2026-09-23T12:00:00Z");

const venda = { id: "v1", aluno_id: "a1", status_pagamento: "pendente" };
const cartao = {
  id: "c1", aluno_id: "a1", ativo: true, token_rede: "tok",
  expiration_month: 10, expiration_year: 2029,
};

function run(over: Partial<Parameters<typeof validarCobrancaSalvo>[0]> = {}) {
  return validarCobrancaSalvo({
    venda, cartao, tokenizationId: "tk-1", pagamentoExistente: null, agora: AGORA, ...over,
  } as any);
}

describe("validarCobrancaSalvo", () => {
  it("aceita cartão ativo, do mesmo aluno, válido e tokenizado", () => {
    expect(run()).toEqual({ ok: true });
  });

  it("recusa venda inexistente", () => {
    expect(run({ venda: null })).toMatchObject({ ok: false, codigo: "venda_inexistente" });
  });

  it("recusa venda já paga", () => {
    expect(run({ venda: { ...venda, status_pagamento: "pago" } })).toMatchObject({ ok: false, codigo: "venda_paga" });
  });

  it("bloqueia quando já há pagamento aprovado/pendente e devolve o tid", () => {
    const r = run({ pagamentoExistente: { tid: "TID-1", status: "approved" } });
    expect(r).toMatchObject({ ok: false, codigo: "ja_cobrada", tid: "TID-1" });
  });

  it("recusa cartão de outro aluno", () => {
    expect(run({ cartao: { ...cartao, aluno_id: "a2" } })).toMatchObject({ ok: false, codigo: "cartao_outro_aluno" });
  });

  it("recusa cartão inativo", () => {
    expect(run({ cartao: { ...cartao, ativo: false } })).toMatchObject({ ok: false, codigo: "cartao_inativo" });
  });

  it("recusa cartão vencido", () => {
    expect(run({ cartao: { ...cartao, expiration_month: 8, expiration_year: 2026 } }))
      .toMatchObject({ ok: false, codigo: "cartao_vencido" });
  });

  it("recusa cartão sem tokenização ativa", () => {
    expect(run({ tokenizationId: null })).toMatchObject({ ok: false, codigo: "sem_tokenizacao" });
  });
});

describe("cartaoVencido", () => {
  it("vale até o último dia do mês de validade", () => {
    expect(cartaoVencido(9, 2026, new Date("2026-09-30T23:00:00Z"))).toBe(false);
    expect(cartaoVencido(9, 2026, new Date("2026-10-01T00:00:00Z"))).toBe(true);
  });
  it("trata mês inválido como vencido", () => {
    expect(cartaoVencido(0, 2030, AGORA)).toBe(true);
  });
});
