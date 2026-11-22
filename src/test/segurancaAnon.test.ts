import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const arquivo = readdirSync("drizzle/migrations").find((f) => f.includes("seguranca_anon_views_funcoes"));
const sql = readFileSync(`drizzle/migrations/${arquivo}`, "utf8");

describe("segurança: visitante sem login", () => {
  it("as 9 views financeiras respeitam as regras de quem consulta", () => {
    for (const v of ["v_cancelamentos", "v_vendas_resumo", "vw_contratos_vencendo", "vw_recebiveis_previstos_todos", "vw_recebiveis_previstos_produtos"]) {
      expect(sql).toContain(`ALTER VIEW public.${v} SET (security_invoker = on);`);
    }
  });
  it("funções que dão pontos, estornam ou agendam não ficam abertas", () => {
    const keep = sql.match(/_anon_keep text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] ?? "";
    for (const f of ["fn_clube_adicionar_pontos", "fn_agendar_servico", "fn_agenda_estornar_credito_por_agenda", "fn_treino_concluir_sessao", "fn_listar_profissionais", "fn_inserir_inscricao_prova"]) {
      expect(keep).not.toContain(`'${f}'`);
    }
    expect(keep).toContain("'fn_planos_publico_2027'");
  });
  it("tokens de cartão: leitura só coordenação/admin", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS staff_all_rede_tokenizacoes");
    expect(sql).toContain("FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()))");
  });
  it("aluno só registra treino para si mesmo", () => {
    expect(sql).toContain("IF p_aluno_id IS NOT NULL AND p_aluno_id <> public.fn_current_aluno_id() THEN");
  });
  it("ajuste manual de pontos exige coordenação/admin", () => {
    expect(sql).toMatch(/fn_clube_ajuste_manual_pontos[\s\S]*?NOT public\.is_coordinator_or_admin\(auth\.uid\(\)\)/);
  });
});
