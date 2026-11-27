import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const portalAgendaPath = resolve(__dirname, "../pages/portal/PortalAgenda.tsx");
const migrationPath = resolve(__dirname, "../../drizzle/migrations/0317_portal_ocupacao_treinos_e_servicos.sql");

describe("PortalAgenda — ocupação real via RPC seguro (sem vazamento e sem zerar por RLS)", () => {
  const portalSrc = readFileSync(portalAgendaPath, "utf-8");
  const migrationSrc = readFileSync(migrationPath, "utf-8");

  it("usa fn_portal_ocupacao_treinos para contar vagas ocupadas de treinos", () => {
    expect(portalSrc).toContain('rpc("fn_portal_ocupacao_treinos"');
    expect(portalSrc).toContain("ocupadasPorSlot.get(slot.id)");
  });

  it("usa fn_portal_ocupacao_servicos para detectar horários ocupados de serviços", () => {
    expect(portalSrc).toContain('rpc("fn_portal_ocupacao_servicos"');
    expect(portalSrc).not.toMatch(/\.from\("agenda_servicos"\)[\s\S]{0,160}\.not\("aluno_id",\s*"is",\s*null\)/);
  });

  it("migration define ambos os RPCs com SECURITY DEFINER, search_path fixo e sem acesso anon", () => {
    expect(migrationSrc).toContain("CREATE OR REPLACE FUNCTION public.fn_portal_ocupacao_treinos");
    expect(migrationSrc).toContain("CREATE OR REPLACE FUNCTION public.fn_portal_ocupacao_servicos");
    expect(migrationSrc).toContain("SECURITY DEFINER");
    expect(migrationSrc).toContain("SET search_path = public");
    expect(migrationSrc).toContain("REVOKE ALL ON FUNCTION public.fn_portal_ocupacao_treinos(date) FROM PUBLIC, anon");
    expect(migrationSrc).toContain(
      "REVOKE ALL ON FUNCTION public.fn_portal_ocupacao_servicos(uuid[], date, date) FROM PUBLIC, anon",
    );
    expect(migrationSrc).toContain("GRANT EXECUTE ON FUNCTION public.fn_portal_ocupacao_treinos(date) TO authenticated");
    expect(migrationSrc).toContain(
      "GRANT EXECUTE ON FUNCTION public.fn_portal_ocupacao_servicos(uuid[], date, date) TO authenticated",
    );
  });
});