import { describe, it, expect } from "vitest";
import { normalizarEnquadramento, enquadramentoParaLargura } from "@/site/fotosAjuste";

describe("ajuste fino das fotos do site", () => {
  it("limita posição a 0–100 e zoom a 100%–200%", () => {
    expect(normalizarEnquadramento({ x: -10, y: 140, zoom: 3 })).toEqual({ x: 0, y: 100, zoom: 2 });
    expect(normalizarEnquadramento({ x: 30, y: 70, zoom: 0.5 })).toEqual({ x: 30, y: 70, zoom: 1 });
  });
  it("usa o ajuste do celular abaixo de 768px e o do computador a partir dele", () => {
    const a = { desk: { x: 10, y: 10, zoom: 1 }, mob: { x: 90, y: 90, zoom: 1.5 } };
    expect(enquadramentoParaLargura(a, 390)).toBe(a.mob);
    expect(enquadramentoParaLargura(a, 768)).toBe(a.desk);
  });
});
