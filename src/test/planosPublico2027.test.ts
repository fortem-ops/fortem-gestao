import { describe, it, expect } from "vitest";
import {
   pagamentoComRecorrencia, parcelasPacotePublico, formasPermitidas, encontrarItem, calcularResumo, valorCorrida, descreverParcelas, menorPrecoFrequencia, opcoesCorrida, permiteReposicaoPublica,
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
  it("interruptor mantém Start recorrente e alterna Power/Pro sem Pix recorrente", () => {
    expect(pagamentoComRecorrencia("start_2027", false, "pix_vista")).toBe("recorrencia");
    for (const f of ["power_2027", "pro_2027"] as const) {
      expect(pagamentoComRecorrencia(f, true, "pix_vista")).toBe("recorrencia");
      expect(pagamentoComRecorrencia(f, false, "recorrencia")).toBe("cartao_parcelado");
      expect(pagamentoComRecorrencia(f, false, "pix_vista")).toBe("pix_vista");
    }
  });
  it("pacote Nutri 1620 mostra Start 6x270 e Power/Pro 12x135", () => {
    expect(parcelasPacotePublico(nutri4, "start_2027").map(p => p.valor)).toEqual(Array(6).fill(270));
    for (const f of ["power_2027", "pro_2027"] as const) expect(parcelasPacotePublico(nutri4, f).map(p => p.valor)).toEqual(Array(12).fill(135));
  });
  it.each(["power_2027", "pro_2027"] as const)("%s recorrência mantém 12 cobranças e consultas separadas em 6x", (familia) => {
    const item = encontrarItem({ planos }, familia, "2x", "recorrencia");
    if (!item) throw new Error("Missing fixture");
    const r = calcularResumo({ item, servicos: [nutri4], forma: "recorrencia", parcelas: 12, formaServicos: "cartao_parcelado", parcelasServicos: 6 });
    expect(r.plano.parcelas).toHaveLength(12);
    expect(r.plano.parcelas[0].valor).toBe(familia === "power_2027" ? 453.9 : 523.9);
    expect(r.servicosAvulsos?.parcelas.map(p => p.valor)).toEqual(Array(6).fill(270));
  });
  it("frequência 2x mostra o menor preço do catálogo, Power R$429", () => {
    expect(menorPrecoFrequencia({ planos }, "2x")).toBe(429);
  });
  it("Power 2x + Nutri 4 + Fisio 4 resulta em 12 cobranças de 614 e total 7368", () => {
    const item = encontrarItem({ planos }, "power_2027", "2x", "cartao_parcelado");
    if (!item) throw new Error("Missing fixture");
    const fisio4 = { ...reab8, codigo: "reab_4_2027", quantidade_sessoes: 4, valor: 600 };
    const r = calcularResumo({ item, servicos: [nutri4, fisio4], forma: "cartao_parcelado", parcelas: 12, formaServicos: "pix_vista", parcelasServicos: 1 });
    expect(r.totalGeral).toBe(7368);
    expect(r.plano.parcelas).toHaveLength(12);
    expect(r.plano.parcelas[0]).toEqual({ numero: 1, valor: 614, plano: 429, servicos: 185 });
  });
  it("Pix do plano mantém consultas à parte em 6x sem desconto", () => {
    const item = encontrarItem({ planos }, "power_2027", "2x", "pix_vista");
    if (!item) throw new Error("Missing fixture");
    const r = calcularResumo({ item, servicos: [nutri4], forma: "pix_vista", parcelas: 1, formaServicos: "cartao_parcelado", parcelasServicos: 6 });
    expect(r.plano.total).toBe(5148);
    expect(r.servicosAvulsos?.parcelas.map((p) => p.valor)).toEqual([270,270,270,270,270,270]);
    expect(r.totalGeral).toBe(6768);
  });
  it("corrida Start usa 170 mensal, 960 semestral e 1920 anual do catálogo", () => {
    const corrida = [{nome:"Corrida - Start",valor:1920,periodo_meses:12 as const},{nome:"Corrida - Pro",valor:150,periodo_meses:1 as const},{nome:"Corrida - Start",valor:170,periodo_meses:1 as const},{nome:"Corrida - Start",valor:960,periodo_meses:6 as const}];
    expect(opcoesCorrida({corrida}, "start_2027").map((p) => [p.periodo_meses,p.valor])).toEqual([[1,170],[6,960],[12,1920]]);
  });
  it("Pro Livre não oferece reposição de 50%", () => {
    expect(permiteReposicaoPublica({familia:"pro_2027",frequencia:"livre",reposicao_saldo_pct:50})).toBe(false);
  });
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
