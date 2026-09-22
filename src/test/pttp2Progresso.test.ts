import { describe, it, expect } from "vitest";
import {
  pesoInicialPTTP2,
  limitarPercentualPTTP2,
  rm5PorLombardi,
  registrarSessaoPTTP2,
  avancarFasePTTP2,
  registrarTestePTTP2,
  limparTestePTTP2,
  cicloConcluidoPTTP2,
  alvoPTTP2,
  estadoVazioPTTP2,
  normalizarLevantamentosPTTP2,
  normalizarTreinosPTTP2,
  rm1TestadosPTTP2,
  isPTTP2Content,
  emptyPTTP2,
  proximaFasePTTP2,
  type PTTP2EstadoLevantamento,
} from "@/lib/pttp2";

function base(peso: number, extra: Partial<PTTP2EstadoLevantamento> = {}): PTTP2EstadoLevantamento {
  return { ...estadoVazioPTTP2("Agachamento"), pesoAtual: peso, ...extra };
}

describe("PTTP 2.0 — peso inicial", () => {
  it("peso inicial = 5RM × percentual, arredondado a 2,5 kg", () => {
    expect(pesoInicialPTTP2(100, 0.85)).toBe(85);
    expect(pesoInicialPTTP2(100, 0.9)).toBe(90);
    expect(pesoInicialPTTP2(103, 0.875)).toBe(90); // 90,125 → 90
  });

  it("percentual fora da faixa é limitado a 85-90%", () => {
    expect(limitarPercentualPTTP2(0.5)).toBe(0.85);
    expect(limitarPercentualPTTP2(1.2)).toBe(0.9);
    expect(limitarPercentualPTTP2(0.87)).toBe(0.87);
  });

  it("5RM novo por Lombardi reaproveita o cálculo da 1.0", () => {
    expect(rm5PorLombardi(100, 5)).toBeCloseTo(99.1525, 3);
  });
});

describe("PTTP 2.0 — progressão automática", () => {
  it("cada sessão concluída grava o histórico e sobe o peso sozinho", () => {
    let e = base(100);
    e = registrarSessaoPTTP2(e, "2026-09-22");
    expect(e.historico).toEqual([{ data: "2026-09-22", peso: 100, fase: "5,3,2" }]);
    expect(e.pesoAtual).toBe(102.5);
    e = registrarSessaoPTTP2(e, "2026-09-24");
    expect(e.pesoAtual).toBe(105);
  });

  it("incremento respeita o mínimo de 2,5 kg", () => {
    expect(registrarSessaoPTTP2(base(40), "2026-09-22").pesoAtual).toBe(42.5);
  });

  it("avançar fase só troca o esquema; o peso continua e segue subindo", () => {
    let e = registrarSessaoPTTP2(base(100), "2026-09-22"); // peso 102,5
    e = avancarFasePTTP2(e);
    expect(e.fase).toBe("3,2");
    expect(e.pesoAtual).toBe(102.5);
    expect(alvoPTTP2(e)).toEqual({ esquema: "3, 2", peso: 102.5, concluido: false });
    e = registrarSessaoPTTP2(e, "2026-09-24");
    expect(e.pesoAtual).toBe(105);
    expect(e.historico[1].fase).toBe("3,2");
  });

  it("sequência de fases termina no teste", () => {
    expect(proximaFasePTTP2("5,3,2")).toBe("3,2");
    expect(proximaFasePTTP2("2")).toBe("teste");
    expect(proximaFasePTTP2("teste")).toBeNull();
  });

  it("na fase de teste não há mais incremento por sessão", () => {
    const e = base(100, { fase: "teste" });
    expect(registrarSessaoPTTP2(e, "2026-09-22")).toBe(e);
  });
});

describe("PTTP 2.0 — teste de 1RM", () => {
  it("registrar o teste conclui o ciclo e guarda o valor", () => {
    const e = registrarTestePTTP2(base(120, { fase: "teste" }), 140, "2026-09-30");
    expect(cicloConcluidoPTTP2(e)).toBe(true);
    expect(e.rm1Testado).toBe(140);
    expect(alvoPTTP2(e).concluido).toBe(true);
    expect(registrarSessaoPTTP2(e, "2026-10-01")).toBe(e);
  });

  it("limpar o teste devolve o levantamento ao ciclo", () => {
    const e = limparTestePTTP2(registrarTestePTTP2(base(120, { fase: "teste" }), 140, "2026-09-30"));
    expect(cicloConcluidoPTTP2(e)).toBe(false);
    expect(e.historico).toHaveLength(0);
  });

  it("expõe os 1RMs testados como referência para o Foolproof", () => {
    const c = emptyPTTP2();
    c.levantamentos[0] = registrarTestePTTP2(base(120, { fase: "teste" }), 150, "2026-09-30");
    expect(rm1TestadosPTTP2(c)).toEqual([
      { levantamento: "Agachamento", rm1: 150, data: "2026-09-30" },
    ]);
  });
});

describe("PTTP 2.0 — estrutura", () => {
  it("mantém de 2 a 4 levantamentos", () => {
    expect(normalizarLevantamentosPTTP2([]).length).toBe(2);
    expect(
      normalizarLevantamentosPTTP2([
        estadoVazioPTTP2("Agachamento"),
        estadoVazioPTTP2("Supino"),
        estadoVazioPTTP2("Terra"),
        estadoVazioPTTP2("Press"),
        estadoVazioPTTP2("Remada Curvada"),
      ]).length,
    ).toBe(4);
  });

  it("frequência fixa em 3 treinos com 3 auxiliares", () => {
    const t = normalizarTreinosPTTP2(undefined);
    expect(t.map((x) => x.ordem)).toEqual([1, 2, 3]);
    expect(t.every((x) => x.auxiliares.length === 3)).toBe(true);
  });

  it("detecta o conteúdo do método e não confunde com a 1.0", () => {
    expect(isPTTP2Content(emptyPTTP2())).toBe(true);
    expect(isPTTP2Content({ variante: "PTTP" })).toBe(false);
  });
});
