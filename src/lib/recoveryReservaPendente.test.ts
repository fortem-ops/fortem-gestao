// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { lerReservaPendente, salvarReservaPendente, VALIDADE_RESERVA_MS } from "./recoveryReservaPendente";

const base = { aluno_id: "a1", agenda_id: "g1", data: "2026-11-10", atividade: "Recovery (Bota de Compressão)", horario: "08:00" };

describe("horário guardado da compra avulsa de Recovery", () => {
  beforeEach(() => localStorage.clear());

  it("vale por 2 horas", () => {
    expect(VALIDADE_RESERVA_MS).toBe(2 * 60 * 60 * 1000);
    salvarReservaPendente(base, 1000);
    expect(lerReservaPendente("a1", 1000 + VALIDADE_RESERVA_MS - 1)?.agenda_id).toBe("g1");
  });

  it("expira depois de 2 horas", () => {
    salvarReservaPendente(base, 1000);
    expect(lerReservaPendente("a1", 1000 + VALIDADE_RESERVA_MS + 1)).toBeNull();
  });

  it("não aplica a outro aluno", () => {
    salvarReservaPendente(base, 1000);
    expect(lerReservaPendente("outro", 1000)).toBeNull();
  });
});
