import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  selecionarPlanoExibicao,
  selecionarPlanoPrincipal,
  planoEmVigor,
  type PlanoLike,
} from "@/lib/planoPrincipal";

const migSql = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0300_plano_principal_ativo_prioriza_vigente_sobre_futuro.sql"),
  "utf8",
);
const vendaDialogSrc = readFileSync(
  resolve(process.cwd(), "src/components/student/venda/VendaDialog.tsx"),
  "utf8",
);
const contratoFinSrc = readFileSync(
  resolve(process.cwd(), "src/pages/alunos/ContratoFinanceiro.tsx"),
  "utf8",
);

describe("Renovação antecipada e plano futuro", () => {
  it("prefere o plano de Corrida já em vigor em vez da renovação futura (caso Gabrielle)", () => {
    const vigente: PlanoLike = {
      id: "atual",
      tipo: "Corrida - Sem Plano",
      atividade: "corrida",
      ativo: true,
      data_inicio: "2025-12-05",
      data_fim: "2026-12-05",
      created_at: "2026-08-12T14:41:39Z",
    };
    const futuro: PlanoLike = {
      id: "renovacao",
      tipo: "Corrida - Sem Plano",
      atividade: "corrida",
      ativo: true,
      data_inicio: "2099-12-05",
      data_fim: "2100-12-05",
      created_at: "2026-11-25T13:50:49Z",
    };

    expect(planoEmVigor(futuro)).toBe(false);
    const res = selecionarPlanoExibicao([futuro, vigente]);
    expect(res.plano?.id).toBe("atual");
    expect(res.corridaOnly).toBe(true);
  });

  it("prefere o plano principal em vigor sobre renovação futura, mas retorna o futuro se for o único", () => {
    const atual: PlanoLike = {
      id: "p-atual",
      tipo: "Pro",
      atividade: "treinamento_funcional",
      ativo: true,
      data_inicio: "2026-01-01",
      data_fim: "2099-01-01",
      created_at: "2026-01-01T10:00:00Z",
    };
    const futuro: PlanoLike = {
      id: "p-futuro",
      tipo: "Pro",
      atividade: "treinamento_funcional",
      ativo: true,
      data_inicio: "2099-01-01",
      data_fim: "2100-01-01",
      created_at: "2026-11-25T10:00:00Z",
    };

    expect(selecionarPlanoPrincipal([futuro, atual])?.id).toBe("p-atual");
    expect(selecionarPlanoPrincipal([futuro])?.id).toBe("p-futuro");
  });

  it("migration 0300 prioriza data_inicio <= CURRENT_DATE em fn_plano_principal_ativo", () => {
    expect(migSql).toContain("p.data_inicio <= CURRENT_DATE");
  });

  it("VendaDialog desfaz a venda se a criação do contrato falhar e oferece renovação na Corrida", () => {
    expect(vendaDialogSrc).toContain('.from("vendas").delete().eq("id", vendaIns.id)');
    expect(vendaDialogSrc).toContain("Aluno já possui plano de Corrida vigente");
  });

  it("ContratoFinanceiro exibe selo Aguarda início para contratos futuros", () => {
    expect(contratoFinSrc).toContain("Aguarda início (");
  });
});