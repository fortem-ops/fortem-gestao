import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "drizzle/migrations";

/** Conteúdo da última migration que mexe no gatilho de sincronização de receitas. */
function migrationVigente(): string {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  let conteudo = "";
  for (const arquivo of arquivos) {
    const sql = readFileSync(`${DIR}/${arquivo}`, "utf8");
    if (sql.includes("TRIGGER trg_cobrancas_sync_receitas")) conteudo = sql;
  }
  return conteudo;
}

describe("sincronização de receitas roda uma vez por transação", () => {
  const sql = migrationVigente();

  it("encontra a migration vigente do gatilho", () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it("o gatilho é adiado para o commit", () => {
    expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER trg_cobrancas_sync_receitas/);
    expect(sql).toMatch(/DEFERRABLE INITIALLY DEFERRED/);
  });

  it("não sobra gatilho por comando", () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_cobrancas_sync_receitas ON public\.cobrancas/);
    expect(sql).not.toMatch(/FOR EACH STATEMENT/);
  });

  it("tem trava local à transação para rodar uma vez só", () => {
    expect(sql).toMatch(/current_setting\('fortem\.receitas_sync_feito', true\)/);
    expect(sql).toMatch(/set_config\('fortem\.receitas_sync_feito', '1', true\)/);
  });

  it("não redefine a função de sincronização em si", () => {
    expect(sql).not.toMatch(/FUNCTION public\.fn_receitas_sync_automaticas\(/);
  });
});