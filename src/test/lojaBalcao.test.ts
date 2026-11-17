import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calcularDesconto, situacaoItem } from "@/lib/lojaBalcao";

describe("venda de produtos no balcão", () => {
  it("desconto em R$ nunca passa do total", () => {
    expect(calcularDesconto(100, "valor", 30)).toBe(30);
    expect(calcularDesconto(100, "valor", 150)).toBe(100);
  });
  it("desconto em % é limitado a 100%", () => {
    expect(calcularDesconto(250, "percentual", 10)).toBe(25);
    expect(calcularDesconto(250, "percentual", 120)).toBe(250);
  });
  it("sem estoque só entra como encomenda se o produto permitir", () => {
    expect(situacaoItem(2, 2, false)).toBe("disponivel");
    expect(situacaoItem(0, 1, true)).toBe("encomenda");
    expect(situacaoItem(0, 1, false)).toBe("bloqueado");
  });
  it("servidor reaproveita o pedido pela chave e baixa o estoque uma vez", () => {
    const sql = readFileSync("drizzle/migrations/0281_loja_venda_balcao.sql", "utf8");
    expect(sql).toMatch(/SELECT \* INTO _existente FROM public\.pedidos WHERE idempotency_key = _idem;\s+IF FOUND THEN/);
    expect(sql).toMatch(/SET estoque_atual = estoque_atual - _qtd/);
  });
  it("cartão salvo: no máximo uma cobrança aprovada ou em andamento por pedido", () => {
    const sql = readFileSync("drizzle/migrations/0282_pagamentos_rede_pedido_unico.sql", "utf8");
    expect(sql).toMatch(/UNIQUE INDEX[\s\S]*\(pedido_id\)[\s\S]*'approved','pending'/);
  });
});
