import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { usuarioApareceNaEquipe } from "@/lib/authAccess";
import { excluirUsuarioSeguro, type ExclusaoDeps } from "../../supabase/functions/admin-users/excluir-regras";

describe("Tela de Usuários", () => {
  it("só aluno não aparece", () => expect(usuarioApareceNaEquipe(["aluno"])).toBe(false));
  it("equipe aparece mesmo se também for aluno", () => expect(usuarioApareceNaEquipe(["professor", "aluno"])).toBe(true));
  it("sem papel aparece (Sem permissão)", () => expect(usuarioApareceNaEquipe([])).toBe(true));
});

function deps(over: Partial<ExclusaoDeps> = {}) {
  const passos: string[] = [];
  const d: ExclusaoDeps = {
    contarVinculos: async () => { passos.push("vinculos"); return []; },
    deleteUser: async () => { passos.push("deleteUser"); return null; },
    limparRestos: async () => { passos.push("limpar"); },
    auditar: async () => { passos.push("auditar"); },
    ...over,
  };
  return { d, passos };
}

describe("Exclusão segura de usuário", () => {
  it("com vínculo, nada é apagado", async () => {
    const { d, passos } = deps({ contarVinculos: async () => [{ tabela: "tarefas", coluna: "responsavel_id", total: 8 }] });
    const r = await excluirUsuarioSeguro("admin", "alvo", d);
    expect(r.ok).toBe(false);
    expect(passos).not.toContain("deleteUser");
    expect(passos).not.toContain("limpar");
  });
  it("se deleteUser falhar, perfil e papéis não são apagados", async () => {
    const { d, passos } = deps();
    d.deleteUser = async () => { passos.push("deleteUser"); return "erro"; };
    const r = await excluirUsuarioSeguro("admin", "alvo", d);
    expect(r.ok).toBe(false);
    expect(passos).toEqual(["vinculos", "deleteUser"]);
  });
  it("ordem correta quando dá certo", async () => {
    const { d, passos } = deps();
    expect((await excluirUsuarioSeguro("admin", "alvo", d)).ok).toBe(true);
    expect(passos).toEqual(["vinculos", "deleteUser", "limpar", "auditar"]);
  });
  it("não exclui o próprio usuário", async () => {
    const { d, passos } = deps();
    expect((await excluirUsuarioSeguro("a", "a", d)).ok).toBe(false);
    expect(passos).toEqual([]);
  });
});
