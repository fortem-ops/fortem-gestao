import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "drizzle/migrations";

function semComentarios(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/** Corpo da última migration que define a função — ou seja, a definição vigente. */
function corpoVigente(funcao: string): string {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  let corpo = "";
  for (const arquivo of arquivos) {
    const sql = readFileSync(`${DIR}/${arquivo}`, "utf8");
    const inicio = sql.indexOf(`FUNCTION public.${funcao}(`);
    if (inicio < 0) continue;
    const resto = sql.slice(inicio);
    const bloco = resto.match(/\$(\w*)\$[\s\S]*?\$\1\$/);
    corpo = bloco ? bloco[0] : resto;
  }
  return semComentarios(corpo);
}

describe("desconto da venda 2027 não volta a atualizar parcela a parcela", () => {
  const corpo = corpoVigente("fn_venda_2027_criar");

  it("encontra a definição vigente da função", () => {
    expect(corpo.length).toBeGreaterThan(0);
  });

  it("aplica o desconto das parcelas num único UPDATE", () => {
    const updates = corpo.match(/UPDATE\s+public\.cobrancas/gi) ?? [];
    // 1 para a recorrência mensal (ciclo 1) + 1 para o parcelado (todas as parcelas de uma vez)
    expect(updates.length).toBe(2);
    expect(corpo).toMatch(/SET valor = \w+\.parcela_total \/ 100\.0/);
  });

  it("não tem laço por parcela escrevendo em cobrancas", () => {
    const lacos = corpo.match(/\bLOOP\b[\s\S]*?\bEND LOOP\b/gi) ?? [];
    for (const laco of lacos) {
      expect(laco).not.toMatch(/UPDATE\s+public\.cobrancas/i);
      expect(laco).not.toMatch(/INSERT\s+INTO\s+public\.cobrancas/i);
    }
  });

  it("mantém a sobra de centavos na última parcela", () => {
    expect(corpo).toMatch(/numero_ciclo = v_n THEN \(v_novo_c \+ v_serv_c\) - v_base\s+\* \(v_n - 1\)/);
    expect(corpo).toMatch(/numero_ciclo = v_n THEN v_novo_c\s+- v_pbase \* \(v_n - 1\)/);
  });

  it("não redefine fn_venda_2027_gravar, que serve o site", () => {
    const sql = readFileSync(`${DIR}/0292_venda_2027_criar_update_unico_parcelas.sql`, "utf8");
    expect(sql).not.toMatch(/FUNCTION public\.fn_venda_2027_gravar\(/);
  });
});
