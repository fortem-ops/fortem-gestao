import { describe, it, expect } from "vitest";
import { podeRenovarAntecipado, inicioSugeridoRenovacao } from "@/lib/renovacaoAntecipada";

const base = { isAdmin: true, plano: { ativo: true }, semestral: false, emGrupoPix: false, carregando: false };

describe("renovação antecipada", () => {
  it("só admin pode", () => {
    expect(podeRenovarAntecipado(base)).toBe(true);
    expect(podeRenovarAntecipado({ ...base, isAdmin: false })).toBe(false);
  });
  it("vale para qualquer plano ativo, mas não inativo", () => {
    expect(podeRenovarAntecipado({ ...base, plano: { ativo: false } })).toBe(false);
    expect(podeRenovarAntecipado({ ...base, plano: null })).toBe(false);
  });
  it("esconde no Semestral e no Pix Automático por grupo", () => {
    expect(podeRenovarAntecipado({ ...base, semestral: true })).toBe(false);
    expect(podeRenovarAntecipado({ ...base, emGrupoPix: true })).toBe(false);
  });
  it("não mostra enquanto as checagens não confirmam", () => {
    expect(podeRenovarAntecipado({ ...base, carregando: true })).toBe(false);
  });
  it("sugere hoje como início", () => {
    const d = inicioSugeridoRenovacao(new Date(2026, 10, 23, 15, 30));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 23, 0]);
  });
});
