import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

describe("Ciclos de crédito não vazam de contratos cancelados", () => {
  it("migration encerra ciclos órfãos e cria gatilho de cancelamento com search_path fixo", () => {
    const sql = readFileSync(
      resolve(root, "drizzle/migrations/0319_contratos_cancelar_ciclos_credito.sql"),
      "utf8",
    );
    expect(sql).toContain("UPDATE public.ciclos_credito");
    expect(sql).toContain("SET status = 'cancelado'");
    expect(sql).toContain("c.status = 'cancelado'");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.fn_contratos_cancelar_ciclos_credito()");
    expect(sql).toContain("SET search_path = public");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_contratos_cancelar_ciclos_credito() FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("CREATE TRIGGER trg_contratos_cancelar_ciclos_credito");
    expect(sql).toContain("AFTER UPDATE OF status ON public.contratos");
  });

  it("PortalHome e PortalAgenda filtram apenas ciclos de contratos ativos do aluno", () => {
    for (const relPath of [
      "src/pages/portal/PortalHome.tsx",
      "src/pages/portal/PortalAgenda.tsx",
    ]) {
      const src = readFileSync(resolve(root, relPath), "utf8");
      expect(src).toContain('.from("ciclos_credito")');
      expect(src).toContain('.eq("contratos.aluno_id", student!.id)');
      expect(src).toContain('.eq("contratos.status", "ativo")');
      expect(src).toContain('.order("creditos_liberados", { ascending: false })');
    }
  });
});