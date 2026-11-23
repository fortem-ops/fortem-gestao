import { describe, it, expect } from "vitest";
import { disparoVisivel } from "@/lib/whatsappGatilhosRemovidos";

describe("WhatsApp sem ponto", () => {
  it("esconde os gatilhos de ponto", () => {
    expect(disparoVisivel("lembrete_entrada")).toBe(false);
    expect(disparoVisivel("resumo_diario_ponto")).toBe(false);
  });
  it("mantém agenda e cobrança", () => {
    expect(disparoVisivel("resumo_avaliacao_funcional_amanha")).toBe(true);
    expect(disparoVisivel("agendamento_criado")).toBe(true);
    expect(disparoVisivel("cobranca_recusada")).toBe(true);
  });
});
