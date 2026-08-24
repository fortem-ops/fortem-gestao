import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  selecionarPlanoExibicao,
  selecionarPlanoPrincipal,
  planoVigente,
  ATIVIDADE_CORRIDA,
  ATIVIDADE_PRINCIPAL,
} from "@/lib/planoPrincipal";

const hojeISO = new Date().toISOString().split("T")[0];
function offsetDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

const base = {
  ativo: true,
  atividade: ATIVIDADE_PRINCIPAL,
  duracao_meses: 12,
};

describe("selecionarPlanoPrincipal", () => {
  it("cenário Marcelo: mesma data_inicio, ignora o registro antigo vencido e devolve o vigente", () => {
    const antigo = {
      ...base,
      id: "f15e6b96",
      tipo: "Start+",
      data_inicio: "2026-04-23",
      data_fim: offsetDias(-30),
      renovacao_automatica: false,
      created_at: "2026-06-10T00:00:00Z",
    };
    const vigente = {
      ...base,
      id: "a0b6e001",
      tipo: "Start+",
      data_inicio: "2026-04-23",
      data_fim: offsetDias(300),
      renovacao_automatica: true,
      created_at: "2026-08-14T00:00:00Z",
    };
    expect(selecionarPlanoPrincipal([antigo, vigente])?.id).toBe("a0b6e001");
    expect(selecionarPlanoExibicao([antigo, vigente]).plano?.id).toBe("a0b6e001");
  });

  it("plano vencido criado DEPOIS do vigente não vence a disputa", () => {
    const vigente = {
      ...base,
      id: "vigente",
      data_inicio: "2026-01-01",
      data_fim: offsetDias(100),
      created_at: "2026-01-01T00:00:00Z",
    };
    const vencidoRecente = {
      ...base,
      id: "vencido",
      data_inicio: "2025-01-01",
      data_fim: offsetDias(-1),
      created_at: "2026-09-01T00:00:00Z",
    };
    expect(selecionarPlanoPrincipal([vencidoRecente, vigente])?.id).toBe("vigente");
  });

  it("sem nenhum vigente, devolve o mais recente (para exibir o vencimento)", () => {
    const a = { ...base, id: "a", data_inicio: "2024-01-01", data_fim: offsetDias(-200), created_at: "2024-01-01T00:00:00Z" };
    const b = { ...base, id: "b", data_inicio: "2025-01-01", data_fim: offsetDias(-10), created_at: "2025-01-01T00:00:00Z" };
    expect(selecionarPlanoPrincipal([a, b])?.id).toBe("b");
  });

  it("ignora planos de Corrida e planos inativos", () => {
    const corrida = { ...base, id: "c", atividade: ATIVIDADE_CORRIDA, data_inicio: hojeISO, data_fim: offsetDias(200), created_at: "2026-08-14T00:00:00Z" };
    const inativo = { ...base, id: "i", ativo: false, data_inicio: hojeISO, data_fim: offsetDias(200), created_at: "2026-08-15T00:00:00Z" };
    const principal = { ...base, id: "p", data_inicio: hojeISO, data_fim: offsetDias(200), created_at: "2026-01-01T00:00:00Z" };
    expect(selecionarPlanoPrincipal([corrida, inativo, principal])?.id).toBe("p");
  });

  it("aluno só com Corrida: principal é nulo e exibição marca corridaOnly", () => {
    const corrida = { ...base, id: "c", atividade: ATIVIDADE_CORRIDA, data_inicio: hojeISO, data_fim: offsetDias(200), created_at: "2026-08-14T00:00:00Z" };
    expect(selecionarPlanoPrincipal([corrida])).toBeNull();
    const sel = selecionarPlanoExibicao([corrida]);
    expect(sel.corridaOnly).toBe(true);
    expect(sel.plano?.id).toBe("c");
  });

  it("aluno só com plano futuro: o plano futuro é considerado vigente", () => {
    const futuro = { ...base, id: "f", data_inicio: offsetDias(30), data_fim: offsetDias(395), created_at: "2026-08-14T00:00:00Z" };
    expect(selecionarPlanoPrincipal([futuro])?.id).toBe("f");
  });

  it("lista vazia ou nula devolve null", () => {
    expect(selecionarPlanoPrincipal([])).toBeNull();
    expect(selecionarPlanoPrincipal(null)).toBeNull();
    expect(selecionarPlanoExibicao(undefined).plano).toBeNull();
  });
});

describe("planoVigente", () => {
  it("sem data_fim, a vigência vem de data_inicio + duração", () => {
    expect(planoVigente({ ...base, id: "x", data_inicio: "2020-01-01" } as any)).toBe(false);
    expect(planoVigente({ ...base, id: "x", data_inicio: hojeISO } as any)).toBe(true);
  });

  it("data_fim hoje ainda é vigente", () => {
    expect(planoVigente({ ...base, id: "x", data_inicio: "2020-01-01", data_fim: hojeISO } as any)).toBe(true);
  });
  it("data_fim ontem não é vigente", () => {
    expect(planoVigente({ ...base, id: "x", data_inicio: "2020-01-01", data_fim: offsetDias(-1) } as any)).toBe(false);
  });
});
