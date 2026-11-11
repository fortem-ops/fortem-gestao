import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
let linhas: { id: string; pix_aut_grupo_id: string | null }[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ in: async () => ({ data: linhas, error: null }) }) }),
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));

import { confirmarBaixaReservadaPix, reservadasPix } from "@/lib/pixAutReserva";

describe("baixa manual de mensalidade reservada ao Pix Automático", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });

  it("sem reserva: segue sem perguntar nem liberar", async () => {
    linhas = [{ id: "c1", pix_aut_grupo_id: null }];
    const confirmar = vi.fn(() => true);
    expect(await confirmarBaixaReservadaPix(["c1"], confirmar)).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reservada e equipe desiste: não libera e não dá baixa", async () => {
    linhas = [{ id: "c1", pix_aut_grupo_id: "g1" }];
    expect(await confirmarBaixaReservadaPix(["c1"], () => false)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reservada e confirmada: libera só a reservada no servidor", async () => {
    linhas = [{ id: "c1", pix_aut_grupo_id: "g1" }, { id: "c2", pix_aut_grupo_id: null }];
    expect(await confirmarBaixaReservadaPix(["c1", "c2"], () => true)).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("fn_pix_aut_liberar_reserva", { p_tabela: "cobrancas", p_id: "c1", p_motivo: "baixa manual confirmada" });
  });

  it("reservadasPix filtra só linhas com grupo", () => {
    expect(reservadasPix([{ id: "a", pix_aut_grupo_id: "g" }, { id: "b", pix_aut_grupo_id: null }])).toEqual(["a"]);
  });
});
