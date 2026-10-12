import { describe, it, expect } from "vitest";
import {
  formasPermitidas, encontrarItem, calcularResumo, valorCorrida, descreverParcelas,
  type PlanoPublico, type ServicoPublico, type Familia2027, type Frequencia2027,
} from "@/lib/planosPublico2027";

const MENSAL: Record<Familia2027, Record<Frequencia2027, number>> = {
  start_2027: { "1x": 399, "2x": 499, "3x": 599, livre: 699 },
  power_2027: { "1x": 329, "2x": 429, "3x": 529, livre: 629 },
  pro_2027: { "1x": 399, "2x": 499, "3x": 599, livre: 699 },
};
const base = { quantidade_creditos: null, ilimitado: false, fidelidade_meses: 12, licenca_dias: 10, avaliacoes_funcionais: 1,
  permite_fixar_horario: false, bota_compressao_mes: 0, nivel_clube: null, reposicao_saldo_pct: 0, nome: "" };
const planos: PlanoPublico[] = [];
for (const fam of Object.keys(MENSAL) as Familia2027[]) {
  for (const f of Object.keys(MENSAL[fam]) as Frequencia2027[]) {
    const v = MENSAL[fam][f];
    planos.push({ ...base, codigo: `${fam}_${f}_mensal`, familia: fam, frequencia: f, modalidade_cobranca: "recorrencia_mensal",
      valor: v, taxa_recorrencia: fam === "start_2027" ? 0 : 24.9 });
    if (fam !== "start_2027") planos.push({ ...base, codigo: `${fam}_${f}_anual`, familia: fam, frequencia: f,
      modalidade_cobranca: "anual", valor: v * 12, taxa_recorrencia: 0 });
  }
}
const nutri4: ServicoPublico = { codigo: "nutri_4_comp_2_2027", nome: "", atividade: "Nutrição", quantidade_sessoes: 4, valor: 1620 };
const reab8: ServicoPublico = { codigo: "reab_8_2027", nome: "", atividade: "Reabilitação", quantidade_sessoes: 8, valor: 1200 };

describe("planos públicos 2027", () => {
  it("Start só aceita recorrência mensal", () => {
    expect(formasPermitidas("start_2027")).toEqual(["recorrencia"]);
  });
  it("Power e Pro aceitam 12x, Pix à vista e recorrência", () => {
    expect(formasPermitidas("power_2027")).toEqual(["cartao_parcelado", "pix_vista", "recorrencia"]);
    expect(formasPermitidas("pro_2027")).toEqual(["cartao_parcelado", "pix_vista", "recorrencia"]);
  });
  it("Start não tem item anual", () => {
    expect(encontrarItem({ planos }, "start_2027", "2x", "cartao_parcelado")).toBeUndefined();
  });
  it("cobre os 20 itens com o total esperado", () => {
    let n = 0;
    for (const p of planos) {
      const forma = p.modalidade_cobranca === "anual" ? "pix_vista" : "recorrencia";
      const r = calcularResumo({ item: p, servicos: [], forma, parcelas: 1, formaServicos: "pix_vista", parcelasServicos: 1 });
      const esperado = p.modalidade_cobranca === "anual" ? p.valor
        : p.familia === "start_2027" ? p.valor : Math.round((p.valor + 24.9) * 12 * 100) / 100;
      expect(r.totalGeral).toBeCloseTo(esperado, 2);
      n++;
    }
    expect(n).toBe(20);
  });
  it("Power 1x recorrência soma R$ 24,90 por mês: 12 x R$ 353,90", () => {
    const item = encontrarItem({ planos }, "power_2027", "1x", "recorrencia")!;
    const r = calcularResumo({ item, servicos: [], forma: "recorrencia", parcelas: 1, formaServicos: "pix_vista", parcelasServicos: 1 });
    expect(r.plano.parcelas).toHaveLength(12);
    expect(r.plano.parcelas[0].valor).toBe(353.9);
  });
  it("Pro 2x anual 12x com Nutri 4 + Reabilitação 8 entra nas mesmas 12 parcelas", () => {
    const item = encontrarItem({ planos }, "pro_2027", "2x", "cartao_parcelado")!;
    const r = calcularResumo({ item, servicos: [nutri4, reab8], forma: "cartao_parcelado", parcelas: 12, formaServicos: "pix_vista", parcelasServicos: 1 });
    expect(r.servicosAvulsos).toBeNull();
    expect(r.totalGeral).toBe(5988 + 1620 + 1200);
    expect(r.plano.parcelas).toHaveLength(12);
  });
  it("Start com serviços: serviços à parte em até 6x", () => {
    const item = encontrarItem({ planos }, "start_2027", "1x", "recorrencia")!;
    const r = calcularResumo({ item, servicos: [nutri4], forma: "recorrencia", parcelas: 1, formaServicos: "cartao_parcelado", parcelasServicos: 6 });
    expect(r.servicosAvulsos?.parcelas).toHaveLength(6);
    expect(r.servicosAvulsos?.total).toBe(1620);
    expect(() => calcularResumo({ item, servicos: [nutri4], forma: "recorrencia", parcelas: 1, formaServicos: "cartao_parcelado", parcelasServicos: 7 })).toThrow();
  });
  it("corrida usa o item legado da família", () => {
    const corrida = [{ nome: "Corrida - Start", valor: 170 }, { nome: "Corrida - Pro", valor: 150 }];
    expect(valorCorrida({ corrida }, "pro_2027")).toBe(150);
    expect(valorCorrida({ corrida }, "power_2027")).toBeNull();
  });
  it("descreve a sobra na última parcela", () => {
    expect(descreverParcelas([{ valor: 10 }, { valor: 10 }, { valor: 10.01 }])).toBe("2x de R$\u00a010,00 + 1x de R$\u00a010,01");
  });
});
