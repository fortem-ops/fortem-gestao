import { describe, it, expect, beforeEach, vi } from "vitest";
import { dividirCentavos, lerCodigo, lerSessao, limparSessao, mascararCpf, rolouAteOFim, salvarSessao } from "@/lib/checkoutSite2027";

describe("checkout do site 2027 — navegador", () => {
  beforeEach(() => { limparSessao(); window.localStorage.clear(); });

  it("sessão guarda só id e chave, no sessionStorage, nunca no localStorage", () => {
    salvarSessao({ proposta_id: "p1", chave_sessao: "c1", cpf: "01574308041" } as any);
    expect(lerSessao()).toEqual({ proposta_id: "p1", chave_sessao: "c1" });
    expect(window.sessionStorage.getItem("fortem_checkout_2027")).not.toContain("01574308041");
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("01574308041");
  });

  it("funciona sem sessionStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(lerSessao()).toBeNull();
    spy.mockRestore();
  });

  it("máscara do CPF", () => {
    expect(mascararCpf("01574308041")).toBe("015.743.080-41");
    expect(mascararCpf("0157")).toBe("015.7");
  });

  it("parcelas com a sobra na última, somando o total", () => {
    const p = dividirCentavos(514800, 12);
    expect(p[0]).toBe(42900);
    expect(p.reduce((a, b) => a + b, 0)).toBe(514800);
    const q = dividirCentavos(1000, 3);
    expect(q).toEqual([333, 333, 334]);
  });

  it("lê frequência e período do código", () => {
    expect(lerCodigo("power_2027_2x_anual")).toEqual({ frequencia: "2x", periodo: "anual" });
    expect(lerCodigo("start_2027_livre_mensal")).toEqual({ frequencia: "livre", periodo: "mensal" });
  });

  it("aceite só libera ao rolar até o fim", () => {
    expect(rolouAteOFim({ scrollTop: 0, clientHeight: 500, scrollHeight: 3000 })).toBe(false);
    expect(rolouAteOFim({ scrollTop: 2495, clientHeight: 500, scrollHeight: 3000 })).toBe(true);
  });
});
