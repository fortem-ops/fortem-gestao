import { describe, it, expect } from "vitest";
import {
  calcularResumoCorrida,
  dataProva,
  nomePlanoExibicao,
  type CampanhaItem,
  type Distancia,
  type OfertaCorrida,
  type ProvaKey,
  type ResumoParams,
} from "@/lib/corridaPreco";

const item = (over: Partial<CampanhaItem> = {}): CampanhaItem => ({
  id: "i1",
  tipo: "kit_fortem",
  rota: "aluno",
  tier: null,
  nivel: "1",
  prova_nome: null,
  distancia: null,
  descricao: "Item",
  valor: 100,
  isento: false,
  condicao: null,
  ...over,
});

const ofertaBase = (over: Partial<OfertaCorrida> = {}): OfertaCorrida => ({
  planoAnual: { nome: "Corrida - Start", periodo_meses: 12, valor: 1200 },
  planoMensal: { nome: "Corrida - Start", periodo_meses: 1, valor: 120 },
  kits: [],
  aval: null,
  cortesia: null,
  mipoaItem: null,
  provaValor: null,
  ...over,
});

const params = (over: Partial<ResumoParams> = {}): ResumoParams => ({
  oferta: ofertaBase(),
  rota: "aluno",
  periodo: "anual",
  distanciaCortesia: "5K",
  kitNivel: null,
  mipoa: false,
  distanciaMipoa: "5K",
  avaliacao: false,
  provasSel: { NB: { ativo: false, distancia: "5K" }, MIPOA: { ativo: false, distancia: "5K" } },
  maxParcelas: 10,
  ...over,
});

describe("helpers de exibição", () => {
  it("dataProva usa data de maratona só para 42K", () => {
    expect(dataProva("NB", "42K")).toBe("22 de agosto de 2027");
    expect(dataProva("NB", "5K")).toBe("21 de agosto de 2027");
    expect(dataProva("MIPOA", "42K")).toBe("6 de junho de 2027");
    expect(dataProva("MIPOA", "21K")).toBe("5 de junho de 2027");
  });

  it("nomePlanoExibicao mascara nomenclatura interna e mantém o resto", () => {
    expect(nomePlanoExibicao("Corrida - Prospect")).toBe("Assessoria de Corrida Fortem");
    expect(nomePlanoExibicao("Corrida - Sem Plano")).toBe("Corrida Fortem (sem plano de treino)");
    expect(nomePlanoExibicao("Corrida - Start")).toBe("Corrida - Start");
  });
});

describe("calcularResumoCorrida — guardas", () => {
  it("retorna null sem oferta", () => {
    expect(calcularResumoCorrida(params({ oferta: null }))).toBeNull();
  });
  it("retorna null sem rota", () => {
    expect(calcularResumoCorrida(params({ rota: null }))).toBeNull();
  });
  it("tudo zerado: sem plano e sem adicionais gera resumo vazio", () => {
    const r = calcularResumoCorrida(
      params({ oferta: ofertaBase({ planoAnual: null, planoMensal: null }) }),
    )!;
    expect(r.linhas).toHaveLength(0);
    expect(r.hoje).toBe(0);
    expect(r.recorrente).toBe(0);
  });
});

describe("calcularResumoCorrida — plano", () => {
  it("aluno usa plano anual mesmo com período mensal", () => {
    const r = calcularResumoCorrida(params({ periodo: "mensal" }))!;
    expect(r.hoje).toBe(1200);
    expect(r.recorrente).toBe(0);
    expect(r.linhas[0].label).toContain("Plano Anual");
    expect(r.linhas[0].nota).toContain("10x");
  });

  it("somente_corrida também é sempre anual", () => {
    const r = calcularResumoCorrida(params({ rota: "somente_corrida", periodo: "mensal" }))!;
    expect(r.hoje).toBe(1200);
    expect(r.recorrente).toBe(0);
  });

  it("prospect anual usa planoAnual com nota de parcelas", () => {
    const r = calcularResumoCorrida(params({ rota: "prospect", periodo: "anual", maxParcelas: 12 }))!;
    expect(r.hoje).toBe(1200);
    expect(r.linhas[0].nota).toContain("12x");
  });

  it("prospect mensal cobra o mensal hoje e define recorrente", () => {
    const r = calcularResumoCorrida(params({ rota: "prospect", periodo: "mensal" }))!;
    expect(r.hoje).toBe(120);
    expect(r.recorrente).toBe(120);
    expect(r.linhas[0].nota).toBe("recorrência mensal no cartão");
  });

  it("valores string do banco são convertidos com Number", () => {
    const r = calcularResumoCorrida(
      params({
        oferta: ofertaBase({
          planoAnual: { nome: "Corrida - Start", periodo_meses: 12, valor: "1200" as unknown as number },
        }),
      }),
    )!;
    expect(r.hoje).toBe(1200);
  });
});

