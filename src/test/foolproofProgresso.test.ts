import { describe, it, expect } from "vitest";
import {
  pesoInicialFP,
  incrementoFP,
  rm1PorLombardi,
  pesoHipertrofiaFP,
  definirRm1FP,
  registrarSessaoPrincipalFP,
  avancarFaseFP,
  proximaFaseFP,
  encerrarCicloFP,
  reabrirCicloFP,
  cicloConcluidoFP,
  alvoFP,
  alvoHipertrofiaFP,
  estadoVazioFP,
  normalizarLevantamentosFP,
  normalizarAuxiliaresFP,
  fpSlots,
  fpLevantamentosDoSlot,
  fpSlotTemPrincipal,
  isFoolproofContent,
  emptyFoolproof,
  ajustarDiasFP,
  type FPEstadoLevantamento,
} from "@/lib/foolproof";

function base(rm1: number, extra: Partial<FPEstadoLevantamento> = {}): FPEstadoLevantamento {
  const e = definirRm1FP(estadoVazioFP("Agachamento"), { tipo: "herdado", rm1 });
  return { ...e, ...extra };
}

describe("Foolproof — peso inicial e incremento", () => {
  it("peso inicial = 70% do 1RM, arredondado a 2,5 kg", () => {
    expect(pesoInicialFP(100)).toBe(70);
    expect(pesoInicialFP(143)).toBe(100); // 100,1 → 100
  });

  it("incremento = 2,5% do 1RM, mínimo 2,5 kg", () => {
    expect(incrementoFP(200)).toBe(5); // 5,0
    expect(incrementoFP(100)).toBe(2.5);
    expect(incrementoFP(40)).toBe(2.5); // 1,0 → mínimo
  });

  it("1RM novo por Lombardi reaproveita a equação do 1.0/2.0", () => {
    expect(rm1PorLombardi(100, 5)).toBeCloseTo(116.65, 2);
  });

  it("peso da hipertrofia é %1RM fixo", () => {
    expect(pesoHipertrofiaFP(100, 0.6)).toBe(60);
  });
});

describe("Foolproof — progressão automática", () => {
  it("cada sessão principal grava histórico e soma o incremento FIXO", () => {
    let e = base(200); // inicial 140, incremento 5
    expect(e.pesoAtual).toBe(140);
    expect(e.incremento).toBe(5);
    e = registrarSessaoPrincipalFP(e, "2026-09-22");
    expect(e.historico).toEqual([
      { data: "2026-09-22", semana: 1, peso: 140, fase: "5x5" },
    ]);
    expect(e.pesoAtual).toBe(145);
    e = registrarSessaoPrincipalFP(e, "2026-09-29");
    expect(e.pesoAtual).toBe(150);
    expect(e.historico[1].semana).toBe(2);
  });

  it("o incremento não é composto — é sempre a mesma fatia do 1RM original", () => {
    let e = base(200);
    for (let i = 0; i < 6; i++) e = registrarSessaoPrincipalFP(e, "2026-09-22");
    expect(e.pesoAtual).toBe(140 + 6 * 5);
  });

  it("avançar fase só muda o esquema; o peso continua", () => {
    let e = registrarSessaoPrincipalFP(base(200), "2026-09-22");
    e = avancarFaseFP(e);
    expect(e.fase).toBe("3x3");
    expect(alvoFP(e)).toEqual({ esquema: "3x3", peso: 145, concluido: false });
  });

  it("são 3 fases, sem teste", () => {
    expect(proximaFaseFP("5x5")).toBe("3x3");
    expect(proximaFaseFP("3x3")).toBe("2x2");
    expect(proximaFaseFP("2x2")).toBeNull();
  });
});

describe("Foolproof — encerramento manual", () => {
  it("encerrar ciclo sem 1RM final já conclui o levantamento", () => {
    const e = encerrarCicloFP(base(200), "2026-10-20");
    expect(cicloConcluidoFP(e)).toBe(true);
    expect(e.rm1Final).toBeNull();
    expect(registrarSessaoPrincipalFP(e, "2026-10-21")).toBe(e);
  });

  it("1RM final é opcional e pode ser registrado", () => {
    const e = encerrarCicloFP(base(200), "2026-10-20", 215);
    expect(e.rm1Final).toBe(215);
    expect(reabrirCicloFP(e).concluido).toBe(false);
  });
});

describe("Foolproof — slots e hipertrofia", () => {
  it("slots T1..Tn conforme os dias de treino", () => {
    expect(fpSlots(4)).toEqual(["T1", "T2", "T3", "T4"]);
    expect(fpSlots(99)).toHaveLength(6);
  });

  it("hipertrofia é fixa e não progride", () => {
    const e = base(200, {
      hipertrofia: { ativa: true, slot: "T2", series: 4, pct: 0.6 },
    });
    expect(alvoHipertrofiaFP(e)).toEqual({ esquema: "4x5", peso: 120 });
    const depois = registrarSessaoPrincipalFP(e, "2026-09-22");
    expect(alvoHipertrofiaFP(depois)).toEqual({ esquema: "4x5", peso: 120 });
  });

  it("vários levantamentos podem compartilhar o mesmo slot", () => {
    const c = emptyFoolproof(3);
    c.levantamentos = [
      base(200, { slotPrincipal: "T1", hipertrofia: { ativa: true, slot: "T3", series: 3, pct: 0.6 } }),
      { ...base(100), levantamento: "Supino", slotPrincipal: "T1" },
    ];
    expect(fpLevantamentosDoSlot(c, "T1").map((s) => s.tipo)).toEqual([
      "principal",
      "principal",
    ]);
    expect(fpLevantamentosDoSlot(c, "T3")).toHaveLength(1);
    expect(fpLevantamentosDoSlot(c, "T3")[0].tipo).toBe("hipertrofia");
    expect(fpSlotTemPrincipal(c, "T3")).toBe(false);
    expect(fpSlotTemPrincipal(c, "T1")).toBe(true);
  });
});

describe("Foolproof — estrutura", () => {
  it("mantém de 2 a 4 levantamentos", () => {
    expect(normalizarLevantamentosFP([], 3)).toHaveLength(2);
    expect(
      normalizarLevantamentosFP(
        ["Agachamento", "Terra", "Supino", "Press", "Remada Curvada"].map((l) =>
          estadoVazioFP(l as never),
        ),
        3,
      ),
    ).toHaveLength(4);
  });

  it("cada slot ganha 3 auxiliares", () => {
    const aux = normalizarAuxiliaresFP(undefined, 4);
    expect(Object.keys(aux)).toEqual(["T1", "T2", "T3", "T4"]);
    expect(aux.T1).toHaveLength(3);
  });

  it("mudar os dias reajusta slots e auxiliares", () => {
    const c = ajustarDiasFP(emptyFoolproof(3), 5);
    expect(c.diasTreinoSemana).toBe(5);
    expect(Object.keys(c.auxiliaresPorSlot)).toHaveLength(5);
  });

  it("detecta o conteúdo do método sem confundir com o 2.0", () => {
    expect(isFoolproofContent(emptyFoolproof())).toBe(true);
    expect(isFoolproofContent({ variante: "PTTP2" })).toBe(false);
  });
});
