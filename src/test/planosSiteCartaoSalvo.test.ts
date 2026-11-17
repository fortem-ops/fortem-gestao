import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0280_planos_site_cartao_meios_pagamento.sql", "utf8");

describe("cartão das compras do /planos em Meios de Pagamento", () => {
  it("copia o cartão ao ativar a compra", () => {
    expect(sql).toMatch(/AFTER UPDATE OF ativada_em ON public\.propostas_planos_2027/);
  });
  it("nunca copia proposta de teste nem cartão simulado", () => {
    expect(sql).toMatch(/OR p\.teste THEN RETURN NULL/);
    expect(sql).toMatch(/NOT LIKE 'SIMULACAO-%'/);
  });
  it("não duplica o cartão ao ativar de novo", () => {
    expect(sql).toMatch(/WHERE aluno_id = p\.aluno_ativado_id AND token_rede = rt\.token_code/);
  });
  it("só vira principal se o aluno não tiver outro cartão principal", () => {
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.cartoes_salvos c WHERE c\.aluno_id = p\.aluno_ativado_id AND c\.ativo AND c\.is_default\)/);
  });
});