describe("calcularResumoCorrida — cortesia", () => {
  const cortesia = item({ tipo: "cortesia_nb", descricao: "Inscrição NB", valor: 0 });

  it("cortesia entra com valor zero e não soma", () => {
    const r = calcularResumoCorrida(params({ oferta: ofertaBase({ cortesia }) }))!;
    const linha = r.linhas.find((l) => l.label.startsWith("Cortesia"))!;
    expect(linha.valor).toBe(0);
    expect(linha.label).toContain("21 de agosto de 2027");
    expect(r.hoje).toBe(1200);
  });

  it("cortesia respeita a distância escolhida", () => {
    const r = calcularResumoCorrida(
      params({ oferta: ofertaBase({ cortesia }), distanciaCortesia: "42K" as Distancia }),
    )!;
    expect(r.linhas[1].label).toContain("42K · 22 de agosto de 2027");
  });

  it("prospect mensal não recebe cortesia", () => {
    const r = calcularResumoCorrida(
      params({ oferta: ofertaBase({ cortesia }), rota: "prospect", periodo: "mensal" }),
    )!;
    expect(r.linhas.some((l) => l.label.startsWith("Cortesia"))).toBe(false);
  });

  it("prospect anual recebe cortesia", () => {
    const r = calcularResumoCorrida(
      params({ oferta: ofertaBase({ cortesia }), rota: "prospect", periodo: "anual" }),
    )!;
    expect(r.linhas.some((l) => l.label.startsWith("Cortesia"))).toBe(true);
  });
});

describe("calcularResumoCorrida — kit", () => {
  const kits = [
    item({ nivel: "1", descricao: "Kit Básico", valor: 150 }),
    item({ id: "i2", nivel: "2", descricao: "Kit Isento", valor: 300, isento: true }),
  ];

  it("kit pago soma ao total", () => {
    const r = calcularResumoCorrida(params({ oferta: ofertaBase({ kits }), kitNivel: "1" }))!;
    expect(r.hoje).toBe(1350);
    expect(r.linhas.at(-1)!.label).toBe("Kit Fortem — Kit Básico");
  });

  it("kit isento aparece com valor 0 e não soma", () => {
    const r = calcularResumoCorrida(params({ oferta: ofertaBase({ kits }), kitNivel: "2" }))!;
    expect(r.hoje).toBe(1200);
    expect(r.linhas.at(-1)!.valor).toBe(0);
  });

  it("kitNivel inexistente é ignorado", () => {
    const r = calcularResumoCorrida(params({ oferta: ofertaBase({ kits }), kitNivel: "9" }))!;
    expect(r.hoje).toBe(1200);
    expect(r.linhas).toHaveLength(1);
  });
});

describe("calcularResumoCorrida — MIPOA e avaliação", () => {
  const mipoaItem = item({ tipo: "mipoa", rota: "ambos", descricao: "Inscrição MIPOA", valor: 200 });
  const aval = item({ tipo: "avaliacao_funcional", tier: "start", descricao: "Avaliação Funcional", valor: 250 });

  it("MIPOA só soma quando selecionado", () => {
    expect(calcularResumoCorrida(params({ oferta: ofertaBase({ mipoaItem }) }))!.hoje).toBe(1200);
    const r = calcularResumoCorrida(params({ oferta: ofertaBase({ mipoaItem }), mipoa: true }))!;
    expect(r.hoje).toBe(1400);
    expect(r.linhas.at(-1)!.label).toContain("5 de junho de 2027");
  });

  it("MIPOA marcado sem item no catálogo não soma", () => {
    expect(calcularResumoCorrida(params({ mipoa: true }))!.hoje).toBe(1200);
  });

  it("avaliação soma valor cheio", () => {
    const r = calcularResumoCorrida(params({ oferta: ofertaBase({ aval }), avaliacao: true }))!;
    expect(r.hoje).toBe(1450);
    expect(r.linhas.at(-1)!.label).toBe("Avaliação Funcional");
  });

  it("avaliação isenta (valor 0) aparece sem somar", () => {
    const r = calcularResumoCorrida(
      params({ oferta: ofertaBase({ aval: item({ ...aval, valor: 0, isento: true }) }), avaliacao: true }),
    )!;
    expect(r.hoje).toBe(1200);
    expect(r.linhas.at(-1)!.valor).toBe(0);
  });

  it("avaliação sem descrição usa rótulo padrão", () => {
    const r = calcularResumoCorrida(
      params({ oferta: ofertaBase({ aval: item({ ...aval, descricao: null }) }), avaliacao: true }),
    )!;
    expect(r.linhas.at(-1)!.label).toBe("Avaliação Funcional");
  });
});

