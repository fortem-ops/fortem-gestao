import { describe, it, expect } from "vitest";
import {
  classificarAssimetria,
  nivelAssimetria,
  severidadeAssimetriaClinica,
  arrayReferencia,
  criarReferenciaFaixas,
  percentilMobilidade,
  contarAssimetriasPorFaixa,
  buildMetricAttentionList,
  classifyForca,
  analyze,
  applyForcaToRegions,
  type BodyMapAnalysis,
  type MetricInput,
  type MobilidadeReferenceData,
  type ReferenciaFaixas,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { faixaEtariaDe, sexoDe } from "@/lib/faixaEtaria";
import {
  calcularTendenciaAssimetria,
  avaliarAssimetriaNoSnapshot,
  compararPreocupacaoAssimetria,
  houveInversaoLado,
  ladoMaisFracoForca,
  ladoMaisFracoMetrica,
  razaoSeveroAssimetria,
  type AssimetriaResumoEvolucao,
} from "@/components/avaliacoes-premium/assimetriaGrafico";
import {
  movimentoFaixa,
  movimentoForca,
  ordenarForcaComparativo,
  ordenarMobilidadeComparativo,
  tomVariacaoMobilidade,
  variacaoForcaPct,
  type LinhaForcaComparativo,
  type LinhaMobilidadeComparativo,
} from "@/components/avaliacoes-premium/comparativoValores";

const PSOAS = "Flexibilidade Psoas";
const OMBRO = "Mobilidade Ombro RI";

/** Sequência ordenada de `n` valores começando em `inicio` (base de referência sintética). */
function serie(n: number, inicio = 1): number[] {
  return Array.from({ length: n }, (_, i) => inicio + i);
}

function faixas(parcial: Partial<ReferenciaFaixas>): ReferenciaFaixas {
  return { ...criarReferenciaFaixas(), ...parcial };
}

function refMobilidade(metric: string, bucket: ReferenciaFaixas): MobilidadeReferenceData {
  return { [metric]: { M: bucket, F: bucket } };
}

/**
 * Métrica lançada com classificação nos dois lados — sem classificação e sem
 * base de percentil o motor ignora a métrica (comportamento esperado).
 */
function metrica(metric: string, left: number | null, right: number | null): MetricInput {
  return { metric, left, right, leftClass: "Bom", rightClass: "Médio" };
}

describe("Assimetria: régua da própria métrica", () => {
  it("métrica percentual com 100 e 80 tem 20% de assimetria", () => {
    const info = classificarAssimetria(OMBRO, 100, 80);
    expect(info).toEqual({ valor: 20, unidade: "%", absoluta: false, nivel: "moderada" });
  });

  it("Psoas com 1° e 2° não é assimetria — é 1°, não 50%", () => {
    const info = classificarAssimetria(PSOAS, 1, 2);
    expect(info).toEqual({ valor: 1, unidade: "°", absoluta: true, nivel: "nenhuma" });
  });

  it("Psoas: diferença de 2,9° ainda não é assimetria", () => {
    expect(classificarAssimetria(PSOAS, 0, 2.9)!.nivel).toBe("nenhuma");
  });

  it("Psoas: diferença de 3° já é moderada (limiar inclusivo)", () => {
    expect(classificarAssimetria(PSOAS, 0, 3)!.nivel).toBe("moderada");
  });

  it("Psoas: diferença de 5° continua moderada (limiar severo exclusivo)", () => {
    expect(classificarAssimetria(PSOAS, 2, 7)!.nivel).toBe("moderada");
  });

  it("Psoas: diferença de 5,1° é severa", () => {
    expect(classificarAssimetria(PSOAS, 2, 7.1)!.nivel).toBe("severa");
  });

  it("falta um dos lados: não há assimetria a calcular", () => {
    expect(classificarAssimetria(OMBRO, 100, null)).toBeNull();
    expect(classificarAssimetria(OMBRO, null, 80)).toBeNull();
    expect(classificarAssimetria(OMBRO, 100, undefined)).toBeNull();
  });

  it("dois lados zerados não geram divisão por zero", () => {
    const info = classificarAssimetria(OMBRO, 0, 0);
    expect(info).toEqual({ valor: 0, unidade: "%", absoluta: false, nivel: "nenhuma" });
  });
});

describe("Assimetria: limiar único de 10% e 20%", () => {
  it("percentual: 10% já é moderada, 9,9% ainda não é", () => {
    expect(nivelAssimetria(OMBRO, 9.9)).toBe("nenhuma");
    expect(nivelAssimetria(OMBRO, 10)).toBe("moderada");
  });

  it("percentual: 20% ainda é moderada, 20,1% é severa", () => {
    expect(nivelAssimetria(OMBRO, 20)).toBe("moderada");
    expect(nivelAssimetria(OMBRO, 20.1)).toBe("severa");
  });

  it("o que é detectado como assimetria usa exatamente os mesmos 10% e 20% da cor", () => {
    expect(severidadeAssimetriaClinica(OMBRO, 9.9)).toBeNull();
    expect(severidadeAssimetriaClinica(OMBRO, 10)).toBe("moderate");
    expect(severidadeAssimetriaClinica(OMBRO, 15)).toBe("moderate");
    expect(severidadeAssimetriaClinica(OMBRO, 20)).toBe("moderate");
    expect(severidadeAssimetriaClinica(OMBRO, 20.1)).toBe("severe");
    expect(severidadeAssimetriaClinica(OMBRO, 25)).toBe("severe");
  });

  it("Psoas continua em 3° e 5°, nas duas leituras", () => {
    expect(nivelAssimetria(PSOAS, 2.9)).toBe("nenhuma");
    expect(nivelAssimetria(PSOAS, 3)).toBe("moderada");
    expect(nivelAssimetria(PSOAS, 5)).toBe("moderada");
    expect(nivelAssimetria(PSOAS, 5.1)).toBe("severa");
    expect(severidadeAssimetriaClinica(PSOAS, 2.9)).toBeNull();
    expect(severidadeAssimetriaClinica(PSOAS, 3)).toBe("moderate");
    expect(severidadeAssimetriaClinica(PSOAS, 5)).toBe("moderate");
    expect(severidadeAssimetriaClinica(PSOAS, 5.1)).toBe("severe");
  });
});

describe("Escolha da base de comparação por faixa etária", () => {
  it("faixa com 15 amostras é usada em vez da base geral", () => {
    const bucket = faixas({ "18-29": serie(15, 100), todos: serie(50) });
    expect(arrayReferencia(bucket, "18-29")).toEqual(serie(15, 100));
  });

  it("faixa com 14 amostras é pouca — cai na base geral", () => {
    const bucket = faixas({ "18-29": serie(14, 100), todos: serie(50) });
    expect(arrayReferencia(bucket, "18-29")).toEqual(serie(50));
  });

  it("aluno sem faixa etária usa a base geral", () => {
    const bucket = faixas({ "18-29": serie(30, 100), todos: serie(50) });
    expect(arrayReferencia(bucket, null)).toEqual(serie(50));
  });

  it("base geral com menos de 15 amostras não é usada", () => {
    expect(arrayReferencia(faixas({ todos: serie(14) }), null)).toBeNull();
    expect(arrayReferencia(undefined, "18-29")).toBeNull();
  });
});

describe("Percentil na base Fortem", () => {
  const bucket = faixas({ todos: serie(20) });

  it("valor no meio da base fica no meio da distribuição", () => {
    expect(percentilMobilidade(OMBRO, "M", 10, refMobilidade(OMBRO, bucket))).toBe(50);
  });

  it("pior valor da base fica embaixo e o melhor no topo", () => {
    expect(percentilMobilidade(OMBRO, "M", 1, refMobilidade(OMBRO, bucket))).toBe(5);
    expect(percentilMobilidade(OMBRO, "M", 20, refMobilidade(OMBRO, bucket))).toBe(100);
  });

  it("no Psoas, valor menor é melhor: 2° dá percentil alto", () => {
    expect(percentilMobilidade(PSOAS, "M", 2, refMobilidade(PSOAS, bucket))).toBe(90);
    expect(percentilMobilidade(PSOAS, "M", 19, refMobilidade(PSOAS, bucket))).toBe(5);
  });

  it("base curta demais não gera percentil", () => {
    const curta = faixas({ todos: serie(10) });
    expect(percentilMobilidade(OMBRO, "M", 5, refMobilidade(OMBRO, curta))).toBeNull();
    expect(percentilMobilidade(OMBRO, "M", 5, undefined)).toBeNull();
    expect(percentilMobilidade(OMBRO, "M", null, refMobilidade(OMBRO, bucket))).toBeNull();
  });

  it("mesmo valor em faixas etárias diferentes dá percentis diferentes", () => {
    const porFaixa = faixas({ "18-29": serie(20), "30-44": serie(20, 101), todos: serie(20) });
    const ref = refMobilidade(OMBRO, porFaixa);
    expect(percentilMobilidade(OMBRO, "M", 10, ref, "18-29")).toBe(50);
    expect(percentilMobilidade(OMBRO, "M", 10, ref, "30-44")).toBe(0);
  });

});

describe("Contagem de assimetrias", () => {
  it("cada item é contado pela régua da sua própria métrica", () => {
    const contagem = contarAssimetriasPorFaixa([
      { metric: PSOAS, diff: 4 },
      { metric: PSOAS, diff: 6 },
      { metric: OMBRO, diff: 4 },
      { metric: OMBRO, diff: 25 },
    ]);
    expect(contagem).toEqual({ alta: 2, moderada: 1, baixa: 1, total: 4 });
  });

  it("Psoas de 4° não é assimetria baixa só por ser menor que 10", () => {
    expect(contarAssimetriasPorFaixa([{ metric: PSOAS, diff: 4 }])).toEqual({
      alta: 0,
      moderada: 1,
      baixa: 0,
      total: 1,
    });
  });
});

describe("Lista de atenção", () => {
  it("Psoas severo de 6° vem antes de percentual moderado de 18%", () => {
    const analysis = {
      metricAsymmetries: [
        { metric: OMBRO, diff: 18, unidade: "%" as const, absoluta: false, asymPercentile: null },
        { metric: PSOAS, diff: 6, unidade: "°" as const, absoluta: true, asymPercentile: null },
      ],
    } as unknown as BodyMapAnalysis;
    const lista = buildMetricAttentionList(analysis);
    expect(lista.map((i) => i.metric)).toEqual([PSOAS, OMBRO]);
    expect(lista[0].unidade).toBe("°");
    expect(lista[1].unidade).toBe("%");
  });
});

describe("Análise completa do mapa corporal", () => {
  it("assimetria de Psoas sai em graus e não consulta a base de percentil", () => {
    const analysis = analyze(
      [metrica(PSOAS, 2, 6)],
      "flexibility",
      undefined,
      "M",
      refMobilidade(PSOAS, faixas({ todos: serie(20) })),
      "30-44",
    );
    const item = analysis.metricAsymmetries.find((a) => a.metric === PSOAS)!;
    expect(item.diff).toBe(4);
    expect(item.unidade).toBe("°");
    expect(item.absoluta).toBe(true);
    expect(item.asymPercentile).toBeNull();
  });

  it("métrica percentual com sexo e base usa o percentil da base", () => {
    const analysis = analyze(
      [metrica(OMBRO, 100, 80)],
      "mobility",
      undefined,
      "M",
      refMobilidade(OMBRO, faixas({ todos: serie(20) })),
      null,
    );
    const item = analysis.metricAsymmetries.find((a) => a.metric === OMBRO)!;
    expect(item.unidade).toBe("%");
    expect(item.diff).toBe(20);
    expect(item.asymPercentile).toBeNull();
    expect(analysis.asymmetries[0].severity).toBe("moderate");
  });

  it("sem sexo e sem base, a classificação é a mesma", () => {
    const analysis = analyze([metrica(OMBRO, 100, 80)], "mobility");
    const item = analysis.metricAsymmetries.find((a) => a.metric === OMBRO)!;
    expect(item.diff).toBe(20);
    expect(item.asymPercentile).toBeNull();
    expect(analysis.asymmetries[0].severity).toBe("moderate");
  });

  it("a base Fortem não altera a classificação de assimetria", () => {
    const metricas = [metrica(OMBRO, 100, 70), metrica(PSOAS, 2, 6)];
    const comBase = analyze(
      metricas,
      "asymmetry",
      undefined,
      "F",
      refMobilidade(OMBRO, faixas({ todos: serie(20) })),
      "45+",
    );
    const semBase = analyze(metricas, "asymmetry");

    const severidades = (a: typeof comBase) =>
      a.asymmetries.map((x) => `${x.region}:${x.severity}:${x.diff.toFixed(2)}${x.unidade}`).sort();
    expect(severidades(comBase)).toEqual(severidades(semBase));
    expect(comBase.metricAsymmetries.every((m) => m.asymPercentile === null)).toBe(true);
  });
});

describe("Camada de força sobre o mapa", () => {
  it("força sobrescreve a unidade da região, mesmo onde havia Psoas em graus", () => {
    const base = analyze([metrica(PSOAS, 2, 6)], "flexibility");
    expect(base.regions["quad-l"].asymmetryUnit).toBe("°");

    const comForca = applyForcaToRegions(base, [
      { nome: "extensao_joelho", direito_kg: 100, esquerdo_kg: 70 },
    ]);
    expect(comForca.regions["quad-l"].asymmetryUnit).toBe("%");
    expect(comForca.regions["quad-r"].asymmetryUnit).toBe("%");
    expect(comForca.regions["quad-l"].asymmetry).toBe(30);
  });
});

describe("Faixa etária e sexo do cadastro", () => {
  const hoje = new Date("2026-09-16T12:00:00Z");

  it("menor de 18 não entra em nenhuma faixa", () => {
    expect(faixaEtariaDe("2009-09-17", hoje)).toBeNull();
  });

  it("aos 18 entra na faixa 18-29 e aos 29 ainda está nela", () => {
    expect(faixaEtariaDe("2008-09-16", hoje)).toBe("18-29");
    expect(faixaEtariaDe("1997-09-16", hoje)).toBe("18-29");
  });

  it("aos 30 passa para 30-44 e aos 44 ainda está nela", () => {
    expect(faixaEtariaDe("1996-09-16", hoje)).toBe("30-44");
    expect(faixaEtariaDe("1982-09-16", hoje)).toBe("30-44");
  });

  it("aos 45 passa para a faixa 45+", () => {
    expect(faixaEtariaDe("1981-09-16", hoje)).toBe("45+");
  });

  it("cadastro sem data de nascimento não tem faixa", () => {
    expect(faixaEtariaDe(null, hoje)).toBeNull();
    expect(faixaEtariaDe(undefined, hoje)).toBeNull();
  });

  it("sexo do cadastro é normalizado pelo início do texto", () => {
    expect(sexoDe("masculino")).toBe("M");
    expect(sexoDe("feminino")).toBe("F");
    expect(sexoDe("M")).toBe("M");
    expect(sexoDe("F")).toBe("F");
    expect(sexoDe(null)).toBeUndefined();
    expect(sexoDe("outro")).toBeUndefined();
  });
});

describe("Evolução de assimetrias", () => {
  it("lado mais fraco em goniometria é o de menor amplitude", () => {
    expect(ladoMaisFracoMetrica(OMBRO, 90, 110)).toBe("esquerdo");
    expect(ladoMaisFracoMetrica(OMBRO, 120, 100)).toBe("direito");
  });

  it("lado mais fraco respeita métrica invertida como o Psoas", () => {
    expect(ladoMaisFracoMetrica(PSOAS, 8, 3)).toBe("esquerdo");
    expect(ladoMaisFracoMetrica(PSOAS, 2, 7)).toBe("direito");
  });

  it("lado mais fraco em força é o de menor kg", () => {
    expect(ladoMaisFracoForca(42, 50)).toBe("esquerdo");
    expect(ladoMaisFracoForca(60, 55)).toBe("direito");
    expect(ladoMaisFracoForca(60, 60)).toBe("sem_diferenca");
  });

  it("inversão compara apenas lados válidos e ignora sem diferença", () => {
    expect(houveInversaoLado("esquerdo", "direito")).toBe(true);
    expect(houveInversaoLado("direito", "direito")).toBe(false);
    expect(houveInversaoLado("sem_diferenca", "direito")).toBe(false);
    expect(houveInversaoLado(null, "esquerdo")).toBe(false);
  });

  it("tendência percentual usa corte de estabilidade menor que 1 pp", () => {
    expect(calcularTendenciaAssimetria(-1, "%")).toBe("melhorou");
    expect(calcularTendenciaAssimetria(1, "%")).toBe("piorou");
    expect(calcularTendenciaAssimetria(0.9, "%")).toBe("estavel");
    expect(calcularTendenciaAssimetria(-0.9, "%")).toBe("estavel");
  });

  it("tendência em graus usa corte de estabilidade menor que 0,5°", () => {
    expect(calcularTendenciaAssimetria(-0.5, "°")).toBe("melhorou");
    expect(calcularTendenciaAssimetria(0.5, "°")).toBe("piorou");
    expect(calcularTendenciaAssimetria(0.4, "°")).toBe("estavel");
    expect(calcularTendenciaAssimetria(-0.4, "°")).toBe("estavel");
  });

  it("ordenação prioriza severidade e depois valor normalizado pelo corte severo", () => {
    const resumo = (
      nome: string,
      nivel: "nenhuma" | "moderada" | "severa",
      valor: number,
      metric?: string,
    ) =>
      ({
        nome,
        ultima: { nivel, valor },
        razaoSeveroAtual: razaoSeveroAssimetria(metric, valor),
      }) as Pick<AssimetriaResumoEvolucao, "ultima" | "razaoSeveroAtual" | "nome">;

    const itens = [
      resumo("normal alto", "nenhuma", 9),
      resumo("psoas moderado", "moderada", 4, PSOAS),
      resumo("percentual moderado alto", "moderada", 18),
      resumo("severo", "severa", 21),
    ];

    expect([...itens].sort(compararPreocupacaoAssimetria).map((i) => i.nome)).toEqual([
      "severo",
      "percentual moderado alto",
      "psoas moderado",
      "normal alto",
    ]);
  });

  it("valor de assimetria de força usa a mesma fórmula de classifyForca", () => {
    const pares = [
      { direito: 100, esquerdo: 80 },
      { direito: 82.5, esquerdo: 91.2 },
      { direito: 0, esquerdo: 0 },
      { direito: 45, esquerdo: 0 },
    ];

    pares.forEach(({ direito, esquerdo }) => {
      const ponto = avaliarAssimetriaNoSnapshot(
        {
          data: "2026-09-21",
          metricas: [],
          forca: [{ nome: "extensao_joelho", direito_kg: direito, esquerdo_kg: esquerdo }],
        },
        {
          key: "assimetria:forca:extensao_joelho",
          label: "Extensão de joelho (%)",
          tipo: "forca",
          origem: "extensao_joelho",
          unidade: "%",
        },
      );

      expect(ponto?.valor).toBe(Number(classifyForca(direito, esquerdo).assimetria.toFixed(1)));
    });
  });
});

describe("Comparativo de valores", () => {
  it("movimento de faixa identifica subida, queda e igualdade", () => {
    expect(movimentoFaixa("Regular", "Bom")).toBe("subiu");
    expect(movimentoFaixa("Excelente", "Médio")).toBe("caiu");
    expect(movimentoFaixa("Bom", "Bom")).toBe("igual");
    expect(movimentoFaixa(null, "Bom")).toBeNull();
  });

  it("cor da variação respeita métrica comum", () => {
    expect(tomVariacaoMobilidade(OMBRO, 5)).toBe("melhora");
    expect(tomVariacaoMobilidade(OMBRO, -5)).toBe("piora");
    expect(tomVariacaoMobilidade(OMBRO, 0)).toBe("neutro");
  });

  it("cor da variação respeita métrica invertida", () => {
    expect(tomVariacaoMobilidade(PSOAS, -1)).toBe("melhora");
    expect(tomVariacaoMobilidade(PSOAS, 1)).toBe("piora");
  });

  it("variação de força usa corte provisório de 5%", () => {
    expect(variacaoForcaPct(100, 105)).toBe(5);
    expect(movimentoForca(5)).toBe("Ganhou força");
    expect(movimentoForca(-5)).toBe("Perdeu força");
    expect(movimentoForca(4.9)).toBe("Estável");
    expect(movimentoForca(-4.9)).toBe("Estável");
    expect(variacaoForcaPct(0, 10)).toBeNull();
  });

  it("ordenação de mobilidade prioriza queda, subida e depois ordem canônica", () => {
    const linha = (metric: string, ordem: number, resumo: LinhaMobilidadeComparativo["resumo"]) =>
      ({ metric, label: metric, ordem, resumo }) as LinhaMobilidadeComparativo;

    const rows = [
      linha("sem mudança cedo", 0, "Sem mudança"),
      linha("subiu tarde", 7, "Subiu de faixa"),
      linha("caiu tarde", 8, "Caiu de faixa"),
      linha("subiu cedo", 1, "Subiu de faixa"),
      linha("caiu cedo", 2, "Caiu de faixa"),
    ];

    expect(ordenarMobilidadeComparativo(rows).map((row) => row.metric)).toEqual([
      "caiu cedo",
      "caiu tarde",
      "subiu cedo",
      "subiu tarde",
      "sem mudança cedo",
    ]);
  });

  it("ordenação de força prioriza perda, ganho e estabilidade", () => {
    const linha = (label: string, resumo: LinhaForcaComparativo["resumo"]) =>
      ({ nome: label, label, resumo }) as LinhaForcaComparativo;

    const rows = [
      linha("Z estável", "Estável"),
      linha("B ganhou", "Ganhou força"),
      linha("C perdeu", "Perdeu força"),
      linha("A ganhou", "Ganhou força"),
      linha("A perdeu", "Perdeu força"),
    ];

    expect(ordenarForcaComparativo(rows).map((row) => row.label)).toEqual([
      "A perdeu",
      "C perdeu",
      "A ganhou",
      "B ganhou",
      "Z estável",
    ]);
  });
});
