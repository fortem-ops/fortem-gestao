import { describe, expect, it } from "vitest";
import { avaliarTurnstile, passeValido } from "../planos-turnstile";

const sim = async () => true;
const nao = async () => false;

describe("Turnstile /planos", () => {
  it("chave desligada: comportamento atual, sem verificar", async () => {
    expect(await avaliarTurnstile(false, "s", undefined, "1.1.1.1", nao)).toBe("livre");
  });
  it("chave ligada sem token: recusado", async () => {
    expect(await avaliarTurnstile(true, "s", undefined, "1.1.1.1", sim)).toBe("recusado");
    expect(await avaliarTurnstile(true, "s", "", "1.1.1.1", sim)).toBe("recusado");
  });
  it("chave ligada sem segredo: recusado (nunca libera)", async () => {
    expect(await avaliarTurnstile(true, undefined, "tok", "1.1.1.1", sim)).toBe("recusado");
  });
  it("chave ligada: token recusado pela Cloudflare = recusado; aceito = ok", async () => {
    expect(await avaliarTurnstile(true, "s", "tok", "1.1.1.1", nao)).toBe("recusado");
    expect(await avaliarTurnstile(true, "s", "tok", "1.1.1.1", sim)).toBe("ok");
  });
  it("passe precisa ser um id do servidor", () => {
    expect(passeValido("bypass")).toBe(false);
    expect(passeValido("6e325c45-4263-48e2-9294-05e6e38e8274")).toBe(true);
  });
});
