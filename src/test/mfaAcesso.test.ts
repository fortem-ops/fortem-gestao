import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { decidirMfa, codigoValido } from "@/lib/mfa";
import { validarResetMfa, ehEquipe } from "../../supabase/functions/admin-users/mfa-regras";

describe("2FA Fase 1 — acesso", () => {
  it("equipe sem fator é levada ao cadastro", () => {
    expect(decidirMfa({ isStaff: true, currentLevel: "aal1", fatoresVerificados: 0 })).toBe("cadastro");
  });
  it("equipe com fator em aal1 recebe o desafio", () => {
    expect(decidirMfa({ isStaff: true, currentLevel: "aal1", fatoresVerificados: 1 })).toBe("desafio");
  });
  it("equipe em aal2 entra", () => {
    expect(decidirMfa({ isStaff: true, currentLevel: "aal2", fatoresVerificados: 1 })).toBe("liberado");
  });
  it("aluno e usuário sem papel não são afetados", () => {
    expect(decidirMfa({ isStaff: false, currentLevel: "aal1", fatoresVerificados: 0 })).toBe("liberado");
    expect(ehEquipe(["aluno"])).toBe(false);
    expect(ehEquipe([])).toBe(false);
  });
  it("código precisa ter 6 dígitos", () => {
    expect(codigoValido("12345")).toBe(false);
    expect(codigoValido("123456")).toBe(true);
  });
});

describe("2FA — redefinição", () => {
  const base = { callerId: "a", callerIsAdmin: true, targetId: "b", targetRoles: ["professor"] };
  it("admin não redefine o próprio fator", () => {
    expect(validarResetMfa({ ...base, targetId: "a" })).toMatch(/próprio/);
  });
  it("coordenador (não admin) é recusado", () => {
    expect(validarResetMfa({ ...base, callerIsAdmin: false })).toMatch(/admin/);
  });
  it("alvo aluno ou sem papel é recusado", () => {
    expect(validarResetMfa({ ...base, targetRoles: ["aluno"] })).not.toBeNull();
    expect(validarResetMfa({ ...base, targetRoles: [] })).not.toBeNull();
  });
  it("admin redefine outro usuário da equipe", () => {
    expect(validarResetMfa(base)).toBeNull();
  });
});
