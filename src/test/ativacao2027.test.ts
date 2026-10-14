import { describe, it, expect } from "vitest";
import { estadoAtivacao, podeAtivarAgora } from "@/lib/ativacao2027";

describe("ativação das propostas do site", () => {
  it("proposta sem pagamento não é ativada", () => {
    expect(estadoAtivacao({ pago_em: null, ativada_em: null })).toBe("nao_paga");
    expect(podeAtivarAgora({ isAdmin: true, pago_em: null })).toBe(false);
  });
  it("paga e não ativada: só admin vê Ativar agora", () => {
    const p = { pago_em: "2026-10-14T10:00:00Z", ativada_em: null };
    expect(estadoAtivacao(p)).toBe("pendente");
    expect(podeAtivarAgora({ ...p, isAdmin: true })).toBe(true);
    expect(podeAtivarAgora({ ...p, isAdmin: false })).toBe(false);
  });
  it("já ativada não oferece nova ativação", () => {
    expect(podeAtivarAgora({ isAdmin: true, pago_em: "2026-10-14T10:00:00Z", ativada_em: "2026-10-14T10:01:00Z" })).toBe(false);
  });
});
