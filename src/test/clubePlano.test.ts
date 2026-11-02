import { describe, it, expect } from "vitest";
import { custoRecompensa, proximoMarco, ultimasSemanas, seloDoPlano } from "@/lib/clubePlano";

const recompensas = [
  { nome: "A", custo_pontos: 150, custo_start: 150, custo_agregador: 195 },
  { nome: "B", custo_pontos: 300, custo_start: 300, custo_agregador: null },
];

describe("clube sem níveis", () => {
  it("custo igual para Start/Power/Pro e +30% para agregador", () => {
    expect(custoRecompensa(recompensas[0], false)).toBe(150);
    expect(custoRecompensa(recompensas[1], true)).toBe(390);
  });

  it("marco usa a recompensa mais barata ainda não alcançada", () => {
    expect(proximoMarco(100, recompensas, false)).toMatchObject({ faltam: 50, custo: 150 });
    expect(proximoMarco(200, recompensas, false)).toMatchObject({ faltam: 100, custo: 300 });
    expect(proximoMarco(500, recompensas, false)).toBeNull();
  });

  it("semana cumprida quando treinos >= meta; semana atual fica de fora", () => {
    // hoje = quarta 2026-11-04; semana anterior começa 2026-10-26
    const s = ultimasSemanas(["2026-10-26", "2026-10-28", "2026-11-02", "2026-11-03"], 2, "2026-11-04", 2);
    expect(s.map((x) => x.inicio)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(s[1].cumprida).toBe(true);
    expect(s[0].cumprida).toBe(false);
  });

  it("selo só para Start, Power e Pro", () => {
    expect(seloDoPlano("pro")).toBe("pro");
    expect(seloDoPlano("agregador")).toBeNull();
    expect(seloDoPlano("consultoria")).toBeNull();
  });
});
