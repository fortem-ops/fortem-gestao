import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATUS_LABEL } from "@/lib/comissionamentos";

const migrationSql = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0308_comissoes_fase2_agregadoras_primeiro_treino.sql"),
  "utf8"
);

describe("Comissões Fase 2 — Agregadoras (Wellhub/TotalPass) após 1º treino", () => {
  it("exibe em_validacao como Aguardando aprovação na interface", () => {
    expect(STATUS_LABEL.em_validacao).toBe("Aguardando aprovação");
  });

  it("cria fn_tentar_comissao_agregadora exigindo experimental concluído, agregadora ativa e sem duplicar", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.fn_tentar_comissao_agregadora");
    expect(migrationSql).toContain("COALESCE(a.is_equipe, false) = false");
    expect(migrationSql).toContain("public.fn_aluno_inativo(_aluno)");
    expect(migrationSql).toContain("c.plano_tipo IN ('gympass', 'totalpass')");
    expect(migrationSql).toContain("p.tipo_pendencia = 'avaliar_experimental'");
    expect(migrationSql).toContain("p.concluido = true");
    expect(migrationSql).toContain("SET status = 'em_validacao'");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.fn_tentar_comissao_agregadora(uuid, date) FROM PUBLIC, anon");
  });

  it("dispara nos gatilhos de 1º treino realizado e cancela pendência se vínculo agregadora for cancelado", () => {
    expect(migrationSql).toContain("ON public.treino_agendamentos");
    expect(migrationSql).toContain("NEW.status = 'realizado'");
    expect(migrationSql).toContain("ON public.treino_sessoes");
    expect(migrationSql).toContain("NEW.concluido_em IS NOT NULL");
    expect(migrationSql).toContain("trg_comissao_agregadora_contrato_cancelado");
    expect(migrationSql).toContain("[vínculo agregadora cancelado]");
  });

  it("restringe fn_comissao_aprovar a administradores e grava auditoria", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.fn_comissao_aprovar(_ids uuid[])");
    expect(migrationSql).toContain("NOT public.has_role(_uid, 'admin')");
    expect(migrationSql).toContain("INSERT INTO public.audit_log");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.fn_comissao_aprovar(uuid[]) FROM PUBLIC, anon");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.fn_comissao_aprovar(uuid[]) TO authenticated, service_role");
  });
});