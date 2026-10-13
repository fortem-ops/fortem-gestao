import { beforeEach, describe, expect, it } from "vitest";
import { etapaReservada, guardarConfirmacao } from "@/lib/checkoutReservado2027";
import { pagamentoReservado, parcelasReservadas } from "../../supabase/functions/_shared/checkout-pagamento-reservado";

describe("pagamento reservado 2D-2", () => {
  beforeEach(() => sessionStorage.clear());
  const revisao = { forma_plano: "cartao_parcelado", plano_centavos: 514800, parcelas_plano: 12, servicos_centavos: 162000, forma_servicos: null };
  it("cartão: mantém as 12 parcelas calculadas no servidor com consultas juntas", () => {
    const p = pagamentoReservado(revisao);
    expect(p.formas_permitidas).toEqual(["cartao_parcelado"]);
    expect(p.parcelas).toEqual(Array(12).fill(56400));
    expect(p.parcelas_servicos).toEqual([]);
    expect(p.reservado).toBe(true);
  });
  it("Pix à vista: uma parcela e validade futura de 30 minutos", () => {
    const p = pagamentoReservado({ ...revisao, forma_plano: "pix_vista", parcelas_plano: 1, forma_servicos: "cartao_parcelado", parcelas_servicos: 6 });
    expect(p.formas_permitidas).toEqual(["pix_vista"]);
    expect(p.parcelas).toEqual([514800]);
    expect(p.validade_pix_segundos).toBe(30 * 60);
    expect(p.parcelas_servicos).toEqual(Array(6).fill(27000));
  });
  it("recorrência: primeira mensalidade e consultas separadas", () => {
    const p = pagamentoReservado({ ...revisao, forma_plano: "recorrencia", plano_centavos: 45390 * 12, forma_servicos: "pix_vista" });
    expect(p.formas_permitidas).toEqual(["recorrencia"]);
    expect(p.parcelas).toEqual(Array(12).fill(45390));
    expect(p.parcelas_servicos).toEqual([162000]);
  });
  it("não oferece Pix nem parcelamento no Start recorrente", () => {
    expect(pagamentoReservado({ ...revisao, forma_plano: "recorrencia", plano_centavos: 49900, parcelas_plano: 1, servicos_centavos: 0 }).formas_permitidas).toEqual(["recorrencia"]);
  });
  it("sobra de centavos só na última parcela e nunca mais de 12x", () => {
    expect(parcelasReservadas(1000, 3)).toEqual([333, 333, 334]);
    expect(parcelasReservadas(1200, 13)).toHaveLength(12);
  });
  it("aceite confirmado pelo servidor retoma Pagamento e depois Confirmação", () => {
    expect(etapaReservada("contrato_aceito", "p1", "a1")).toBe("pagamento");
    guardarConfirmacao("p1", "a1");
    expect(etapaReservada("contrato_aceito", "p1", "a1")).toBe("confirmacao");
  });
  it("alteração que invalida aceite não retoma confirmação antiga", () => {
    guardarConfirmacao("p1", "a1");
    expect(etapaReservada("identificada", "p1", null)).toBe("revisao");
    expect(etapaReservada("contrato_aceito", "p1", "a2")).toBe("pagamento");
    expect(etapaReservada("contrato_aceito", "p2", "a1")).toBe("pagamento");
  });
});