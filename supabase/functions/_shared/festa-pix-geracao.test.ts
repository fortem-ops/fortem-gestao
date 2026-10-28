import { describe, expect, it, vi } from "vitest";
vi.mock("./inter-cob.ts", () => ({ interCobFetch: vi.fn() }));
import { deveGerarPix } from "./festa-pix";
import { totalFesta } from "./festa-valor";

describe("geração de PIX na confirmação da festa", () => {
  it("voucher R$ 20 por pessoa (3 pessoas = R$ 165) gera PIX", () => {
    const total = totalFesta(2, false, 2000);
    expect(total).toBe(16500);
    expect(deveGerarPix("aguardando_pagamento", total)).toBe(true);
  });

  it("voucher integral (isento, total 0) não gera PIX", () => {
    expect(deveGerarPix("isento", totalFesta(2, true))).toBe(false);
    expect(deveGerarPix("isento", 0)).toBe(false);
  });

  it("desconto que zera o total não gera PIX", () => {
    expect(deveGerarPix("isento", totalFesta(1, false, 9000))).toBe(false);
  });

  it("sem desconto continua gerando PIX", () => {
    expect(deveGerarPix("aguardando_pagamento", totalFesta(0))).toBe(true);
  });

  it("não gera PIX para quem já pagou ou cancelou", () => {
    expect(deveGerarPix("confirmado", 15000)).toBe(false);
    expect(deveGerarPix("cancelado", 15000)).toBe(false);
  });

  it("total ausente ou zerado não gera PIX", () => {
    expect(deveGerarPix("aguardando_pagamento", 0)).toBe(false);
    expect(deveGerarPix("aguardando_pagamento", null)).toBe(false);
    expect(deveGerarPix(null, 15000)).toBe(false);
  });
});
