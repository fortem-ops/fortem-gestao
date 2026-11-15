import { describe, expect, it } from "vitest";
import {
  dimensoesMiniatura, planoOriginal, proximoLimite, tipoMiniatura, urlGrade, FOTOS_POR_LOTE_GRADE, LADO_ORIGINAL_MAX,
} from "@/lib/fotosEventos";
import { escalaMoldura, LADO_FONTE_STORIES } from "@/lib/molduraFotos";

describe("Fotos — miniatura da grade", () => {
  it("maior lado 400px, mesma proporção, sem ampliar", () => {
    expect(dimensoesMiniatura(1200, 800)).toEqual({ w: 400, h: 267 });
    expect(dimensoesMiniatura(800, 1200)).toEqual({ w: 267, h: 400 });
    expect(dimensoesMiniatura(1200, 1200)).toEqual({ w: 400, h: 400 });
    expect(dimensoesMiniatura(300, 200)).toEqual({ w: 300, h: 200 });
    const d = dimensoesMiniatura(4032, 3024);
    expect(Math.abs(d.w / d.h - 4032 / 3024)).toBeLessThan(0.01);
  });
  it("WebP quando o navegador gera; senão JPEG", () => {
    expect(tipoMiniatura("image/webp")).toEqual({ tipo: "image/webp", ext: "webp" });
    expect(tipoMiniatura("image/png")).toEqual({ tipo: "image/jpeg", ext: "jpg" });
  });
  it("grade usa miniatura e cai para a prévia quando ela falta", () => {
    expect(urlGrade({ url_miniatura: "m", url_previa: "p" })).toBe("m");
    expect(urlGrade({ url_miniatura: null, url_previa: "p" })).toBe("p");
    expect(urlGrade({ url_previa: "p" })).toBe("p");
  });
});

describe("Fotos — original até 2560px antes do envio", () => {
  it("foto grande deitada é reduzida a 2560 no maior lado", () => {
    expect(planoOriginal(6000, 4000, { heic: false })).toEqual({ reencodar: true, w: 2560, h: 1707 });
  });
  it("respeita a orientação: foto do celular em pé (EXIF já aplicado) fica em pé", () => {
    // Sensor grava 4032×3024 com EXIF 6; lida com orientação, chega 3024×4032.
    const r = planoOriginal(3024, 4032, { heic: false });
    expect(r).toEqual({ reencodar: true, w: 1920, h: LADO_ORIGINAL_MAX });
    expect(r.h).toBeGreaterThan(r.w);
  });
  it("foto menor não é ampliada nem regravada; HEIC sempre vira JPEG", () => {
    expect(planoOriginal(2000, 1500, { heic: false })).toEqual({ reencodar: false, w: 2000, h: 1500 });
    expect(planoOriginal(2560, 1440, { heic: false }).reencodar).toBe(false);
    expect(planoOriginal(2000, 1500, { heic: true })).toEqual({ reencodar: true, w: 2000, h: 1500 });
  });
});

describe("Fotos — carregamento progressivo", () => {
  it("começa com 12 e soma 12 a cada rolagem, sem passar do total", () => {
    expect(FOTOS_POR_LOTE_GRADE).toBe(12);
    expect(proximoLimite(0, 47)).toBe(12);
    expect(proximoLimite(12, 47)).toBe(24);
    expect(proximoLimite(36, 47)).toBe(47);
    expect(proximoLimite(47, 47)).toBe(47);
  });
});

describe("Molduras — fonte do Stories", () => {
  it("Stories usa no máximo 2048px; FOTO continua do original", () => {
    expect(LADO_FONTE_STORIES).toBe(2048);
    expect(Math.round(2560 * escalaMoldura("stories", 2560, 1707))).toBe(2048);
    expect(escalaMoldura("foto", 2560, 1707)).toBe(1);
    expect(escalaMoldura("stories", 1200, 800)).toBe(1);
  });
});
