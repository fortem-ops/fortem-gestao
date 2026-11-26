import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "drizzle/migrations/0307_comissoes_fase1_avaliacao_e_planos_site.sql",
);

describe("Comissões Fase 1 — Avaliação Funcional e /planos (2027)", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("reativa a regra de avaliação funcional em comissionamento_config", () => {
    expect(sql).toMatch(/UPDATE\s+public\.comissionamento_config/i);
    expect(sql).toMatch(/SET\s+ativo\s*=\s*true/i);
    expect(sql).toMatch(/WHERE\s+tipo\s*=\s*'avaliacao_funcional'/i);
  });

  it("permite vendas do site (/planos, origem site_2027) e bloqueia apenas teste_2027 em trg_comissao_venda_paga", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.trg_comissao_venda_paga/i);
    expect(sql).toMatch(/COALESCE\(NEW\.origem,\s*''\)\s*=\s*'teste_2027'/i);
    expect(sql).not.toMatch(/IF\s*\(NEW\.origem\s*=\s*'site_2027'/i);
  });

  it("exclui vendas teste_2027 em fn_tentar_comissao_experimental", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_tentar_comissao_experimental/i);
    expect(sql).toMatch(/COALESCE\(v\.origem,\s*''\)\s*<>\s*'teste_2027'/i);
  });
});