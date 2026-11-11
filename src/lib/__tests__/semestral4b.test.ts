import { describe, it, expect } from "vitest";
import { interpretarCobrancaSemestral, podeCancelarSemestral } from "@/lib/semestral";

describe("Plano Semestral 4B — 1ª mensalidade no cartão", () => {
  it("aprovação ativa e não oferece nova cobrança", () => {
    const e = interpretarCobrancaSemestral({ success: true });
    expect(e.estado).toBe("aprovado");
    expect(e.podeTentarDeNovo).toBe(false);
  });
  it("recusa mostra o motivo e permite tentar de novo", () => {
    const e = interpretarCobrancaSemestral({ success: false, recusado: true, return_message: "Saldo insuficiente" });
    expect(e.estado).toBe("recusado");
    expect(e.mensagem).toContain("Saldo insuficiente");
    expect(e.podeTentarDeNovo).toBe(true);
  });
  it("clique repetido com pagamento em processamento não permite nova cobrança", () => {
    expect(interpretarCobrancaSemestral({ em_processamento: true }).podeTentarDeNovo).toBe(false);
    expect(interpretarCobrancaSemestral({ incerto: true, error: "timeout" }).podeTentarDeNovo).toBe(false);
  });
});

describe("Plano Semestral 4B — cancelamento", () => {
  const k = { plano_tipo: "semestral_2027", status: "ativo", data_cancelamento: null };
  it("só administrador vê o botão", () => {
    expect(podeCancelarSemestral(true, k)).toBe(true);
    expect(podeCancelarSemestral(false, k)).toBe(false);
  });
  it("não aparece para outros planos nem para contrato já cancelado", () => {
    expect(podeCancelarSemestral(true, { ...k, plano_tipo: "start_2027" })).toBe(false);
    expect(podeCancelarSemestral(true, { ...k, data_cancelamento: "2026-11-11" })).toBe(false);
  });
});
