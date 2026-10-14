import { describe, it, expect } from "vitest";
import { podeMostrarTesteReal as f } from "@/components/leads/AssinaturaSite2027";
const base = { isAdmin: true, testeAdmin: true, modo: "real_baixo_valor", cancelada: false };
describe("botão teste real da recorrência", () => {
  it("aparece para admin, proposta teste e real_baixo_valor", () => expect(f(base)).toBe(true));
  it("some para não-admin", () => expect(f({ ...base, isAdmin: false })).toBe(false));
  it("some em proposta pública", () => expect(f({ ...base, testeAdmin: false })).toBe(false));
  it("some em simulacao", () => expect(f({ ...base, modo: "simulacao" })).toBe(false));
  it("some com assinatura cancelada", () => expect(f({ ...base, cancelada: true })).toBe(false));
});
