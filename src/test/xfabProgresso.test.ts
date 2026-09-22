import { describe, it, expect } from "vitest";
import {
  sessoesConcluidasPar,
  statusPar,
  sessaoAuxiliar,
  alvoLevantamento,
  XFAB_SESSOES,
  XFAB_TOTAL_SESSOES,
  type XFabContagemTreinos,
  type XFabRm,
} from "@/lib/xfab";
import { contarSessoesXFab } from "@/pages/portal/PortalWorkouts";

const rm: XFabRm = { terra: 100, press: 60, agachamento: 120, supino: 80 };

describe("X-FAB · progresso por par", () => {
  it("conta só sessões concluídas de T1/T2/T3", () => {
    const counts = contarSessoesXFab([
      { variacao: "T1", concluido_em: "2026-01-01" },
      { variacao: "T1", concluido_em: "2026-01-03" },
      { variacao: "T2", concluido_em: null },
      { variacao: "T4", concluido_em: "2026-01-05" },
    ]);
    expect(counts).toEqual({ T1: 2, T2: 0, T3: 0 });
  });

  it("concluir T1 duas vezes avança pares A e B, não o C", () => {
    const counts: XFabContagemTreinos = { T1: 2, T2: 0, T3: 0 };
    expect(sessoesConcluidasPar(counts, "A")).toBe(2);
    expect(sessoesConcluidasPar(counts, "B")).toBe(2);
    expect(sessoesConcluidasPar(counts, "C")).toBe(0);

    const a = statusPar(counts, "A");
    expect(a.phase).toBe("regular");
    if (a.phase === "regular") expect(a.proxima.sessao).toBe(3);

    const c = statusPar(counts, "C");
    if (c.phase === "regular") expect(c.proxima.sessao).toBe(1);
  });

  it("par soma os dois treinos onde aparece", () => {
    const counts: XFabContagemTreinos = { T1: 1, T2: 2, T3: 3 };
    expect(sessoesConcluidasPar(counts, "A")).toBe(3); // T1+T2
    expect(sessoesConcluidasPar(counts, "B")).toBe(4); // T1+T3
    expect(sessoesConcluidasPar(counts, "C")).toBe(5); // T2+T3
  });

  it("par conclui após 12 sessões", () => {
    const counts: XFabContagemTreinos = { T1: 6, T2: 6, T3: 0 };
    expect(statusPar(counts, "A").phase).toBe("concluded");
    expect(statusPar(counts, "B").phase).toBe("regular");
  });

  it("auxiliares seguem a contagem do próprio treino", () => {
    const counts: XFabContagemTreinos = { T1: 4, T2: 0, T3: 0 };
    expect(sessaoAuxiliar(counts, 1)?.sessao).toBe(5);
    expect(sessaoAuxiliar(counts, 2)?.sessao).toBe(1);
    expect(sessaoAuxiliar(counts, 3)?.sessao).toBe(1);
    expect(sessaoAuxiliar({ T1: XFAB_TOTAL_SESSOES, T2: 0, T3: 0 }, 1)).toBeNull();
  });

  it("KG só nos levantamentos com 1RM; com * mostra alvo em RM", () => {
    const plano = XFAB_SESSOES[0]; // 2x5 @70% / 10RM
    expect(alvoLevantamento("Terra", plano, rm)).toEqual({ alvo: "2x5 @70%", kg: 70 });
    expect(alvoLevantamento("Pullup", plano, rm)).toEqual({ alvo: "2x5 @10RM", kg: null });
  });
});
