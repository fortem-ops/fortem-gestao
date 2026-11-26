import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mig = readFileSync(
  resolve(__dirname, "../../drizzle/migrations/0306_avisos_consultor_conversao_responsavel_push.sql"),
  "utf8",
);

describe("migration 0306: avisos automáticos ao consultor, conversão e responsável/coordenação com push", () => {
  it("avisa consultor para avaliação experimental, funcional e de força finalizadas, excluindo o próprio autor", () => {
    expect(mig).toContain("fn_avaliacao_avisar_consultor");
    expect(mig).toContain("('experimental', 'funcional', 'funcional_v2', 'forca')");
    expect(mig).toContain("v_consultor_id = NEW.avaliador_id");
  });

  it("avisa professor do experimental, coordenadores e admins na conversão de prospect com deduplicação", () => {
    expect(mig).toContain("CREATE TABLE IF NOT EXISTS public.notificacao_conversao_log");
    expect(mig).toContain("trg_00_plano_conversao_avisar");
    expect(mig).toContain("ON CONFLICT (aluno_id) DO NOTHING");
    expect(mig).toContain("Wellhub");
    expect(mig).toContain("TotalPass");
  });

  it("inclui professor responsável e coordenadores em toda notificação sobre aluno e dispara push", () => {
    expect(mig).toContain("trg_notificacao_aluno_incluir_equipe");
    expect(mig).toContain("trg_notificacao_destinatario_push");
    expect(mig).toContain("send-push-equipe");
    expect(mig).toContain("notificacao_aluno_urgente");
  });

  it("mantém funções SECURITY DEFINER sem acesso para anon e aplica GRANT na tabela nova", () => {
    expect(mig).toContain("GRANT SELECT ON public.notificacao_conversao_log TO authenticated");
    expect(mig).toContain("GRANT ALL ON public.notificacao_conversao_log TO service_role");
    expect(mig).toContain("FROM PUBLIC, anon");
  });
});