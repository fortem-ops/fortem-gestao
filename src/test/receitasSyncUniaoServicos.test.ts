import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "drizzle/migrations";

/** Conteúdo da última migration que define a função de sincronização. */
function migrationVigente(): string {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  let conteudo = "";
  for (const arquivo of arquivos) {
    const sql = readFileSync(`${DIR}/${arquivo}`, "utf8");
    if (sql.includes("FUNCTION public.fn_receitas_sync_automaticas(")) conteudo = sql;
  }
  return conteudo;
}

describe("sincronização de receitas não recalcula a view de recebíveis", () => {
  const sql = migrationVigente();

  it("encontra a migration vigente da função", () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it("a segunda perna da união traz só o ramo de serviços", () => {
    expect(sql).toMatch(/FROM vw_recebiveis_previstos_futuros_cartao WHERE origem = 'servico'/);
  });

  it("a primeira perna continua completa, sem filtro de origem", () => {
    expect(sql).toMatch(/FROM vw_recebiveis_previstos_cartao_parcelado\s*\n/);
  });

  it("não redefine as views de recebíveis nem o gatilho", () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE VIEW/i);
    expect(sql).not.toMatch(/CREATE CONSTRAINT TRIGGER/i);
  });
});
