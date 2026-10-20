import { describe, it, expect, vi } from "vitest";
import { executarPrimeiroCiclo } from "../manual-primeiro-ciclo";

describe("primeiro ciclo manual recorrente", () => {
  it("usa R$403,00 reservado pelo servidor e vincula o pagamento aprovado", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { handled: true, nova: true, pagamento_id: "p1", valor_centavos: 40300 } })
      .mockResolvedValueOnce({ data: { handled: true, success: true, tid: "10472610201229413568" } });
    const cobrar = vi.fn().mockResolvedValue({ approved: true, returnCode: "00", tid: "10472610201229413568", nsu: "502906899" });
    const res = await executarPrimeiroCiclo({ rpc }, "v1", "key", "token", "c1", null, cobrar);
    expect(cobrar).toHaveBeenCalledWith(40300);
    expect(rpc.mock.calls[1][1].p_pagamento_id).toBe("p1");
    expect(rpc.mock.calls[1][1].p_resultado.nsu).toBe("502906899");
    expect(res.success).toBe(true);
  });
  it("reexecução aprovada concilia sem recobrar", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: { handled: true, success: true, idempotente: true } }) };
    const cobrar = vi.fn();
    for (let i = 0; i < 2; i++) expect((await executarPrimeiroCiclo(db, "v", "k", "token", "c", null, cobrar)).idempotente).toBe(true);
    expect(cobrar).not.toHaveBeenCalled();
  });
  it("reserva pendente impede nova cobrança", async () => {
    const cobrar = vi.fn();
    const db = { rpc: vi.fn().mockResolvedValue({ data: { handled: true, em_processamento: true } }) };
    expect((await executarPrimeiroCiclo(db, "v", "k", "token", "c", null, cobrar)).em_processamento).toBe(true);
    expect(cobrar).not.toHaveBeenCalled();
  });
  it("divergência aborta antes da Rede", async () => {
    const cobrar = vi.fn();
    await expect(executarPrimeiroCiclo({ rpc: vi.fn().mockResolvedValue({ error: { message: "Valor divergente" } }) }, "v", "k", "token", "c", null, cobrar)).rejects.toThrow("Valor divergente");
    expect(cobrar).not.toHaveBeenCalled();
  });
  it("checkout público não é tratado pelo fluxo manual", async () => {
    const cobrar = vi.fn();
    expect((await executarPrimeiroCiclo({ rpc: vi.fn().mockResolvedValue({ data: { handled: false } }) }, "v", "k", "token", "c", null, cobrar)).handled).toBe(false);
    expect(cobrar).not.toHaveBeenCalled();
  });
});