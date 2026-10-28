import { describe, it, expect } from "vitest";
import { motivoRede } from "@/lib/redeRetornos";

describe("motivoRede", () => {
  it("traduz 111 como saldo insuficiente", () => {
    expect(motivoRede("111", "Unauthorized. Insufficient funds.")).toContain("saldo ou limite insuficiente (código 111)");
  });
  it("código desconhecido mostra mensagem original e código", () => {
    expect(motivoRede("999", "Weird error")).toBe("Weird error (código 999)");
  });
});
