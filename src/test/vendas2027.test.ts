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
    it(`${item.codigo}: Start 1 cobrança por ciclo; Power/Pro 12 cobranças de mensal + taxa`, () => {
      const r = calcularVenda2027({ item, forma: "recorrencia" });
      const esperado = Number(item.valor) + (item.familia === "start_2027" ? 0 : 24.9);
      expect(r.plano.parcelas).toHaveLength(item.familia === "start_2027" ? 1 : 12);
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

  it("Start 2x: só a 1ª mensalidade do ciclo (sem fidelidade, sem 12 cobranças)", () => {
    const r = calcularVenda2027({ item: item("start_2027_2x_mensal"), forma: "recorrencia" });
    expect(r.plano.parcelas).toEqual([{ numero: 1, valor: 499, plano: 499, servicos: 0 }]);
    expect(r.totalPlano).toBe(499);
  });

  it("Pro 3x recorrência: continua com 12 cobranças de 623,90", () => {
    const r = calcularVenda2027({ item: item("pro_2027_3x_mensal"), forma: "recorrencia" });
    expect(r.plano.parcelas).toHaveLength(12);
    expect(r.totalPlano).toBe(7486.8);
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

import { itemVendavel2027, fimCicloMensal } from "@/lib/vendas2027";

describe("itemVendavel2027", () => {
  it("item desligado não vende para aluno comum", () =>
    expect(itemVendavel2027({ ativo: false, vendavel_desde: "2026-10-13" }, "2026-10-20", false)).toBe(false));
  it("item desligado vende para aluno de teste", () =>
    expect(itemVendavel2027({ ativo: false, vendavel_desde: "2026-10-13" }, "2026-10-12", true)).toBe(true));
  it("item ligado antes de vendavel_desde não vende", () =>
    expect(itemVendavel2027({ ativo: true, vendavel_desde: "2026-10-13" }, "2026-10-12", false)).toBe(false));
  it("item ligado na janela vende", () =>
    expect(itemVendavel2027({ ativo: true, vendavel_desde: "2026-10-13" }, "2026-10-13", false)).toBe(true));
  it("item após vendavel_ate não vende", () =>
    expect(itemVendavel2027({ ativo: true, vendavel_ate: "2026-12-31" }, "2027-01-01", false)).toBe(false));
});

describe("fimCicloMensal", () => {
  it("25/10 -> 24/11", () => expect(fimCicloMensal("2026-10-25")).toBe("2026-11-24"));
  it("12/10 -> 11/11", () => expect(fimCicloMensal("2026-10-12")).toBe("2026-11-11"));
});

import { calcularServicos2027 } from "@/lib/vendas2027";

describe("calcularServicos2027", () => {
  it("Avaliação avulsa no Pix: 1 x 200", () => {
    const r = calcularServicos2027([{ codigo: "comp_corporal_avulsa_2027", valor: 200 }], "pix_vista");
    expect(r.parcelas).toEqual([{ numero: 1, valor: 200, plano: 0, servicos: 200 }]);
  });
  it("Nutri 4 em 6x: 5 x 270 e última 270", () => {
    const r = calcularServicos2027([{ codigo: "nutri_4_comp_2_2027", valor: 1620 }], "cartao_parcelado", 6);
    expect(r.parcelas.map((p) => p.valor)).toEqual([270, 270, 270, 270, 270, 270]);
  });
  it("no máximo 6x", () =>
    expect(() => calcularServicos2027([{ codigo: "x", valor: 100 }], "cartao_parcelado", 7)).toThrow());
});

import { filtrarLegadoVendavel } from "@/lib/vendas2027";
describe("filtrarLegadoVendavel (VendaDialog, planos atuais)", () => {
  const itens = [
    { id: "a", versao: null, ativo: true, vendavel_ate: null },
    { id: "b", versao: null, ativo: true, vendavel_ate: "2026-10-12" },
    { id: "c", versao: 2027, ativo: true, vendavel_desde: "2026-10-13" },
    { id: "d", versao: null, ativo: false },
  ];
  it("legado sem vendavel_ate continua à venda", () =>
    expect(filtrarLegadoVendavel(itens, "2026-10-13").map((i) => i.id)).toEqual(["a"]));
  it("legado vende até o dia de vendavel_ate", () =>
    expect(filtrarLegadoVendavel(itens, "2026-10-12").map((i) => i.id)).toEqual(["a", "b"]));
});

describe("calcularVenda2027 — desconto", () => {
  const start3x = ITENS.find((i) => i.codigo === "start_2027_3x_mensal")!;
  const power2xAnual = ITENS.find((i) => i.codigo === "power_2027_2x_anual")!;

  it("Start 3x com R$ 100 de desconto: 1ª mensalidade R$ 499", () => {
    const r = calcularVenda2027({ item: start3x, forma: "recorrencia", descontoPlano: 100 });
    expect(r.plano.parcelas[0].valor).toBe(499);
    expect(r.totalPlano).toBe(499);
  });

  it("Power 2x anual 12x com R$ 100,01 de desconto: total 5047,99 e sobra na última", () => {
    const r = calcularVenda2027({ item: power2xAnual, forma: "cartao_parcelado", parcelas: 12, descontoPlano: 100.01 });
    expect(r.totalPlano).toBe(5047.99);
    expect(r.plano.parcelas[0].valor).toBe(420.66);
    expect(r.plano.parcelas[11].valor).toBe(420.73);
    expect(soma(r.plano.parcelas.map((p) => p.valor))).toBe(5047.99);
  });

  it("desconto maior ou igual ao plano é rejeitado", () => {
    expect(() => calcularVenda2027({ item: start3x, forma: "recorrencia", descontoPlano: 599 })).toThrow();
  });
});
