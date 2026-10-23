import { describe, it, expect } from "vitest";
import { rotuloVigenciaNovo } from "@/lib/vigenciaLabels";
import { duracaoRealContrato } from "@/lib/contratoValores";
import { PLANO_LABELS } from "@/types/financeiro";
import { LABEL_PLANO } from "@/lib/contratos-calc";

describe("rótulos da Consultoria Online", () => {
  it("consultoria_2027 vira 'Consultoria Online'", () => {
    expect(PLANO_LABELS.consultoria_2027).toBe("Consultoria Online");
    expect(LABEL_PLANO.consultoria_2027).toBe("Consultoria Online");
  });
  it("Start/Power/Pro 2027 mantêm os rótulos", () => {
    expect(PLANO_LABELS.start_2027).toBe("Start");
    expect(PLANO_LABELS.power_2027).toBe("Power");
    expect(PLANO_LABELS.pro_2027).toBe("Pro");
  });
});

describe("mapa de vigência", () => {
  it("quadrimestral vira '4 meses' em qualquer plano", () => {
    expect(rotuloVigenciaNovo("quadrimestral", "consultoria_2027")).toBe("4 meses");
    expect(rotuloVigenciaNovo("quadrimestral", null)).toBe("4 meses");
  });
  it("Consultoria mensal e semestral ganham rótulo", () => {
    expect(rotuloVigenciaNovo("mensal", "consultoria_2027")).toBe("Mensal");
    expect(rotuloVigenciaNovo("semestral", "consultoria_2027")).toBe("Semestral");
  });
  it("planos antigos ficam com o texto legado (null)", () => {
    for (const p of ["start_2027", "power_2027", "pro_2027", "start", "power", "pro"]) {
      for (const v of ["mensal", "semestral", "anual"]) {
        expect(rotuloVigenciaNovo(v, p)).toBeNull();
      }
    }
  });
  it("duração sem datas: quadrimestral 4, demais iguais", () => {
    expect(duracaoRealContrato({ vigencia_tipo: "quadrimestral" } as any)).toBe(4);
    expect(duracaoRealContrato({ vigencia_tipo: "semestral" } as any)).toBe(6);
    expect(duracaoRealContrato({ vigencia_tipo: "anual" } as any)).toBe(12);
    expect(duracaoRealContrato({ vigencia_tipo: "mensal" } as any)).toBe(1);
  });
});
