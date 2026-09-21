import { describe, expect, it } from "vitest";
import type { FuncionalSnapshot } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { FORCA_EXERCICIO_LABEL } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import {
  deduplicarCadeias,
  agruparMedidasPortal,
  filtrarComparativoMudou,
  montarAneisPortal,
  montarMedidasPortal,
  montarResumoPortal,
  montarSelosInicio,
  type PortalMedida,
} from "@/components/portal/portalAssessmentLogic";

const snapshot = (ombroE: number, ombroD: number, psoasE = 2, psoasD = 3): FuncionalSnapshot => ({
  data: "2026-09-21",
  metricas: [
    { metric: "Mobilidade Ombro RI", left: ombroE, right: ombroD, leftClass: null, rightClass: null },
    { metric: "Flexibilidade Psoas", left: psoasE, right: psoasD, leftClass: null, rightClass: null },
  ],
  forca: [],
});

const medida = (overrides: Partial<PortalMedida> & Pick<PortalMedida, "id" | "diferenca" | "razaoSevero">): PortalMedida => ({
  origem: overrides.id,
  nome: overrides.id,
  camada: "mobilidade",
  esquerdo: 10,
  direito: 10 + overrides.diferenca,
  unidadeLados: "°",
  unidadeDiferenca: "%",
  nivel: "equilibrado",
  nivelMotor: "nenhuma",
  ...overrides,
});

describe("Resumo do portal de avaliações", () => {
  it("monta a frase com pontos e maior diferença", () => {
    const resumo = montarResumoPortal(montarMedidasPortal(snapshot(60, 90)));
    expect(resumo.titulo).toBe("1 ponto para acompanhar");
    expect(resumo.frase).toContain("Ombro · Rotação Interna");
    expect(resumo.frase).toContain("A outra medida está equilibrada.");
  });

  it("monta a frase de tudo equilibrado", () => {
    expect(montarResumoPortal(montarMedidasPortal(snapshot(90, 92)))).toEqual({
      titulo: "Tudo equilibrado",
      frase: "Nenhuma medida mostrou diferença importante entre os lados.",
      pontos: 0,
      equilibradas: 2,
    });
  });

  it("conta os anéis por camada e mantém força sem dado", () => {
    expect(montarAneisPortal(montarMedidasPortal(snapshot(60, 90)))).toEqual([
      { camada: "mobilidade", label: "Mobilidade", pontos: 1, total: 1, piorNivel: "prioridade" },
      { camada: "flexibilidade", label: "Flexibilidade", pontos: 0, total: 1, piorNivel: "equilibrado" },
      { camada: "forca", label: "Força", pontos: 0, total: 0, piorNivel: null },
    ]);
  });

  it("remove cadeias repetidas pelo texto", () => {
    const chains = deduplicarCadeias([
      { from: "thoracic", to: "shoulder-l", reason: "Mobilidade torácica reduzida tende a comprometer o ombro." },
      { from: "thoracic", to: "shoulder-r", reason: "Mobilidade torácica reduzida tende a comprometer o ombro." },
    ]);
    expect(chains).toHaveLength(1);
  });

  it("comparativo mantém somente medidas que mudaram", () => {
    const anterior = snapshot(60, 80, 2, 3);
    const atual = snapshot(65, 80, 2, 3);
    const comparativo = filtrarComparativoMudou(anterior, atual);
    expect(comparativo.mobilidade.map((row) => row.metric)).toEqual(["Mobilidade Ombro RI"]);
    expect(comparativo.mobilidadeSemMudanca).toBe(1);
    expect(comparativo.forca).toEqual([]);
  });

  it("distingue e agrupa o mesmo movimento em mobilidade e força", () => {
    const comForca: FuncionalSnapshot = {
      ...snapshot(60, 90),
      forca: [{ nome: "rotacao_interna", esquerdo_kg: 8, direito_kg: 10 }],
    };
    const grupos = agruparMedidasPortal(montarMedidasPortal(comForca));
    const mobilidade = grupos.find((grupo) => grupo.camada === "mobilidade")?.medidas[0];
    const forca = grupos.find((grupo) => grupo.camada === "forca")?.medidas[0];
    expect(mobilidade).toMatchObject({ nome: "Ombro · Rotação Interna", camada: "mobilidade", unidadeLados: "°" });
    expect(forca).toMatchObject({ nome: FORCA_EXERCICIO_LABEL.rotacao_interna, camada: "forca", unidadeLados: "kg" });
  });

  it("deixa explícita a camada quando a maior diferença é de força", () => {
    const comForca: FuncionalSnapshot = {
      ...snapshot(90, 92),
      forca: [{ nome: "abducao_quadril", esquerdo_kg: 6, direito_kg: 10 }],
    };
    expect(montarResumoPortal(montarMedidasPortal(comForca)).frase).toContain("Força · Abdução de quadril");
  });

  it("escolhe a pior medida pela régua normalizada misturando graus e percentual", () => {
    const medidas = [
      medida({ id: "ombro", diferenca: 22, razaoSevero: 1.1, nivel: "prioridade", nivelMotor: "severa" }),
      medida({ id: "Psoas", diferenca: 6, razaoSevero: 1.2, unidadeDiferenca: "°", camada: "flexibilidade", nivel: "prioridade", nivelMotor: "severa" }),
    ];
    expect(montarSelosInicio(medidas).atencao.medida?.id).toBe("Psoas");
  });

  it("informa quando não há nenhum ponto de atenção", () => {
    expect(montarSelosInicio([medida({ id: "ombro", diferenca: 4, razaoSevero: 0.2 })]).atencao).toMatchObject({
      texto: "Nenhum ponto de atenção",
      medida: null,
      nivel: "equilibrado",
    });
  });

  it("escolhe uma única medida mais equilibrada", () => {
    const selos = montarSelosInicio([
      medida({ id: "ombro", diferenca: 4, razaoSevero: 0.2 }),
      medida({ id: "quadril", diferenca: 2, razaoSevero: 0.1 }),
    ]);
    expect(selos.equilibrado.medida?.id).toBe("quadril");
  });

  it("resume empate em zero sem escolher uma medida", () => {
    const selo = montarSelosInicio([
      medida({ id: "ombro", diferenca: 0, razaoSevero: 0 }),
      medida({ id: "quadril", diferenca: 0, razaoSevero: 0 }),
    ]).equilibrado;
    expect(selo).toMatchObject({ texto: "2 medidas sem diferença entre os lados", medida: null, quantidade: 2 });
  });

  it("resume empate fora de zero sem escolher uma medida", () => {
    const selo = montarSelosInicio([
      medida({ id: "ombro", diferenca: 2, razaoSevero: 0.1 }),
      medida({ id: "quadril", diferenca: 1, razaoSevero: 0.1 }),
    ]).equilibrado;
    expect(selo).toMatchObject({ texto: "2 medidas igualmente equilibradas", medida: null, quantidade: 2 });
  });

  it("usa nos selos a mesma contagem de pontos do resumo", () => {
    const medidas = montarMedidasPortal(snapshot(60, 90, 2, 8));
    const selos = montarSelosInicio(medidas);
    expect(medidas.filter((item) => item.nivel !== "equilibrado")).toHaveLength(montarResumoPortal(medidas).pontos);
    expect(selos.atencao.medida).toBe(medidas.find((item) => item.nivel !== "equilibrado"));
  });
});