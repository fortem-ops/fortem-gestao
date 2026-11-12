import { describe, expect, it } from "vitest";
import {
  AREA_SEGURA, LOGO_PROPORCAO, PRETO, BRANCO, STORIES, VERMELHO, CINZA, altaFaixa, caixaTexto, layoutFoto, layoutStories, pretoEBranco,
  type Cor, type Elemento, type Layout, type Medir,
} from "@/lib/molduraFotos";

const ev = { data: "2026-11-14", texto_assinatura: "10 ANOS", local: "AV. INDEPENDÊNCIA 358" };
// Aproximação conservadora da largura do Archivo (mais larga que a real).
const medir: Medir = (t, f) => t.length * f.tamanho * (f.peso === 700 ? 0.62 : 0.56) + (f.espaco ?? 0) * t.length;
const casos = { horizontal: [6000, 4000], vertical: [3024, 4032] } as const;
const cores: Cor[] = ["colorida", "pb"];
const textos = (l: Layout) => l.elementos.filter((e): e is Extract<Elemento, { tipo: "texto" }> => e.tipo === "texto");
const logos = (l: Layout) => l.elementos.filter((e): e is Extract<Elemento, { tipo: "logo" }> => e.tipo === "logo");

describe("formato FOTO", () => {
  it.each(Object.entries(casos))("%s: imagem inteira + faixa preta de 7%%", (_n, [w, h]) => {
    const l = layoutFoto(w, h, ev, medir);
    expect(l.altura).toBe(h + Math.round(h * 0.07));
    const foto = l.elementos.find((e) => e.tipo === "foto")!;
    expect(foto).toMatchObject({ x: 0, y: 0, w, h, recorte: { x: 0, y: 0, w, h } });
    const [logo] = logos(l);
    expect(logo.variante).toBe("branco");
    expect(logo.x).toBeLessThan(w / 2);
    const [ass, data] = textos(l);
    expect(ass).toMatchObject({ texto: "10 ANOS", cor: VERMELHO });
    expect(data).toMatchObject({ texto: "14.11.2026", cor: CINZA });
    for (const t of textos(l)) { const c = caixaTexto(t, medir); expect(c.x).toBeGreaterThan(logo.x + logo.w); expect(c.x + c.w).toBeLessThanOrEqual(w); expect(c.y).toBeGreaterThanOrEqual(h); }
  });
  it("faixa tem no mínimo 60px", () => { expect(altaFaixa(400)).toBe(60); expect(layoutFoto(600, 400, ev, medir).altura).toBe(460); });
});

describe("STORIES 1080×1920", () => {
  for (const [nome, [w, h]] of Object.entries(casos)) for (const cor of cores) {
    it(`${nome} ${cor}: modelo, logo sem distorção e textos na área segura`, () => {
      const l = layoutStories(w, h, cor, ev, medir);
      expect([l.largura, l.altura]).toEqual([STORIES.largura, STORIES.altura]);
      expect(l.modelo).toBe(nome === "horizontal" ? "papel-branco" : "tela-cheia");
      for (const g of logos(l)) expect(Math.abs(g.w / g.h - LOGO_PROPORCAO)).toBeLessThan(0.05);
      for (const t of textos(l)) {
        const c = caixaTexto(t, medir);
        expect(c.x).toBeGreaterThanOrEqual(AREA_SEGURA.lado);
        expect(c.x + c.w).toBeLessThanOrEqual(STORIES.largura - AREA_SEGURA.lado);
        expect(c.y).toBeGreaterThanOrEqual(AREA_SEGURA.topo);
        expect(c.y + c.h).toBeLessThanOrEqual(STORIES.altura - AREA_SEGURA.base);
      }
      expect(textos(l).map((t) => t.texto)).toEqual(expect.arrayContaining(["Não é sobre onde eu treino.", "É sobre quem eu sou.", "@sou.fortem"]));
      // Regra de cor: colorida = identidade em preto e branco; P&B = entra o vermelho.
      const vermelhos = l.elementos.filter((e) => "cor" in e && e.cor === VERMELHO).length;
      if (cor === "pb") expect(vermelhos).toBeGreaterThanOrEqual(2);
      if (cor === "colorida" && l.modelo === "papel-branco") expect(vermelhos).toBe(0);
      const foto = l.elementos.find((e) => e.tipo === "foto")!;
      if (foto.tipo === "foto") expect(Math.abs(foto.w / foto.h - foto.recorte.w / foto.recorte.h)).toBeLessThan(0.01);
    });
  }
  it("papel branco não corta a foto horizontal e a mantém dentro das laterais", () => {
    const l = layoutStories(6000, 4000, "colorida", ev, medir);
    const f = l.elementos.find((e) => e.tipo === "foto")!;
    expect(f.tipo === "foto" && f.recorte).toEqual({ x: 0, y: 0, w: 6000, h: 4000 });
    expect(f.x).toBeGreaterThanOrEqual(AREA_SEGURA.lado); expect(f.x + f.w).toBeLessThanOrEqual(1080 - AREA_SEGURA.lado);
  });
  it("foto muito clara: cantoneira vira preta na colorida e papel ganha contorno", () => {
    const clara = { media: 0.95, canto: 0.97 };
    const v = layoutStories(3024, 4032, "colorida", ev, medir, clara);
    const cant = v.elementos.filter((e) => e.tipo === "fundo" && (e.w === 6 || e.h === 6));
    expect(cant.every((e) => "cor" in e && e.cor === PRETO)).toBe(true);
    expect(layoutStories(3024, 4032, "colorida", ev, medir).elementos.filter((e) => e.tipo === "fundo" && e.w === 6).every((e) => "cor" in e && e.cor === BRANCO)).toBe(true);
    expect(layoutStories(3024, 4032, "pb", ev, medir, clara).elementos.filter((e) => e.tipo === "fundo" && e.w === 6).every((e) => "cor" in e && e.cor === VERMELHO)).toBe(true);
    const h = layoutStories(6000, 4000, "pb", ev, medir, clara).elementos.find((e) => e.tipo === "foto");
    expect(h?.tipo === "foto" && h.contorno).toBeTruthy();
  });
});

it("P&B por pixels: cinza com luminância e alfa preservado", () => {
  const px = new Uint8ClampedArray([255, 0, 0, 200, 255, 255, 255, 255]);
  pretoEBranco(px);
  expect([...px]).toEqual([76, 76, 76, 200, 255, 255, 255, 255]);
});
