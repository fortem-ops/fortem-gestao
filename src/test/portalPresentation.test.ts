import { describe, expect, it } from "vitest";
import { desafioMaisProximo, horarioFuturoPortal, percentualDesafio } from "@/components/portal/portalPresentation";
describe("horários exibidos no portal", () => {
  const agora = new Date("2026-10-20T13:29:00Z");
  it("oculta horários anteriores e iguais a 10:29 em São Paulo", () => {
    expect(horarioFuturoPortal("2026-10-20", "10:28:00", agora)).toBe(false);
    expect(horarioFuturoPortal("2026-10-20", "10:29:00", agora)).toBe(false);
    expect(horarioFuturoPortal("2026-10-20", "10:30:00", agora)).toBe(true);
  });
  it("mantém dias futuros completos", () => expect(horarioFuturoPortal("2026-10-21", "06:00:00", agora)).toBe(true));
  it("usa data de São Paulo na virada UTC", () => expect(horarioFuturoPortal("2026-10-20", "22:00:00", new Date("2026-10-21T00:30:00Z"))).toBe(true));
  it("reavalia no minuto seguinte", () => expect(horarioFuturoPortal("2026-10-20", "10:30:00", new Date("2026-10-20T13:30:00Z"))).toBe(false));
});
describe("desafios", () => {
  const d = { id: "a", titulo: "Meta", progresso_atual: 62, valor_meta: 100, data_fim: "2026-10-30" };
  it("calcula 62%", () => expect(percentualDesafio(d)).toBe(62));
  it("escolhe maior proporção sem alterar a lista", () => {
    const lista = [d, { ...d, id: "b", progresso_atual: 8, valor_meta: 10 }];
    expect(desafioMaisProximo(lista)?.id).toBe("b");
    expect(lista[0].id).toBe("a");
  });
  it("não escolhe sem ativos", () => expect(desafioMaisProximo([])).toBeUndefined());
  it("limita percentual e evita divisão por zero", () => {
    expect(percentualDesafio({ ...d, progresso_atual: 120 })).toBe(100);
    expect(percentualDesafio({ ...d, valor_meta: 0 })).toBe(0);
  });
});