import { describe, it, expect } from "vitest";
import { escolherCaminhoCobranca, genericoRecusa } from "../../supabase/functions/_shared/caminho-cobranca-token";
import { rotuloRecusa } from "../../supabase/functions/_shared/rotulo-recusa";

const base = { tipo_cobranca: "recorrencia", versao_2027: true, tem_cobranca_ciclo1: true };

describe("rede-cobrar-token — caminho pela venda", () => {
  it("Semestral de teste (teste_2027) vai para a 1ª mensalidade (bug do teste real de 11/11)", () => {
    expect(escolherCaminhoCobranca({ ...base, origem: "teste_2027", familia: "semestral_2027" })).toBe("primeiro_ciclo");
  });
  it("venda manual 2027 recorrente continua na 1ª mensalidade", () => {
    expect(escolherCaminhoCobranca({ ...base, origem: "manual", familia: "start_2027" })).toBe("primeiro_ciclo");
  });
  it("Loja/Corrida e teste do /planos seguem no caminho genérico", () => {
    expect(escolherCaminhoCobranca({ ...base, tipo_cobranca: "tradicional", origem: "manual", familia: null, versao_2027: false, tem_cobranca_ciclo1: false })).toBe("generico");
    expect(escolherCaminhoCobranca({ ...base, origem: "teste_2027", familia: "pro_2027" })).toBe("generico");
    expect(escolherCaminhoCobranca({ ...base, tipo_cobranca: null, origem: "corrida", familia: null })).toBe("generico");
  });
  it("genérico recusa plano 2027 recorrente com cobrança nº 1; legado e avulsas passam", () => {
    expect(genericoRecusa({ ...base, origem: "teste_2027", familia: "pro_2027" })).toBe(true);
    expect(genericoRecusa({ ...base, origem: "manual", familia: null, versao_2027: false })).toBe(false);
    expect(genericoRecusa({ ...base, tipo_cobranca: "tradicional", origem: "manual", familia: null })).toBe(false);
  });
});

describe("aviso de recusa — rótulo", () => {
  it("venda Semestral sem inscrição da Corrida usa o nome do plano", () => {
    const r = rotuloRecusa({ fluxo: "loja", venda_id: "v1", tem_inscricao_corrida: false, item_venda: { familia: "semestral_2027", nome: "Pro Semestral" } });
    expect(r.fluxoLabel).toBe("Plano Semestral");
    expect(r.referencia).toContain("Plano Semestral · Pro Semestral");
  });
  it("Corrida só com inscrição ligada; Loja com pedido", () => {
    expect(rotuloRecusa({ fluxo: "corrida", venda_id: "v2", tem_inscricao_corrida: true }).fluxoLabel).toBe("Corrida");
    expect(rotuloRecusa({ fluxo: "loja", pedido_id: "p1", tem_inscricao_corrida: false }).fluxoLabel).toBe("Loja");
    expect(rotuloRecusa({ fluxo: "loja", tem_inscricao_corrida: false }).referencia).toBe("Compra na Loja");
  });
});
