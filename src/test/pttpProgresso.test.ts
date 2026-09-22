import { describe, it, expect } from "vitest";
import {
  lombardi,
  pesoAposSucesso,
  pesoAposFalha,
  descontoAposFalha,
  registrarResultadoPTTP,
  recuarPorTreinoPulado,
  entrarManutencao,
  alvoPTTP,
  estadoVazioPTTP,
  normalizarTreinosPTTP,
  isPTTPContent,
  emptyPTTP,
  PTTP_SERIES_MANUTENCAO,
  type PTTPEstadoLevantamento,
} from "@/lib/pttp";

function base(peso: number, extra: Partial<PTTPEstadoLevantamento> = {}): PTTPEstadoLevantamento {
  return { ...estadoVazioPTTP("Agachamento"), pesoAtual: peso, ...extra };
}

describe("Power to the People — peso inicial", () => {
  it("Lombardi: 100 kg × 5 reps → E1RM 116,65 e peso inicial arredondado", () => {
    const r = lombardi(100, 5);
    expect(r.y).toBe(500);
    expect(r.x).toBeCloseTo(16.65, 2);
    expect(r.e1rm).toBeCloseTo(116.65, 2);
    expect(r.rm5).toBeCloseTo(99.1525, 3);
    // 99,1525 × 0,80 = 79,322 → 80
    expect(r.pesoInicial).toBe(80);
  });
});

describe("Power to the People — progressão", () => {
  it("sucesso sobe 2,5% arredondado a 2,5 kg", () => {
    expect(pesoAposSucesso(100)).toBe(102.5); // 2,5% = 2,5
    expect(pesoAposSucesso(200)).toBe(205); // 2,5% = 5
  });

  it("incremento nunca é menor que 2,5 kg", () => {
    expect(pesoAposSucesso(40)).toBe(42.5); // 2,5% = 1 → mínimo 2,5
  });

  it("falha antes de 8 sessões desconta 15%; depois, 12,5%", () => {
    expect(descontoAposFalha(3)).toBe(0.15);
    expect(descontoAposFalha(8)).toBe(0.125);
    expect(pesoAposFalha(100, 3)).toBe(85);
    expect(pesoAposFalha(100, 10)).toBe(87.5);
  });

  it("registra sucesso no histórico e avança a contagem", () => {
    const e = registrarResultadoPTTP(base(100), true, "2026-09-22");
    expect(e.historico).toEqual([{ data: "2026-09-22", peso: 100, sucesso: true }]);
    expect(e.sessoesDesdeReset).toBe(1);
    expect(e.pesoAtual).toBe(102.5);
  });

  it("registra falha, desconta e zera a contagem", () => {
    const e = registrarResultadoPTTP(base(100, { sessoesDesdeReset: 4 }), false, "2026-09-22");
    expect(e.historico[0].sucesso).toBe(false);
    expect(e.sessoesDesdeReset).toBe(0);
    expect(e.pesoAtual).toBe(85);
  });

  it("levantamento em manutenção não avança nem grava histórico", () => {
    const m = entrarManutencao(base(100));
    const e = registrarResultadoPTTP(m, true, "2026-09-22");
    expect(e).toBe(m);
    expect(alvoPTTP(m)).toEqual({ esquema: PTTP_SERIES_MANUTENCAO, peso: 100 });
  });

  it("'Pulei um treino' volta ao peso de 2 sessões atrás sem mexer na contagem", () => {
    let e = base(100);
    e = registrarResultadoPTTP(e, true, "2026-09-01"); // hist: 100 → peso 102,5
    e = registrarResultadoPTTP(e, true, "2026-09-03"); // hist: 102,5 → peso 105
    e = registrarResultadoPTTP(e, true, "2026-09-05"); // hist: 105 → peso 107,5
    expect(e.pesoAtual).toBe(107.5);
    const r = recuarPorTreinoPulado(e);
    expect(r.pesoAtual).toBe(102.5);
    expect(r.sessoesDesdeReset).toBe(e.sessoesDesdeReset);
  });
});

describe("Power to the People — estrutura", () => {
  it("normaliza a quantidade de treinos conforme a frequência, com 3 auxiliares", () => {
    const t = normalizarTreinosPTTP(undefined, 5);
    expect(t.map((x) => x.ordem)).toEqual([1, 2, 3, 4, 5]);
    expect(t.every((x) => x.auxiliares.length === 3)).toBe(true);
  });

  it("detecta o conteúdo do método", () => {
    expect(isPTTPContent(emptyPTTP())).toBe(true);
    expect(isPTTPContent({ variante: "XFAB" })).toBe(false);
  });
});
