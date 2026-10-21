import { describe, expect, it } from "vitest";
import { calcularTotalFesta, confirmacoesAbertas, whatsappValido } from "@/lib/festa10anos";
import { resumoFesta, type ConfirmacaoFesta } from "@/lib/festaResumo";

const conf = (o: Partial<ConfirmacaoFesta>): ConfirmacaoFesta => ({
  id: "1", nome: "A", whatsapp: "5551999999999", email: null, vinculo: "aluno_atual", consumo: [], intolerancias: [],
  status: "confirmado", origem: "site", total_centavos: 7500, pago_em: null, pago_valor_centavos: 7500,
  pagamento_forma: "pix", observacao: null, criado_em: "", festa_acompanhantes: [], ...o,
});

describe("festa 10 anos", () => {
  it("1 pessoa custa R$ 75", () => expect(calcularTotalFesta(0)).toBe(7500));
  it("2 pessoas custam R$ 150", () => expect(calcularTotalFesta(1)).toBe(15000));
  it("4 pessoas custam R$ 300", () => expect(calcularTotalFesta(3)).toBe(30000));
  it("limite de 3 acompanhantes", () => expect(calcularTotalFesta(5)).toBe(30000));
  it("voucher Equipe10 zera o total de todos", () => expect(calcularTotalFesta(3, true)).toBe(0));
  it("fecha depois de 8/11 às 23:59 de Brasília", () => {
    expect(confirmacoesAbertas(new Date("2026-11-09T02:59:00Z"))).toBe(true);
    expect(confirmacoesAbertas(new Date("2026-11-09T03:00:01Z"))).toBe(false);
  });
  it("WhatsApp exige celular com DDD", () => {
    expect(whatsappValido("(51) 99999-0000")).toBe(true);
    expect(whatsappValido("(51) 3333-0000")).toBe(false);
  });
  it("pendentes não entram nas pessoas confirmadas", () => {
    const acomp = [{ id: "a", nome: "B", consumo: ["chope"], intolerancias: [] }];
    const r = resumoFesta([conf({ festa_acompanhantes: acomp }), conf({ id: "2", status: "aguardando_pagamento", total_centavos: 16000 }), conf({ id: "3", status: "isento", total_centavos: 0 }), conf({ id: "4", status: "cancelado" })]);
    expect(r.pessoasConfirmadas).toBe(3);
    expect(r.pessoasAguardando).toBe(1);
    expect(r.aReceberCentavos).toBe(16000);
  });
});
