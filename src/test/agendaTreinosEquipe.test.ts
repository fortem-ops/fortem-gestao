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

    expect(
      formatarSaldoCreditosTreino({ ok: true, tipo: "prospect" }),
    ).toEqual({ texto: "Prospect · Treino Experimental", alertaSemSaldo: false });

    expect(
      formatarSaldoCreditosTreino({
        ok: true,
        tipo: "creditos",
        origem: "legado",
        saldo: 144,
        total: 156,
        usados: 12,
        plano_nome: "Power",
      }),
    ).toEqual({ texto: "144 créditos restantes de 156 · Power", alertaSemSaldo: false });
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

  it("regressão: funções de saldo e agendamento da equipe não referenciam _plano.frequencia_semanal", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "drizzle/migrations/0314_corrigir_saldo_creditos_e_agendar_treino_equipe.sql",
      ),
      "utf8",
    );
    expect(sql).not.toContain("_plano.frequencia_semanal");
    expect(sql).toContain("c.frequencia_semanal = 5");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_saldo_creditos_treino_aluno(uuid) FROM PUBLIC, anon");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean) FROM PUBLIC, anon");
  });

  it("regressão: lista só ativos vigentes e prospects, calcula saldo legado e vincula prospect ao Treino Experimental", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "drizzle/migrations/0315_agenda_treinos_ativos_legado_prospects.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_alunos_agendaveis_equipe() FROM PUBLIC, anon");
    expect(sql).toContain("a.status = 'prospect'");
    expect(sql).toContain("'origem', 'legado'");
    expect(sql).toContain("frequencia_semanal * 52");
    expect(sql).toContain("experimental_obrigatorio");
    expect(sql).toContain("trg_agenda_servico_delete_cancelar_treino");
    expect(sql).toContain("DELETE FROM public.agenda_servicos WHERE id = _ag.agenda_servico_id");
  });

  it("regressão: fn_agendar_treino_equipe grava auditoria em dados_depois (nunca dados_novos)", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "drizzle/migrations/0316_corrigir_audit_log_agendar_treino_equipe.sql",
      ),
      "utf8",
    );
    expect(sql).not.toContain("dados_novos");
    expect(sql).toContain("INSERT INTO public.audit_log (user_id, operacao, tabela, registro_id, dados_depois)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_agendar_treino_equipe(uuid, date, uuid, boolean, uuid) FROM PUBLIC, anon");
  });
});