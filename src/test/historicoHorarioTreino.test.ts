import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ordenarEventosHorario,
  parseHistoricoHorarioPayload,
  rotuloAutorHorario,
  rotuloEventoHorario,
  type EventoHorarioTreino,
} from "@/lib/historicoHorarioTreino";

describe("historicoHorarioTreino", () => {
  it("ordena eventos do mais recente para o mais antigo", () => {
    const eventos: EventoHorarioTreino[] = [
      {
        id: "1",
        ocorrido_em: "2026-11-27T14:00:00.000Z",
        tipo: "agendou",
        aluno_id: "a1",
        aluno_nome: "Bruna",
        autor_nome: "Bruna",
        autor_tipo: "aluno",
        detalhe: null,
      },
      {
        id: "2",
        ocorrido_em: "2026-11-27T16:30:00.000Z",
        tipo: "cancelou",
        aluno_id: "a1",
        aluno_nome: "Bruna",
        autor_nome: "João",
        autor_tipo: "equipe",
        detalhe: "Crédito devolvido",
      },
      {
        id: "3",
        ocorrido_em: "2026-11-27T15:10:00.000Z",
        tipo: "fila_entrou",
        aluno_id: "a2",
        aluno_nome: "Airton",
        autor_nome: "Airton",
        autor_tipo: "aluno",
        detalhe: null,
      },
    ];

    const ordenados = ordenarEventosHorario(eventos);
    expect(ordenados.map((e) => e.id)).toEqual(["2", "3", "1"]);
  });

  it("retorna 'Autor não registrado' quando autor não está preenchido", () => {
    expect(rotuloAutorHorario(null, null)).toBe("Autor não registrado");
    expect(rotuloAutorHorario("Bruna", "aluno")).toBe("Bruna (portal)");
    expect(rotuloAutorHorario("Carlos", "equipe")).toBe("Carlos (equipe)");
    expect(rotuloAutorHorario(null, "equipe")).toBe("Equipe");
    expect(rotuloAutorHorario("Sistema", "sistema")).toBe("Sistema");
  });

  it("formata os rótulos dos eventos corretamente", () => {
    expect(rotuloEventoHorario("agendou", "aluno")).toBe("Agendou");
    expect(rotuloEventoHorario("cancelou", "aluno")).toBe("Cancelou");
    expect(rotuloEventoHorario("cancelou", "equipe")).toBe("Removido pela equipe");
    expect(rotuloEventoHorario("checkin", "aluno")).toBe("Check-in");
    expect(rotuloEventoHorario("presenca", null)).toBe("Presença marcada");
    expect(rotuloEventoHorario("falta", null)).toBe("Falta marcada");
    expect(rotuloEventoHorario("fila_entrou", "aluno")).toBe("Entrou na fila");
    expect(rotuloEventoHorario("fila_saiu", "aluno")).toBe("Saiu da fila");
    expect(rotuloEventoHorario("fila_avisado", "sistema")).toBe("Avisado de vaga");
  });

  it("faz parse seguro do retorno do RPC mantendo fila e ordenando eventos", () => {
    const parsed = parseHistoricoHorarioPayload({
      fila_ativa: [
        { id: "f1", aluno_id: "a2", aluno_nome: "Airton", created_at: "2026-11-27T15:00:00Z" },
      ],
      eventos: [
        {
          id: "e1",
          ocorrido_em: "2026-11-27T13:00:00Z",
          tipo: "agendou",
          aluno_id: "a1",
          aluno_nome: "Bruna",
          autor_nome: null,
          autor_tipo: null,
          detalhe: null,
        },
        {
          id: "e2",
          ocorrido_em: "2026-11-27T15:00:00Z",
          tipo: "fila_entrou",
          aluno_id: "a2",
          aluno_nome: "Airton",
          autor_nome: "Airton",
          autor_tipo: "aluno",
          detalhe: null,
        },
      ],
    });

    expect(parsed.fila_ativa).toHaveLength(1);
    expect(parsed.fila_ativa[0]?.aluno_nome).toBe("Airton");
    expect(parsed.eventos.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(rotuloAutorHorario(parsed.eventos[1]?.autor_nome ?? null, parsed.eventos[1]?.autor_tipo ?? null)).toBe(
      "Autor não registrado",
    );
  });

  it("migration 0318 protege fn_historico_horario_treino com SECURITY DEFINER, search_path, papel de equipe e REVOKE de anon", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "drizzle/migrations/0318_historico_horario_treino.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.fn_historico_horario_treino");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = public");
    expect(sql).toContain("public.user_roles");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_historico_horario_treino\(uuid, date\) FROM PUBLIC, anon;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_historico_horario_treino\(uuid, date\) TO authenticated, service_role;/);
  });
});