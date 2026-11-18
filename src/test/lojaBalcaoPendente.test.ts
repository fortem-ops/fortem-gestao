import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { podeDarBaixaPedido } from "@/lib/lojaBalcao";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((f) => f.includes("loja_balcao_pendente_sem_forma"))}`, "utf8");

describe("venda balcão pendente", () => {
  it("forma só é obrigatória quando já recebido", () => {
    expect(sql).toContain("IF _forma IS NULL AND _pago THEN RETURN jsonb_build_object('ok', false, 'error', 'forma_obrigatoria')");
  });
  it("só pedido pendente mostra Dar baixa", () => {
    expect(podeDarBaixaPedido("aguardando_pagamento")).toBe(true);
    expect(podeDarBaixaPedido("pago")).toBe(false);
    expect(podeDarBaixaPedido("cancelado")).toBe(false);
  });
});
