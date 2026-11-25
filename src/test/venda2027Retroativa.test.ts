import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calcularVenda2027, type Item2027 } from "@/lib/vendas2027";
import { validarBaixaCartao } from "@/lib/formasRecebimento";

const powerAnual: Item2027 = {
  codigo: "power_2027_2x_anual",
  familia: "power_2027",
  modalidade_cobranca: "anual",
  valor: 4800,
};

const startMensal: Item2027 = {
  codigo: "start_2027_2x_mensal",
  familia: "start_2027",
  modalidade_cobranca: "recorrencia_mensal",
  valor: 499,
};

const powerRecorrencia: Item2027 = {
  codigo: "power_2027_2x_rec",
  familia: "power_2027",
  modalidade_cobranca: "recorrencia_mensal",
  valor: 400,
  taxa_recorrencia: 24.9,
};

describe("venda 2027 retroativa / ajuste de valor — cálculo", () => {
  it("substitui o valor do catálogo quando maior e coloca a sobra de centavos na última parcela", () => {
    const r = calcularVenda2027({
      item: powerAnual,
      forma: "cartao_parcelado",
      parcelas: 12,
      valorPlanoOverride: 5000,
    });
    expect(r.totalPlano).toBe(5000);
    expect(r.totalGeral).toBe(5000);
    expect(r.plano.parcelas).toHaveLength(12);
    // 500000 / 12 = 41666 (R$ 416,66) nas 11 primeiras e R$ 416,74 na última
    expect(r.plano.parcelas[0].valor).toBe(416.66);
    expect(r.plano.parcelas[11].valor).toBe(416.74);
    const soma = Math.round(r.plano.parcelas.reduce((s, p) => s + p.valor, 0) * 100);
    expect(soma).toBe(500000);
  });

  it("recusa valor cobrado menor que o catálogo (redução deve usar desconto)", () => {
    expect(() =>
      calcularVenda2027({
        item: powerAnual,
        forma: "cartao_parcelado",
        parcelas: 12,
        valorPlanoOverride: 4500,
      }),
    ).toThrow(/menor que o catálogo/i);
  });

  it("recusa combinar valor cobrado manual com desconto", () => {
    expect(() =>
      calcularVenda2027({
        item: powerAnual,
        forma: "pix_vista",
        descontoPlano: 100,
        valorPlanoOverride: 5000,
      }),
    ).toThrow(/combinar/i);
  });

  it("em recorrência mensal ajusta apenas a 1ª mensalidade e mantém as seguintes no catálogo + taxa", () => {
    const r = calcularVenda2027({
      item: powerRecorrencia,
      forma: "recorrencia",
      valorPlanoOverride: 450,
    });
    expect(r.plano.parcelas).toHaveLength(12);
    expect(r.plano.parcelas[0].valor).toBe(450);
    expect(r.plano.parcelas[1].valor).toBe(424.9);
    expect(r.plano.parcelas[11].valor).toBe(424.9);
  });

  it("em Start mensal aceita valor maior que o catálogo", () => {
    const r = calcularVenda2027({
      item: startMensal,
      forma: "recorrencia",
      valorPlanoOverride: 550,
    });
    expect(r.plano.parcelas).toHaveLength(1);
    expect(r.totalPlano).toBe(550);
  });
});

describe("venda 2027 retroativa — baixa manual e migration", () => {
  it("exige bandeira para débito e crédito na máquina", () => {
    expect(validarBaixaCartao("maquina_debito", null, null)).toMatch(/bandeira/i);
    expect(validarBaixaCartao("maquina_debito", "VISA", null)).toBeNull();
    expect(validarBaixaCartao("maquina_credito", "", 3)).toMatch(/bandeira/i);
    expect(validarBaixaCartao("maquina_credito", "MASTERCARD", 3)).toBeNull();
  });

  it("migration 0297 restringe a admin, não usa loop em cobrancas, limita recorrência ao ciclo 1 e audita motivo", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "drizzle/migrations/0297_venda_2027_criar_retroativa.sql"),
      "utf8",
    );
    expect(sql).toMatch(/NOT public\.is_admin\(v_uid\)/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_venda_2027_criar_retroativa\(jsonb\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/public\.fn_venda_2027_criar\(p\)/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.fn_venda_2027_criar\(/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.fn_venda_2027_gravar\(/);
    expect(sql).not.toMatch(/\bFOR\b[\s\S]*?\bLOOP\b/i);
    expect(sql).toMatch(/AND \(NOT v_ehmensal OR numero_ciclo = 1\)/);
    expect(sql).toMatch(/INSERT INTO public\.audit_log/);
  });
});