import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { destinoRelatorioTreino } from "@/lib/relatorioTreino";
import { getTaskActionTarget } from "@/lib/taskAction";

const sql = readFileSync("drizzle/migrations/0303_registros_tecnicos_inativos_autoria_treino.sql", "utf8");

describe("registros técnicos — regressões", () => {
  it("fim de onda 5-3-1 também é bloqueado para inativos", () => {
    const complemento = readFileSync("drizzle/migrations/0304_tarefas_inativos_incluir_fim_onda.sql", "utf8");
    expect(complemento).toContain("'atualizar_treino','treino_onda_concluida'");
  });
  it("tarefa do treino salvo abre seu relatório, não outra troca", () => {
    expect(getTaskActionTarget({ aluno_id: "aluno-1", tipo_auto: "atualizar_treino", treino_id: "treino-2" })).toBe("/avaliacoes?aluno=aluno-1&new=1&tipo=relatorioforca&treino=treino-2");
    expect(getTaskActionTarget({ aluno_id: "aluno-1", tipo_auto: "atualizar_treino" })).toBe("/alunos/aluno-1?tab=treinos");
    expect(getTaskActionTarget({ aluno_id: "aluno-1", tipo_auto: "treino_onda_concluida" })).toBe("/alunos/aluno-1?tab=treinos");
  });
  it("toda escrita de tarefa técnica verifica status e funil inativo", () => {
    expect(sql).toContain("lower(a.status)='inativo' OR f.slug='inativo'");
    expect(sql).toContain("BEFORE INSERT OR UPDATE ON public.tarefas");
    expect(sql).toContain("NEW.status <> 'concluida' AND public.fn_aluno_inativo(NEW.aluno_id)");
    expect(sql).toContain("status <> 'concluida' AND public.fn_tarefa_tecnica(tipo_auto)");
  });
  it("autoria original é obrigatória e não pode ser trocada em edição", () => {
    expect(sql).toContain("NEW.avaliador_id:=auth.uid()");
    expect(sql).toContain("NEW.avaliador_id IS DISTINCT FROM OLD.avaliador_id");
    expect(sql).toContain("IF NEW.avaliador_id IS NULL THEN RAISE EXCEPTION");
  });
  it("relatório finalizado conclui só a tarefa do treino vinculado", () => {
    expect(sql).toContain("NEW.tipo='relatorioforca' AND NEW.dados->>'status'='finalizado'");
    expect(sql).toContain("WHERE treino_id=NEW.treino_id AND tipo_auto='atualizar_treino'");
    expect(sql).toContain("id=NEW.treino_id AND aluno_id=NEW.aluno_id");
  });
  it("avisos usam papéis protegidos e excluem o autor", () => {
    expect(sql).toContain("r.role IN ('admin','coordenador') AND r.user_id<>NEW.avaliador_id");
    expect(sql).toContain("IF NEW.dados->>'status'='rascunho' THEN RETURN NEW");
    expect(sql).toContain("FROM PUBLIC,anon");
  });
  it.each(["Treinos de força", "Treinos de corrida"])("troca de treino abre protocolo %s com aluno e treino corretos", (protocolo) => {
    const url = new URL(destinoRelatorioTreino("aluno-1", "treino-2", protocolo === "Treinos de corrida" ? "Corrida" : "5-3-1"), "https://example.test");
    expect(url.pathname).toBe("/avaliacoes");
    expect(Object.fromEntries(url.searchParams)).toEqual({ aluno: "aluno-1", new: "1", tipo: "relatorioforca", protocolo, treino: "treino-2" });
  });
});

