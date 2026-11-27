import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatarSaldoCreditosTreino,
  podeGerenciarAlunosHorario,
} from "@/components/agenda/IncluirAlunoHorario";

describe("Agenda de Treinos — inclusão e exclusão por Admin e Coordenador", () => {
  it("permite gerenciar alunos apenas para Admin e Coordenador (bloqueia Professor)", () => {
    expect(podeGerenciarAlunosHorario({ isAdmin: true, isCoordAdmin: true })).toBe(true);
    expect(podeGerenciarAlunosHorario({ isAdmin: false, isCoordAdmin: true })).toBe(true);
    expect(podeGerenciarAlunosHorario({ isAdmin: false, isCoordAdmin: false })).toBe(false);
    expect(podeGerenciarAlunosHorario(null)).toBe(false);
  });

  it("formata corretamente o saldo de créditos restantes, Livre e Agregadora", () => {
    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "creditos", saldo: 8, total: 12, usados: 4 }),
    ).toEqual({ texto: "8 créditos restantes de 12", alertaSemSaldo: false });

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "creditos", saldo: 1, total: 8, usados: 7 }),
    ).toEqual({ texto: "1 crédito restante de 8", alertaSemSaldo: false });

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "creditos", saldo: 0, total: 8, usados: 8 }),
    ).toEqual({ texto: "0 créditos restantes de 8", alertaSemSaldo: true });

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "creditos", saldo: -1, total: 8, usados: 9 }),
    ).toEqual({ texto: "-1 crédito restante de 8", alertaSemSaldo: true });

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "creditos", saldo: 0, total: 0, usados: 0 }),
    ).toEqual({ texto: "0 créditos restantes (sem ciclo ativo)", alertaSemSaldo: true });

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "livre", plano_nome: "Pro" }),
    ).toEqual({ texto: "Plano Livre (não consome créditos)", alertaSemSaldo: false });

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "agregadora", plano_nome: "Wellhub" }),
    ).toEqual({ texto: "Agregadora (Wellhub)", alertaSemSaldo: false });
  });

  it("migration revoga anon, restringe agendamento a admin/coordenador, respeita Livre e grava audit_log", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "drizzle/migrations/0313_agenda_treinos_incluir_excluir_equipe.sql"),
      "utf8",
    );
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_saldo_creditos_treino_aluno(uuid) FROM PUBLIC, anon");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean) FROM PUBLIC, anon");
    expect(sql).toContain("public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')");
    expect(sql).toContain("frequencia_semanal = 5");
    expect(sql).toContain("INSERT INTO public.audit_log");
  });
});