import { describe, it, expect } from "vitest";
import { ultimoDiaDoMes, novaDataFimValida } from "@/lib/reativarContrato";

describe("reativar contrato", () => {
  it("sugere o último dia do mês atual", () => {
    expect(ultimoDiaDoMes(new Date(2026, 9, 19))).toBe("2026-10-31");
    expect(ultimoDiaDoMes(new Date(2027, 1, 3))).toBe("2027-02-28");
  });
  it("exige data depois do término antigo", () => {
    expect(novaDataFimValida("2026-10-31", "2026-10-17")).toBe(true);
    expect(novaDataFimValida("2026-10-17", "2026-10-17")).toBe(false);
    expect(novaDataFimValida("2026-10-10", "2026-10-17")).toBe(false);
  });
});
