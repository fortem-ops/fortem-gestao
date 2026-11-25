import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mig = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0298_criar_contrato_tradicional_retroativa.sql"),
  "utf8",
);

describe("fn_criar_contrato_tradicional_retroativa (Corrida)", () => {
  it("exige admin (is_admin) e revoga acesso de anon/PUBLIC", () => {
    expect(mig).toMatch(/NOT\s+public\.is_admin\(v_uid\)/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.fn_criar_contrato_tradicional_retroativa\(jsonb\) FROM PUBLIC, anon/);
    expect(mig).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_criar_contrato_tradicional_retroativa\(jsonb\) TO authenticated, service_role/);
  });

  it("exige motivo obrigatório e grava audit_log", () => {
    expect(mig).toMatch(/IF v_motivo IS NULL THEN/);
    expect(mig).toMatch(/INSERT INTO public\.audit_log/);
    expect(mig).toMatch(/'venda_retroativa'/);
  });

  it("recusa valor abaixo do catálogo e combinação com desconto", () => {
    expect(mig).toMatch(/Valor cobrado não pode ser menor que o catálogo/);
    expect(mig).toMatch(/Não é possível combinar valor cobrado manual com desconto/);
  });

  it("grava cobranças em comando único (generate_series, sem FOR LOOP) com sobra de centavos na última parcela", () => {
    expect(mig).toMatch(/INSERT INTO public\.cobrancas/);
    expect(mig).toMatch(/FROM generate_series\(1, v_n_parcelas\)/);
    expect(mig).not.toMatch(/FOR\s+i\s+IN\s+1\.\./i);
    expect(mig).toMatch(/WHEN gs\.i = v_n_parcelas THEN v_total_c - v_base_c \* \(v_n_parcelas - 1\)/);
  });

  it("grava forma, bandeira, parcelas_cartao e data_pagamento quando ja_pago = true", () => {
    expect(mig).toMatch(/forma_recebimento/);
    expect(mig).toMatch(/bandeira/);
    expect(mig).toMatch(/parcelas_cartao/);
    expect(mig).toMatch(/data_pagamento/);
    expect(mig).toMatch(/status_pagamento = CASE WHEN v_ja_pago THEN 'pago'/);
  });

  it("não altera fn_criar_contrato_tradicional padrão", () => {
    expect(mig).not.toMatch(/CREATE OR REPLACE FUNCTION public\.fn_criar_contrato_tradicional\(/);
  });
});