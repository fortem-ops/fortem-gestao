import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  formaExigeBandeira,
  formaPermiteParcelas,
  modalidadeAdquirente,
  validarBaixaCartao,
} from "@/lib/formasRecebimento";

describe("baixa manual com débito, bandeira e parcelas", () => {
  it("exige bandeira apenas para cartão na máquina (débito e crédito)", () => {
    expect(formaExigeBandeira("maquina_debito")).toBe(true);
    expect(formaExigeBandeira("maquina_credito")).toBe(true);
    expect(formaExigeBandeira("dinheiro")).toBe(false);
    expect(formaExigeBandeira("pix")).toBe(false);
    expect(formaExigeBandeira("boleto")).toBe(false);
    expect(formaExigeBandeira("cartao_credito_online")).toBe(false);
  });

  it("permite informar parcelas apenas no crédito na máquina", () => {
    expect(formaPermiteParcelas("maquina_credito")).toBe(true);
    expect(formaPermiteParcelas("maquina_debito")).toBe(false);
    expect(formaPermiteParcelas("dinheiro")).toBe(false);
    expect(formaPermiteParcelas("pix")).toBe(false);
  });

  it("mapeia débito para modalidade 'debito' e crédito conforme parcelas", () => {
    expect(modalidadeAdquirente("maquina_debito")).toBe("debito");
    expect(modalidadeAdquirente("maquina_credito", 1)).toBe("credito_vista");
    expect(modalidadeAdquirente("maquina_credito", 3)).toBe("credito_2_6x");
    expect(modalidadeAdquirente("maquina_credito", 6)).toBe("credito_2_6x");
    expect(modalidadeAdquirente("maquina_credito", 7)).toBe("credito_7_12x");
    expect(modalidadeAdquirente("maquina_credito", 12)).toBe("credito_7_12x");
    expect(modalidadeAdquirente("dinheiro")).toBeNull();
    expect(modalidadeAdquirente("pix")).toBeNull();
  });

  it("bloqueia confirmação no cartão sem bandeira e libera quando preenchida", () => {
    expect(validarBaixaCartao("maquina_debito", "")).not.toBeNull();
    expect(validarBaixaCartao("maquina_debito", "visa")).toBeNull();
    expect(validarBaixaCartao("maquina_credito", "", 3)).not.toBeNull();
    expect(validarBaixaCartao("maquina_credito", "elo", 3)).toBeNull();
    expect(validarBaixaCartao("maquina_credito", "visa", 0)).not.toBeNull();
    expect(validarBaixaCartao("maquina_credito", "visa", 13)).not.toBeNull();
  });

  it("não exige bandeira nem parcelas para Dinheiro e Pix", () => {
    expect(validarBaixaCartao("dinheiro", "")).toBeNull();
    expect(validarBaixaCartao("pix", null)).toBeNull();
  });

  it("migration 0296 adiciona bandeira/parcelas em cobrancas e aplica débito e bandeira em vw_recebidos_periodo", () => {
    const migPath = path.resolve(
      process.cwd(),
      "drizzle/migrations/0296_cobrancas_bandeira_parcelas_e_recebidos.sql",
    );
    const sql = fs.readFileSync(migPath, "utf8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS bandeira text NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS parcelas_cartao smallint NULL");
    expect(sql).toContain("maquina_debito");
    expect(sql).toContain("'debito'::public.adquirente_modalidade");
    expect(sql).toContain("COALESCE(bm.cb_bandeira, bm.bandeira_padrao)");
    expect(sql).toContain("'credito_2_6x'::public.adquirente_modalidade");
    expect(sql).toContain("'credito_7_12x'::public.adquirente_modalidade");
    expect(sql).toContain("security_invoker = on");
  });
});