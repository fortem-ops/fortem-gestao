import { describe, expect, it } from "vitest";
import { textoAvisoPortal } from "../../supabase/functions/_shared/portal-push";
import {
  contarFilaPorChave,
  filtrarFilasAtivasFuturas,
  LIMITE_FILAS_ATIVAS,
  mensagemErroFilaEspera,
} from "../lib/filaEspera";

describe("Push do portal — Fase 3 (fila de espera / vaga liberada)", () => {
  it("formata título e corpo de vaga liberada sem emoji", () => {
    const res = textoAvisoPortal({
      aluno_id: "a1",
      gatilho: "vaga_liberada",
      referencia: "vaga_liberada:f1:lib1",
      url: "/portal/agenda?data=2026-12-02&aba=treinos&horario=08:00",
      plano_tipo: null,
      data_referencia: "2026-12-02",
      valor: null,
      saldo: null,
      anos: null,
      atividade: "Treino",
      horario: "08:00:00",
    });
    expect(res.title).toBe("Vaga liberada às 08:00");
    expect(res.body).toBe(
      "Abriu uma vaga em Treino de 02/12 às 08:00. Agende pelo app: a vaga fica com quem confirmar primeiro.",
    );
    expect(res.title).not.toMatch(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
    expect(res.body).not.toMatch(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
  });

  it("filtra apenas entradas ativas cujo horário ainda não começou", () => {
    const agora = new Date("2026-12-02T13:00:00Z"); // 10:00 Brasília
    const itens = [
      { status: "ativo" as const, data: "2026-12-02", horario_inicio: "09:00:00" },
      { status: "ativo" as const, data: "2026-12-02", horario_inicio: "10:00:00" },
      { status: "ativo" as const, data: "2026-12-02", horario_inicio: "11:00:00" },
      { status: "saiu" as const, data: "2026-12-03", horario_inicio: "08:00:00" },
      { status: "agendou" as const, data: "2026-12-03", horario_inicio: "09:00:00" },
      { status: "encerrado" as const, data: "2026-12-03", horario_inicio: "10:00:00" },
    ];
    const ativos = filtrarFilasAtivasFuturas(itens, agora);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]?.horario_inicio).toBe("11:00:00");
  });

  it("conta fila ativa futura separada por treino e por serviço", () => {
    const agora = new Date("2026-12-02T10:00:00Z"); // 07:00 Brasília
    const contagem = contarFilaPorChave(
      [
        { tipo: "treino", slot_id: "s1", profissional_id: null, data: "2026-12-02", horario_inicio: "08:00:00", status: "ativo" },
        { tipo: "treino", slot_id: "s1", profissional_id: null, data: "2026-12-02", horario_inicio: "08:00:00", status: "ativo" },
        { tipo: "treino", slot_id: "s1", profissional_id: null, data: "2026-12-02", horario_inicio: "06:00:00", status: "ativo" },
        { tipo: "servico", slot_id: null, profissional_id: "p1", data: "2026-12-02", horario_inicio: "09:00:00", status: "ativo" },
      ],
      agora,
    );
    expect(contagem["treino:s1:2026-12-02"]).toBe(2);
    expect(contagem["servico:p1:2026-12-02:09:00"]).toBe(1);
  });

  it("retorna mensagens claras para limite de 5 e erros de entrada", () => {
    expect(LIMITE_FILAS_ATIVAS).toBe(5);
    expect(mensagemErroFilaEspera("limite_filas")).toContain("5");
    expect(mensagemErroFilaEspera("sem_plano_corrida")).toContain("Corrida");
    expect(mensagemErroFilaEspera("ja_agendado")).toContain("agendado");
    expect(mensagemErroFilaEspera("horario_com_vaga")).toContain("vaga disponível");
  });
});