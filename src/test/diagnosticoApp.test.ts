import { describe, it, expect } from "vitest";
import { CHAVE_DIAG, LIMITE_DIAG, lerDiag, limparEvento, registrarDiag } from "@/lib/diagnosticoApp";

function memoria(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, v); },
  };
}

describe("diagnóstico do app", () => {
  it("guarda no máximo 30 eventos, os mais recentes", () => {
    const s = memoria();
    for (let i = 0; i < 40; i++) registrarDiag({ tipo: "abertura", tentativa: i }, s);
    const lista = lerDiag(s);
    expect(lista).toHaveLength(LIMITE_DIAG);
    expect(lista[0].tentativa).toBe(10);
    expect(lista[29].tentativa).toBe(39);
  });

  it("descarta token, senha e id, e corta parâmetros da URL", () => {
    const ev = limparEvento({
      tipo: "sessao", email: "a@b.com", access_token: "segredo", refresh_token: "x", password: "123", user_id: "u1",
      pagina: "https://soufortem.com.br/redefinir-senha?code=abc#access_token=zzz",
    });
    const txt = JSON.stringify(ev);
    expect(txt).not.toContain("segredo");
    expect(txt).not.toContain("123");
    expect(txt).not.toContain("u1");
    expect(txt).not.toContain("abc");
    expect(txt).not.toContain("zzz");
    expect(ev.pagina).toBe("/redefinir-senha");
    expect(ev.email).toBe("a@b.com");
  });

  it("dado corrompido não quebra a leitura", () => {
    const s = memoria();
    s.setItem(CHAVE_DIAG, "{nao-json");
    expect(lerDiag(s)).toEqual([]);
  });
});
