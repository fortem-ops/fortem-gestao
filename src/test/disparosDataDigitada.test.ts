import { describe, it, expect } from "vitest";
import { brParaIso, mascararDataBr } from "@/lib/disparos";
describe("data digitada", () => {
  it("válida", () => { expect(brParaIso("05/03/2018")).toBe("2018-03-05"); expect(brParaIso("29/02/2024")).toBe("2024-02-29"); });
  it("inexistente", () => { expect(brParaIso("31/02/2026")).toBeNull(); expect(brParaIso("29/02/2023")).toBeNull(); expect(brParaIso("10/13/2020")).toBeNull(); });
  it("incompleta/vazia", () => { expect(brParaIso("05/03/20")).toBeNull(); expect(brParaIso("")).toBeNull(); });
  it("máscara", () => { expect(mascararDataBr("05032018")).toBe("05/03/2018"); expect(mascararDataBr("0503")).toBe("05/03"); expect(mascararDataBr("ab1")).toBe("1"); expect(mascararDataBr("050320189")).toBe("05/03/2018"); });
});
