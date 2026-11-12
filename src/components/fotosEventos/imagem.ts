// Preparação das fotos no navegador: HEIC → JPEG, medidas e prévia de até 1200px.
import { dimensoesPrevia, dHash, ehHeic } from "@/lib/fotosEventos";

export type FotoPreparada = { original: Blob; tipo: "image/jpeg" | "image/png"; previa: Blob; largura: number; altura: number };

function paraBlob(c: HTMLCanvasElement, tipo: string, q: number): Promise<Blob> {
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("falha_previa"))), tipo, q));
}

export async function prepararFoto(file: File): Promise<FotoPreparada> {
  let original: Blob = file;
  let tipo: "image/jpeg" | "image/png" = file.type === "image/png" ? "image/png" : "image/jpeg";
  if (ehHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const r = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    original = Array.isArray(r) ? r[0] : r; tipo = "image/jpeg";
  }
  const bmp = await createImageBitmap(original, { imageOrientation: "from-image" });
  const { w, h } = dimensoesPrevia(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const previa = await paraBlob(c, "image/jpeg", 0.85);
  const r = { original, tipo, previa, largura: bmp.width, altura: bmp.height };
  bmp.close();
  return r;
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
