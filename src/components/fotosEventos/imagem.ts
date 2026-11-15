// Preparação das fotos no navegador: HEIC → JPEG, original até 2560px (JPEG 85), prévia 1200px e miniatura 400px.
import {
  dimensoesMiniatura, dimensoesPrevia, dHash, ehHeic, planoOriginal, tipoMiniatura,
  QUALIDADE_MINIATURA, QUALIDADE_ORIGINAL,
} from "@/lib/fotosEventos";

export type TipoOriginal = "image/jpeg" | "image/png";
export type FotoPreparada = {
  original: Blob; tipo: TipoOriginal; previa: Blob; miniatura: Blob; tipoMiniatura: "image/webp" | "image/jpeg";
  largura: number; altura: number;
};

function paraBlob(c: HTMLCanvasElement, tipo: string, q: number): Promise<Blob> {
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("falha_imagem"))), tipo, q));
}

function desenhar(fonte: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fonte, 0, 0, w, h);
  return c;
}

/** Miniatura WebP ~75 (JPEG se o navegador não gerar WebP), maior lado 400px. */
export async function gerarMiniatura(fonte: CanvasImageSource, w: number, h: number): Promise<{ blob: Blob; tipo: "image/webp" | "image/jpeg" }> {
  const d = dimensoesMiniatura(w, h);
  const c = desenhar(fonte, d.w, d.h);
  let blob = await paraBlob(c, "image/webp", QUALIDADE_MINIATURA);
  const t = tipoMiniatura(blob.type);
  if (t.tipo !== "image/webp") blob = await paraBlob(c, "image/jpeg", QUALIDADE_MINIATURA);
  c.width = c.height = 0;
  return { blob, tipo: t.tipo };
}

/** Etapas: "reduzindo" (original/prévia/miniatura) — usada na barra de progresso. */
export async function prepararFoto(file: File): Promise<FotoPreparada> {
  let fonte: Blob = file;
  const heic = ehHeic(file);
  if (heic) {
    const { default: heic2any } = await import("heic2any");
    const r = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    fonte = Array.isArray(r) ? r[0] : r;
  }
  // "from-image" aplica a orientação EXIF: largura/altura já são as da foto em pé.
  const bmp = await createImageBitmap(fonte, { imageOrientation: "from-image" });
  try {
    const plano = planoOriginal(bmp.width, bmp.height, { heic });
    let original: Blob = fonte;
    let tipo: TipoOriginal = !heic && file.type === "image/png" ? "image/png" : "image/jpeg";
    if (plano.reencodar) {
      const c = desenhar(bmp, plano.w, plano.h);
      original = await paraBlob(c, "image/jpeg", QUALIDADE_ORIGINAL); tipo = "image/jpeg";
      c.width = c.height = 0;
    }
    const p = dimensoesPrevia(bmp.width, bmp.height);
    const cp = desenhar(bmp, p.w, p.h);
    const previa = await paraBlob(cp, "image/jpeg", 0.85);
    cp.width = cp.height = 0;
    const mini = await gerarMiniatura(bmp, bmp.width, bmp.height);
    return { original, tipo, previa, miniatura: mini.blob, tipoMiniatura: mini.tipo, largura: plano.w, altura: plano.h };
  } finally { bmp.close(); }
}

/** dHash de uma imagem já carregada (para agrupar quase idênticas). */
export function hashDaImagem(img: HTMLImageElement): string | null {
  try {
    const c = document.createElement("canvas"); c.width = 9; c.height = 8;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 9, 8);
    const d = ctx.getImageData(0, 0, 9, 8).data;
    const cinza: number[] = [];
    for (let i = 0; i < d.length; i += 4) cinza.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    return dHash(cinza);
  } catch { return null; }
}
