import { describe, it, expect } from "vitest";
import { vendaEncerrada } from "../../supabase/functions/_shared/semestral-link";

describe("link de pagamento após cartão recusado", () => {
  it("venda com falha continua aceitando nova tentativa", () => {
    expect(vendaEncerrada("falha")).toBe(false);
  });
  it("cancelada e estornada encerram o link", () => {
    expect(vendaEncerrada("cancelado")).toBe(true);
    expect(vendaEncerrada("estornado")).toBe(true);
  });
});