describe("calcularResumoCorrida — somente_provas", () => {
  const provaValor = (prova: ProvaKey, distancia: Distancia) =>
    item({ tipo: "prova_avulsa", prova_nome: prova, distancia, valor: prova === "NB" ? 180 : 220 });

  it("soma apenas as provas ativas", () => {
    const r = calcularResumoCorrida(
      params({
        rota: "somente_provas",
        oferta: ofertaBase({ provaValor }),
        provasSel: { NB: { ativo: true, distancia: "10K" }, MIPOA: { ativo: false, distancia: "5K" } },
      }),
    )!;
    expect(r.hoje).toBe(180);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].label).toContain("10K");
  });

  it("soma as duas provas quando ambas ativas", () => {
    const r = calcularResumoCorrida(
      params({
        rota: "somente_provas",
        oferta: ofertaBase({ provaValor }),
        provasSel: { NB: { ativo: true, distancia: "5K" }, MIPOA: { ativo: true, distancia: "42K" } },
      }),
    )!;
    expect(r.hoje).toBe(400);
    expect(r.linhas[1].label).toContain("6 de junho de 2027");
  });

  it("ignora prova ativa sem item no catálogo", () => {
    const r = calcularResumoCorrida(
      params({
        rota: "somente_provas",
        oferta: ofertaBase({ provaValor: () => undefined }),
        provasSel: { NB: { ativo: true, distancia: "5K" }, MIPOA: { ativo: true, distancia: "5K" } },
      }),
    )!;
    expect(r.hoje).toBe(0);
    expect(r.linhas).toHaveLength(0);
  });

  it("não cobra plano nem cortesia na rota somente_provas", () => {
    const r = calcularResumoCorrida(
      params({
        rota: "somente_provas",
        oferta: ofertaBase({ provaValor, cortesia: item({ tipo: "cortesia_nb", valor: 0 }) }),
        provasSel: { NB: { ativo: true, distancia: "5K" }, MIPOA: { ativo: false, distancia: "5K" } },
      }),
    )!;
    expect(r.hoje).toBe(180);
    expect(r.linhas.some((l) => l.label.startsWith("Cortesia"))).toBe(false);
  });
});

describe("calcularResumoCorrida — cenário completo", () => {
  it("soma plano + kit + MIPOA + avaliação com cortesia zerada", () => {
    const r = calcularResumoCorrida(
      params({
        oferta: ofertaBase({
          cortesia: item({ tipo: "cortesia_nb", descricao: "Inscrição NB", valor: 0 }),
          kits: [item({ nivel: "1", descricao: "Kit Básico", valor: 150 })],
          mipoaItem: item({ tipo: "mipoa", descricao: "Inscrição MIPOA", valor: 200 }),
          aval: item({ tipo: "avaliacao_funcional", descricao: "Avaliação Funcional", valor: 250 }),
        }),
        kitNivel: "1",
        mipoa: true,
        distanciaMipoa: "21K",
        avaliacao: true,
      }),
    )!;
    expect(r.linhas).toHaveLength(5);
    expect(r.hoje).toBe(1200 + 150 + 200 + 250);
    expect(r.recorrente).toBe(0);
    expect(r.hoje).toBe(r.linhas.reduce((acc, l) => acc + l.valor, 0));
  });

  it("prospect mensal completo mantém recorrente igual ao plano mensal", () => {
    const r = calcularResumoCorrida(
      params({
        rota: "prospect",
        periodo: "mensal",
        maxParcelas: 12,
        oferta: ofertaBase({
          planoMensal: { nome: "Corrida - Prospect", periodo_meses: 1, valor: 199 },
          kits: [item({ nivel: "1", descricao: "Kit Básico", valor: 150 })],
          aval: item({ tipo: "avaliacao_funcional", descricao: "AF", valor: 250 }),
        }),
        kitNivel: "1",
        avaliacao: true,
      }),
    )!;
    expect(r.recorrente).toBe(199);
    expect(r.hoje).toBe(199 + 150 + 250);
    expect(r.linhas[0].label).toBe("Assessoria de Corrida Fortem — Mensal");
  });
});
