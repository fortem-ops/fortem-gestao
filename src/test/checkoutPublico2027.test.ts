import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { iniciarCheckoutPublico, restaurarSessao, salvarSessao, lerSessao } from "@/lib/checkoutSite2027";

const ID = "11111111-1111-1111-1111-111111111111";
beforeEach(() => window.sessionStorage.clear());

describe("checkout público 2027", () => {
  it("proposta pública inicia sem prévia e recebe a sessão", async () => {
    const chamar = vi.fn().mockResolvedValue({ chave_sessao: "a".repeat(64), etapa: "identificada" });
    const r = await iniciarCheckoutPublico(ID, chamar);
    expect(chamar).toHaveBeenCalledWith("iniciar", { proposta_id: ID });
    expect(r?.sessao).toEqual({ proposta_id: ID, chave_sessao: "a".repeat(64) });
  });
  it("checkout não liberado (ou flag desligada) cai no contato", async () => {
    const chamar = vi.fn().mockRejectedValue(new Error("Checkout indisponível no momento"));
    expect(await iniciarCheckoutPublico(ID, chamar)).toBeNull();
  });
  it("sessão salva válida é restaurada", async () => {
    salvarSessao({ proposta_id: ID, chave_sessao: "b".repeat(64) });
    const r = await restaurarSessao(vi.fn().mockResolvedValue({ etapa: "contrato_aceito" }));
    expect(r?.etapa).toBe("contrato_aceito");
  });
  it("sessão inválida é apagada", async () => {
    salvarSessao({ proposta_id: ID, chave_sessao: "b".repeat(64) });
    expect(await restaurarSessao(vi.fn().mockRejectedValue(new Error("Sessão inválida")))).toBeNull();
    expect(lerSessao()).toBeNull();
  });
});
