import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Regressão: plano adicional de Corrida (sem contrato próprio) era bloqueado no agendamento.
const dir = join(process.cwd(), "drizzle/migrations");
const sql = readdirSync(dir).filter((f) => f.includes("corrida_plano_adicional_agendamento")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

describe("plano de Corrida vigente", () => {
  it("servidor aceita plano ativo de Corrida vigente na data, além do contrato", () => {
    expect(sql).toMatch(/p\.ativo = true/);
    expect(sql).toMatch(/p\.tipo ILIKE 'Corrida%'/);
    expect(sql).toMatch(/p\.data_inicio <= p_data/);
    expect(sql).toMatch(/fn_tem_plano_corrida\(_aluno_id, p_data\)/);
  });
  it("portal usa a mesma função do servidor, não só contratos", () => {
    const src = readFileSync(join(process.cwd(), "src/pages/portal/PortalAgenda.tsx"), "utf8");
    expect(src).toContain('rpc("fn_tem_plano_corrida"');
    expect(src).not.toContain('.eq("plano_tipo", "corrida")');
  });
});
