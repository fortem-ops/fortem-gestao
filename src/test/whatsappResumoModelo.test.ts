import { describe, it, expect } from "vitest";
import { resumoTemplate, statusAvanca } from "../../supabase/functions/_shared/whatsapp-resumo";

describe("envio por modelo aparece na conversa", () => {
  it("monta o texto com os parâmetros do modelo", () => {
    const r = resumoTemplate("aviso_treino_experimental", [
      { type: "body", parameters: [{ type: "text", text: "Treino Experimental" }, { type: "text", text: "17:00" }, { type: "text", text: "—" }] },
    ]);
    expect(r).toBe("[Modelo: aviso_treino_experimental] Treino Experimental · 17:00");
  });
  it("usa o resumo enviado pelo chamador quando existe", () => {
    expect(resumoTemplate("x", [], "Novo agendamento 17h")).toBe("Novo agendamento 17h");
  });
  it("status só avança", () => {
    expect(statusAvanca("read", "delivered")).toBe(false);
    expect(statusAvanca("sent", "read")).toBe(true);
  });
});
