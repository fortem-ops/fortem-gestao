import { describe, it, expect } from "vitest";
import { creditoDisponivel, creditoExpirado, creditoAtivo } from "@/lib/creditos-calc";

describe("creditoDisponivel", () => {
  it("ilimitado retorna Infinity", () => {
    expect(creditoDisponivel({ ilimitado: true, quantidade_inicial: 0, quantidade_usada: 0 })).toBe(Infinity);
  });

  it("calcula inicial - usado", () => {
    expect(creditoDisponivel({ quantidade_inicial: 10, quantidade_usada: 3 })).toBe(7);
  });

  it("zero quando totalmente usado", () => {
    expect(creditoDisponivel({ quantidade_inicial: 5, quantidade_usada: 5 })).toBe(0);
  });
});

describe("creditoExpirado", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  it("data futura não expirado", () => {
    expect(creditoExpirado({ data_validade: "2026-12-31" }, now)).toBe(false);
  });

  it("data passada expirado", () => {
    expect(creditoExpirado({ data_validade: "2025-01-01" }, now)).toBe(true);
  });

  it("sem data_validade nunca expira", () => {
    expect(creditoExpirado({ data_validade: null }, now)).toBe(false);
  });
});

describe("creditoAtivo", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  it("ativo + não expirado = true", () => {
    expect(creditoAtivo({ ativo: true, data_validade: "2026-12-31" }, now)).toBe(true);
  });

  it("inativo = false", () => {
    expect(creditoAtivo({ ativo: false, data_validade: "2026-12-31" }, now)).toBe(false);
  });

  it("ativo mas expirado = false", () => {
    expect(creditoAtivo({ ativo: true, data_validade: "2025-01-01" }, now)).toBe(false);
  });

  it("ativo sem validade = true", () => {
    expect(creditoAtivo({ ativo: true, data_validade: null }, now)).toBe(true);
  });
});
