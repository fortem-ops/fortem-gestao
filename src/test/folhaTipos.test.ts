import { describe, it, expect } from "vitest";
import { dataPadrao, descricaoFolha, divergeTipo, nascePendente, padraoTrava } from "@/lib/folhaTipos";

const nov = new Date(2026, 10, 1);
describe("folhaTipos", () => {
  it("descrições por tipo", () => {
    expect(descricaoFolha("salario", "Ana", nov)).toBe("Salário Ana (nov/2026)");
    expect(descricaoFolha("13_1", "Ana", nov)).toBe("13º 1ª parcela Ana (2026)");
    expect(descricaoFolha("13_2", "Ana", nov)).toBe("13º 2ª parcela Ana (2026)");
    expect(descricaoFolha("ferias", "Ana", nov)).toBe("Férias Ana (nov/2026)");
  });
  it("trava separada por tipo", () => {
    expect(padraoTrava("13_1", nov)).toBe("13º 1ª parcela%(2026)%");
    expect(padraoTrava("13_1", nov)).not.toBe(padraoTrava("13_2", nov));
    expect(padraoTrava("salario", nov).startsWith("Salário")).toBe(true);
  });
  it("vencimento padrão", () => {
    expect(dataPadrao("salario", nov)).toBe("2026-12-05");
    expect(dataPadrao("13_1", nov)).toBe("2026-11-30");
    expect(dataPadrao("13_2", nov)).toBe("2026-12-20");
  });
  it("pendente só com data futura", () => {
    expect(nascePendente("2026-11-30", "2026-11-13")).toBe(true);
    expect(nascePendente("2026-11-13", "2026-11-13")).toBe(false);
  });
  it("aviso de divergência", () => {
    expect(divergeTipo("13_1", "salario")).toBe(true);
    expect(divergeTipo("13_1", "13")).toBe(false);
    expect(divergeTipo("salario", "13")).toBe(true);
    expect(divergeTipo("salario", "ferias")).toBe(false);
  });
});
