import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { checarPapelEquipe, type DepsPapel } from "@/lib/authAccess";

function deps(over: Partial<DepsPapel> & { listas?: (string[] | Error)[] }): DepsPapel {
  const listas = over.listas ?? [];
  let n = 0;
  return {
    sessaoConfirmada: async () => ({ userId: "u1" }),
    renovar: vi.fn(async () => {}),
    papeis: async () => {
      const v = listas[Math.min(n++, listas.length - 1)];
      if (v instanceof Error) throw v;
      return v;
    },
    esperar: async () => {},
    registrar: () => {},
    ...over,
  };
}

describe("checagem de papel da equipe", () => {
  it("lista vazia e depois papéis: é equipe (renova a sessão entre as tentativas)", async () => {
    const d = deps({ listas: [[], ["admin"]] });
    const r = await checarPapelEquipe("u1", d);
    expect(r.status).toBe("equipe");
    expect(r.tentativas).toBe(2);
    expect(d.renovar).toHaveBeenCalledTimes(1);
  });

  it("três listas vazias: só então conclui 'não é equipe'", async () => {
    const r = await checarPapelEquipe("u1", deps({ listas: [[], [], []] }));
    expect(r.status).toBe("nao_equipe");
    expect(r.tentativas).toBe(3);
  });

  it("aluno com papel lido: não é equipe na primeira tentativa", async () => {
    const r = await checarPapelEquipe("u1", deps({ listas: [["aluno"]] }));
    expect(r).toMatchObject({ status: "nao_equipe", tentativas: 1 });
  });

  it("sem sessão confirmada: erro, nunca 'não é equipe'", async () => {
    const r = await checarPapelEquipe("u1", deps({ sessaoConfirmada: async () => null, listas: [[]] }));
    expect(r.status).toBe("erro");
  });

  it("sessão de outro usuário: erro", async () => {
    const r = await checarPapelEquipe("u1", deps({ sessaoConfirmada: async () => ({ userId: "u2" }), listas: [["admin"]] }));
    expect(r.status).toBe("erro");
  });

  it("erro do banco nas três tentativas: erro", async () => {
    const r = await checarPapelEquipe("u1", deps({ listas: [new Error("JWT expired")] }));
    expect(r.status).toBe("erro");
  });
});
