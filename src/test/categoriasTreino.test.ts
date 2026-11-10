import { describe, it, expect } from "vitest";
import { opcoesCategoriaTreino } from "@/lib/categoriasTreino";

describe("opcoesCategoriaTreino", () => {
  it("lista códigos da parte principal", () => {
    const c = opcoesCategoriaTreino().map((o) => o.codigo);
    expect(c).toContain("DQ");
    expect(c).toContain("COND");
  });
  it("mantém categoria antiga fora da lista", () => {
    expect(opcoesCategoriaTreino("Quadril")[0].codigo).toBe("Quadril");
  });
});
