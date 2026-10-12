import { describe, it, expect } from "vitest";
import { calcularVenda2027, type Item2027, type Servico2027 } from "@/lib/vendas2027";

const MENSAIS: Record<string, number> = {
  start_2027_1x: 399, start_2027_2x: 499, start_2027_3x: 599, start_2027_livre: 699,
  power_2027_1x: 329, power_2027_2x: 429, power_2027_3x: 529, power_2027_livre: 629,
  pro_2027_1x: 399, pro_2027_2x: 499, pro_2027_3x: 599, pro_2027_livre: 699,
};

const ITENS: Item2027[] = Object.entries(MENSAIS).flatMap(([k, v]) => {
  const familia = k.replace(/_(1x|2x|3x|livre)$/, "");
  const mensal: Item2027 = {
    codigo: `${k}_mensal`, familia, modalidade_cobranca: "recorrencia_mensal", valor: v,
    taxa_recorrencia: familia === "start_2027" ? 0 : 24.9,
  };
  if (familia === "start_2027") return [mensal];
  return [mensal, { codigo: `${k}_anual`, familia, modalidade_cobranca: "anual", valor: v * 12, taxa_recorrencia: 0 }];
});

const SERVICOS: Servico2027[] = [
  { codigo: "nutri_4_comp_2_2027", valor: 1620 },
  { codigo: "nutri_8_2027", valor: 2400 },
  { codigo: "reab_4_2027", valor: 600 },
  { codigo: "reab_8_2027", valor: 1200 },
  { codigo: "comp_corporal_avulsa_2027", valor: 200 },
];

const soma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe("calcularVenda2027 — catálogo completo", () => {
  it("tem os 20 itens", () => expect(ITENS).toHaveLength(20));

  for (const item of ITENS.filter((i) => i.modalidade_cobranca === "recorrencia_mensal")) {
    it(`${item.codigo}: 12 cobranças de mensal + taxa`, () => {
      const r = calcularVenda2027({ item, forma: "recorrencia" });
      const esperado = Number(item.valor) + (item.familia === "start_2027" ? 0 : 24.9);
      expect(r.plano.parcelas).toHaveLength(12);
      r.plano.parcelas.forEach((p) => expect(p.valor).toBeCloseTo(esperado, 2));
      expect(r.servicosAvulsos).toBeNull();
    });
  }

  for (const item of ITENS.filter((i) => i.modalidade_cobranca === "anual")) {
    it(`${item.codigo}: 12x sem acréscimo e Pix à vista sem desconto`, () => {
      const r12 = calcularVenda2027({ item, forma: "cartao_parcelado", parcelas: 12 });
      expect(r12.plano.parcelas).toHaveLength(12);
      expect(soma(r12.plano.parcelas.map((p) => p.valor))).toBe(Number(item.valor));
      const pix = calcularVenda2027({ item, forma: "pix_vista" });
      expect(pix.plano.parcelas).toHaveLength(1);
      expect(pix.plano.total).toBe(Number(item.valor));
    });
  }
});

describe("calcularVenda2027 — valores combinados", () => {
  const item = (codigo: string) => ITENS.find((i) => i.codigo === codigo)!;

  it("Power 2x recorrência = 429 + 24,90 = 453,90", () => {
    const r = calcularVenda2027({ item: item("power_2027_2x_mensal"), forma: "recorrencia" });
    expect(r.plano.parcelas[0].valor).toBe(453.9);
    expect(r.totalPlano).toBe(5446.8);
  });

  it("Start 1x: 399 sem taxa", () => {
    const r = calcularVenda2027({ item: item("start_2027_1x_mensal"), forma: "recorrencia" });
    expect(r.plano.parcelas[0].valor).toBe(399);
  });

  it("Power 1x anual + Nutri 4 em 12x: parcela = (3948 + 1620)/12 = 464", () => {
    const r = calcularVenda2027({
      item: item("power_2027_1x_anual"), forma: "cartao_parcelado", parcelas: 12, servicos: [SERVICOS[0]],
    });
    r.plano.parcelas.forEach((p) => {
      expect(p.valor).toBe(464);
      expect(p.plano).toBe(329);
      expect(p.servicos).toBe(135);
    });
    expect(r.servicosAvulsos).toBeNull();
  });

  it("arredondamento: centavos ficam na última parcela", () => {
    // 5148 + 200 = 5348 / 12 = 445,666...
    const r = calcularVenda2027({
      item: item("power_2027_2x_anual"), forma: "cartao_parcelado", parcelas: 12, servicos: [SERVICOS[4]],
    });
    const ps = r.plano.parcelas;
    ps.slice(0, 11).forEach((p) => expect(p.valor).toBe(445.66));
    expect(ps[11].valor).toBe(445.74);
    expect(soma(ps.map((p) => p.valor))).toBe(5348);
    expect(soma(ps.map((p) => p.plano))).toBe(5148);
    expect(soma(ps.map((p) => p.servicos))).toBe(200);
    ps.forEach((p) => expect(soma([p.plano, p.servicos])).toBe(p.valor));
  });

  it("Pix à vista anual com serviços: soma sem desconto", () => {
    const r = calcularVenda2027({ item: item("pro_2027_3x_anual"), forma: "pix_vista", servicos: SERVICOS });
    expect(r.plano.total).toBe(7188 + 6020);
  });

  for (const s of SERVICOS) {
    it(`${s.codigo} à parte na recorrência: 6x no cartão ou Pix`, () => {
      const base = { item: item("pro_2027_1x_mensal"), forma: "recorrencia" as const, servicos: [s] };
      const c6 = calcularVenda2027({ ...base, formaServicos: "cartao_parcelado", parcelasServicos: 6 });
      expect(c6.servicosAvulsos!.parcelas).toHaveLength(6);
      expect(soma(c6.servicosAvulsos!.parcelas.map((p) => p.valor))).toBe(Number(s.valor));
      expect(c6.plano.parcelas[0].servicos).toBe(0);
      const pix = calcularVenda2027({ ...base, formaServicos: "pix_vista" });
      expect(pix.servicosAvulsos!.total).toBe(Number(s.valor));
    });
  }

  it("Start com serviços: sempre à parte", () => {
    const r = calcularVenda2027({
      item: item("start_2027_2x_mensal"), forma: "recorrencia", servicos: [SERVICOS[1]],
      formaServicos: "cartao_parcelado", parcelasServicos: 6,
    });
    expect(r.plano.parcelas[0].valor).toBe(499);
    expect(r.servicosAvulsos!.parcelas[0].valor).toBe(400);
  });
});

describe("calcularVenda2027 — bloqueios", () => {
  const m = ITENS.find((i) => i.codigo === "power_2027_1x_mensal")!;
  const a = ITENS.find((i) => i.codigo === "power_2027_1x_anual")!;
  it("mensal não pode ser parcelado", () => expect(() => calcularVenda2027({ item: m, forma: "cartao_parcelado" })).toThrow());
  it("anual não pode ser recorrência", () => expect(() => calcularVenda2027({ item: a, forma: "recorrencia" })).toThrow());
  it("plano no máximo 12x", () => expect(() => calcularVenda2027({ item: a, forma: "cartao_parcelado", parcelas: 13 })).toThrow());
  it("serviços no máximo 6x", () =>
    expect(() =>
      calcularVenda2027({ item: m, forma: "recorrencia", servicos: [SERVICOS[0]], formaServicos: "cartao_parcelado", parcelasServicos: 7 }),
    ).toThrow());
});
