import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formaExigeBandeira, formaPermiteParcelas, formaRecebimentoDaModalidade } from "@/lib/formasRecebimento";

const mig = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0298_criar_contrato_tradicional_retroativa.sql"),
  "utf8",
);
const migAudit = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0299_audit_log_operacao_venda_retroativa.sql"),
  "utf8",
);
const retroSection = readFileSync(
  resolve(process.cwd(), "src/components/student/venda/VendaRetroativaSection.tsx"),
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

  it("audit_log_operacao_check aceita a operação 'venda_retroativa'", () => {
    expect(migAudit).toMatch(/ADD CONSTRAINT audit_log_operacao_check/);
    expect(migAudit).toMatch(/'venda_retroativa'::text/);
  });

  it("seção de venda retroativa contém apenas valor, data da venda e motivo (sem forma de pagamento)", () => {
    expect(retroSection).toMatch(/Valor cobrado/);
    expect(retroSection).toMatch(/Data da venda/);
    expect(retroSection).toMatch(/Motivo/);
    expect(retroSection).not.toMatch(/Forma de recebimento/);
    expect(retroSection).not.toMatch(/Bandeira/);
    expect(retroSection).not.toMatch(/Já pago/);
  });

  it("mapeia débito e crédito na máquina para slugs aceitos pelo banco (maquina_debito / maquina_credito)", () => {
    const match = mig.match(/v_forma_rec NOT IN \(([^)]+)\)/);
    expect(match).not.toBeNull();
    const aceitasBanco = Array.from(match![1].matchAll(/'([^']+)'/g), (m) => m[1]);

    const debito = formaRecebimentoDaModalidade("debito");
    const creditoMaquina = formaRecebimentoDaModalidade("cartao_credito", "maquininha");
    const dinheiro = formaRecebimentoDaModalidade("dinheiro");
    const pix = formaRecebimentoDaModalidade("pix_avista");
    const boleto = formaRecebimentoDaModalidade("boleto");

    expect(debito).toBe("maquina_debito");
    expect(creditoMaquina).toBe("maquina_credito");
    expect(formaExigeBandeira(debito)).toBe(true);
    expect(formaExigeBandeira(creditoMaquina)).toBe(true);
    expect(formaPermiteParcelas(creditoMaquina)).toBe(true);

    for (const slug of [debito, creditoMaquina, dinheiro, pix, boleto]) {
      expect(aceitasBanco).toContain(slug);
    }
  });
});