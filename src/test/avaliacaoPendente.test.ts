import { describe, expect, it } from "vitest";
import { partesAvaliacaoConcluidas, type AvaliacaoParaLembrete } from "@/lib/avaliacaoPendente";

const alunoId = "aluno-1";
const agendamento = "2026-09-25";

function avaliar(registros: AvaliacaoParaLembrete[]) {
  return partesAvaliacaoConcluidas(registros, alunoId, agendamento);
}

describe("partesAvaliacaoConcluidas", () => {
  it("reconhece mobilidade e força no formato funcional_v2", () => {
    expect(avaliar([{
      aluno_id: alunoId,
      tipo: "funcional_v2",
      data: agendamento,
      dados: {
        metricas: [{ metric: "Mobilidade Tornozelo", left: 50, right: 51 }],
        forca: { exercicios: [{ nome: "extensao_joelho", direito_kg: 30, esquerdo_kg: 29 }] },
      },
    }])).toMatchObject({ funcional: true, forca: true });
  });

  it("mantém força pendente quando somente mobilidade foi preenchida", () => {
    expect(avaliar([{
      aluno_id: alunoId,
      tipo: "funcional_v2",
      data: agendamento,
      dados: { metricas: [{ metric: "Mobilidade Tornozelo", left: 50, right: 51 }] },
    }])).toMatchObject({ funcional: true, forca: false });
  });

  it("mantém mobilidade pendente quando somente força foi preenchida", () => {
    expect(avaliar([{
      aluno_id: alunoId,
      tipo: "funcional_v2",
      data: agendamento,
      dados: { forca: { exercicios: [{ nome: "extensao_joelho" }] } },
    }])).toMatchObject({ funcional: false, forca: true });
  });

  it("ignora avaliação anterior ao agendamento", () => {
    expect(avaliar([{
      aluno_id: alunoId,
      tipo: "funcional_v2",
      data: "2026-09-24",
      dados: { metricas: [{}], forca: { exercicios: [{}] } },
    }])).toMatchObject({ funcional: false, forca: false });
  });

  it("mantém compatibilidade com os tipos antigos e o treino experimental", () => {
    expect(avaliar([
      { aluno_id: alunoId, tipo: "funcional", data: agendamento },
      { aluno_id: alunoId, tipo: "forca", data: agendamento },
      { aluno_id: alunoId, tipo: "experimental", data: agendamento },
    ])).toEqual({ funcional: true, forca: true, experimental: true });
  });
});