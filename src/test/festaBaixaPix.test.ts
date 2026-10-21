import { describe, expect, it, vi } from "vitest";
vi.mock("../../supabase/functions/_shared/inter-cob.ts", () => ({ interCobFetch: vi.fn() }));
import { baixarPixFesta, conferirPixFesta } from "../../supabase/functions/_shared/festa-pix";
import { interCobFetch } from "../../supabase/functions/_shared/inter-cob";

function servidorSimulado(total = 15000) {
  const updates: Record<string, unknown>[] = [];
  const eventos: Record<string, unknown>[] = [];
  const conf = { id: "teste", status: "aguardando_pagamento", total_centavos: total };
  const sup = { from: (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: conf }),
      update: (values: Record<string, unknown>) => { updates.push(values); return builder; },
      insert: async (values: Record<string, unknown>) => { eventos.push(values); return { error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: [{ id: conf.id }] })),
    };
    if (table !== "festa_confirmacoes" && table !== "festa_eventos") throw Error("Módulo indevido");
    return builder;
  } };
  return { sup, updates, eventos };
}

describe("baixa PIX isolada da festa", () => {
  it("webhook confirma duas pessoas por R$ 150", async () => {
    const s = servidorSimulado();
    expect(await baixarPixFesta(s.sup, "FESTA10teste", "150.00", "webhook")).toEqual({ ok: true, motivo: "baixado" });
    expect(s.updates[0]).toMatchObject({ status: "confirmado", pago_valor_centavos: 15000 });
  });
  it("webhook recusa o preço antigo para confirmação nova", async () => {
    const s = servidorSimulado();
    expect(await baixarPixFesta(s.sup, "FESTA10teste", "160.00", "webhook")).toEqual({ ok: false, motivo: "valor_divergente" });
    expect(s.updates).toHaveLength(0);
    expect(s.eventos[0]).toMatchObject({ acao: "valor_divergente" });
  });
  it("conciliação usa a mesma validação de R$ 150", async () => {
    vi.mocked(interCobFetch).mockResolvedValueOnce({ status: 200, data: { status: "CONCLUIDA", pix: [{ valor: "150.00" }] }, raw: "" });
    const s = servidorSimulado();
    expect(await conferirPixFesta(s.sup, "FESTA10teste")).toEqual({ ok: true, motivo: "baixado" });
    expect(s.updates[0]).toMatchObject({ pago_valor_centavos: 15000 });
  });
  it("confirmação antiga mantém o valor histórico", async () => {
    const s = servidorSimulado(7000);
    expect(await baixarPixFesta(s.sup, "FESTA10teste", "70.00", "webhook")).toEqual({ ok: true, motivo: "baixado" });
    expect(s.updates[0]).toMatchObject({ pago_valor_centavos: 7000 });
  });
});