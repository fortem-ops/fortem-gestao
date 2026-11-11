import { describe, expect, it } from "vitest";
import { lerPrevia, mensagemWhatsappPrimeira, podeGerarPrimeira } from "../pixAutPrimeira";

const comp = { itens: [
  { descricao: "Start", valor: 150, cobranca_id: "c1", venda_id: "v1", vencimento: "2026-11-12" },
  { descricao: "Corrida - Start", valor: 170, cobranca_id: null, venda_id: "v2", vencimento: "2026-11-12" },
], bloqueios: [], valor: 320, completo: true };

describe("Pix da 1ª mensalidade", () => {
  it("Start (cobrança + venda) conta como um item: 2 itens, total 320", () => {
    const p = lerPrevia({ disponivel: true, composicao: comp, atual: null });
    expect(p.itens).toHaveLength(2);
    expect(p.valor).toBe(320);
    expect(podeGerarPrimeira(p)).toBe(true);
  });
  it("não oferece novo Pix quando já há um ativo ou pago no mês", () => {
    for (const status of ["ativa", "liquidada", "divergente", "conferencia"]) {
      expect(podeGerarPrimeira(lerPrevia({ disponivel: true, composicao: comp, atual: { status, valor: 320 } }))).toBe(false);
    }
  });
  it("sem pendências fora do débito automático, não oferece", () => {
    expect(podeGerarPrimeira(lerPrevia({ disponivel: true, composicao: { itens: [], valor: 0, completo: false } }))).toBe(false);
    expect(podeGerarPrimeira(lerPrevia({ disponivel: false }))).toBe(false);
  });
  it("mensagem de WhatsApp traz itens, total e o código", () => {
    const m = mensagemWhatsappPrimeira(lerPrevia({ composicao: comp }).itens, 320, "000201XYZ", "2026-11-13T10:00:00Z").replace(/\u00a0/g, " ");
    expect(m).toContain("Start: R$ 150,00");
    expect(m).toContain("Total: R$ 320,00");
    expect(m).toContain("000201XYZ");
  });
});
