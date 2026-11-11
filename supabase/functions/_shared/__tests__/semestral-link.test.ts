import { describe, expect, it } from "vitest";
import { humanoValido, vendaEncerrada } from "../semestral-link";

const agora = Date.parse("2026-11-11T20:00:00Z");

describe("link Semestral no servidor", () => {
  it("Turnstile desligado não exige verificação", () => expect(humanoValido(null, false, agora)).toBe(true));
  it("Turnstile ligado sem verificação recusa", () => expect(humanoValido(null, true, agora)).toBe(false));
  it("verificação de 1h atrás vale; de 3h atrás não", () => {
    expect(humanoValido("2026-11-11T19:00:00Z", true, agora)).toBe(true);
    expect(humanoValido("2026-11-11T17:00:00Z", true, agora)).toBe(false);
  });
  it("venda desistida/expirada/estornada encerra o link; pendente não", () => {
    expect(vendaEncerrada("cancelado")).toBe(true);
    expect(vendaEncerrada("estornado")).toBe(true);
    expect(vendaEncerrada("pendente")).toBe(false);
  });
});
