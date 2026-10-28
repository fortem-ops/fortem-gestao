import { describe, it, expect } from "vitest";
import { planoBaseAtivoDe, sugerirVarianteCorrida } from "@/lib/corridaPlanoBase";

const cat = [
  { nome: "Corrida - Prospect", plano_base_requerido: null, periodo_meses: 1 },
  { nome: "Corrida - Sem Plano", plano_base_requerido: null, periodo_meses: 1 },
  { nome: "Corrida - Start", plano_base_requerido: "start", periodo_meses: 1 },
];

describe("corrida plano base", () => {
  it("start_2027 vira start", () => expect(planoBaseAtivoDe(["start_2027"])).toBe("start"));
  it("power_2027 vira power", () => expect(planoBaseAtivoDe(["power_2027", "corrida"])).toBe("power"));
  it("aluna Start 2027 recebe Corrida - Start", () =>
    expect(sugerirVarianteCorrida(cat, planoBaseAtivoDe(["start_2027"]))?.nome).toBe("Corrida - Start"));
  it("sem plano base sugere Sem Plano, não Prospect", () =>
    expect(sugerirVarianteCorrida(cat, null)?.nome).toBe("Corrida - Sem Plano"));
});
