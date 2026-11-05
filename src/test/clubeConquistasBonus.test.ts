import { describe, it, expect } from "vitest";
import { bonusAgregador, fmtDataBr } from "@/lib/clubePlano";

describe("bônus de conquista para agregador", () => {
  it("10 Treinos (20 pts) vale 10 para agregador 0,5x", () => expect(bonusAgregador(20, 0.5)).toBe(10));
  it("arredonda para cima", () => expect(bonusAgregador(25, 0.5)).toBe(13));
});
describe("data de liberação do resgate", () => {
  it("formata dd/mm/aaaa", () => expect(fmtDataBr("2026-12-01")).toBe("01/12/2026"));
});
