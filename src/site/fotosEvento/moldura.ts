// Desenha as molduras no navegador (canvas → JPEG 90) e entrega o arquivo (compartilhar ou baixar).
import JSZip from "jszip";
import logoBranco from "@/assets/fotos-evento/logo-fortem-branco.svg.asset.json";
import logoPreto from "@/assets/fotos-evento/logo-fortem-preto.svg.asset.json";
import {
  claridade, escalaSegura, layoutFoto, layoutStories, nomeArquivo, pretoEBranco,
  type Claridade, type Cor, type DadosEvento, type Fonte, type Formato, type Layout,
} from "@/lib/molduraFotos";

const fonteCss = (f: Fonte) => `${f.peso} ${f.tamanho}px Archivo, sans-serif`;
type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

let fontes: Promise<void> | null = null;
/** Archivo 400 e 700 precisam estar carregadas antes de medir/desenhar. */
export function carregarFontes(): Promise<void> {
  fontes ??= Promise.all([document.fonts.load("400 40px Archivo"), document.fonts.load("700 40px Archivo")]).then(() => undefined);
  return fontes;
}

const logos = new Map<string, Promise<HTMLImageElement>>();
/** SVG original, com largura/altura explícitas para o navegador rasterizar sem distorcer. */
function carregarLogo(v: "branco" | "preto"): Promise<HTMLImageElement> {
  if (!logos.has(v)) logos.set(v, (async () => {
    const svg = await (await fetch(v === "branco" ? logoBranco.url : logoPreto.url)).text();
    const com = svg.replace(/<svg\b/, '<svg width="2283" height="408" preserveAspectRatio="xMidYMid meet"');
    return carregarImagem(new Blob([com], { type: "image/svg+xml" }));
  })());
  return logos.get(v)!;
}

async function carregarImagem(b: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(b);
  const img = new Image(); img.src = url;
  try { await img.decode(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return img;
}

/** Original pela URL assinada (CORS), como blob para não "sujar" o canvas. */
export async function carregarFoto(url: string): Promise<HTMLImageElement> {
  const r = await fetch(url, { mode: "cors" });
  if (!r.ok) throw new Error("foto_indisponivel");
  return carregarImagem(await r.blob());
}

function medirCom(ctx: Ctx) {
  return (texto: string, f: Fonte) => {
    ctx.font = fonteCss(f);
    if ("letterSpacing" in ctx) { ctx.letterSpacing = `${f.espaco ?? 0}px`; return ctx.measureText(texto).width; }
    return ctx.measureText(texto).width + (f.espaco ?? 0) * texto.length;
  };
}

function medirClaridade(img: HTMLImageElement): Claridade {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, 64, 64);
  return { media: claridade(x.getImageData(0, 0, 64, 64).data), canto: claridade(x.getImageData(44, 6, 18, 12).data) };
}

export type Gerada = { blob: Blob; nome: string; largura: number; altura: number };

export async function gerarMoldura(img: HTMLImageElement, formato: Formato, cor: Cor, ev: DadosEvento, n = 1): Promise<Gerada> {
  await carregarFontes();
  const [lb, lp] = await Promise.all([carregarLogo("branco"), carregarLogo("preto")]);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  // Foto P&B: pixels convertidos numa tela à parte, antes da moldura (o vermelho da identidade fica).
  const k = escalaSegura(w0, h0 * 1.07);
  const fw = Math.round(w0 * k), fh = Math.round(h0 * k);
  const fc = document.createElement("canvas"); fc.width = fw; fc.height = fh;
  const fx = fc.getContext("2d", { willReadFrequently: cor === "pb" })!;
  fx.drawImage(img, 0, 0, fw, fh);
  if (cor === "pb") { const d = fx.getImageData(0, 0, fw, fh); pretoEBranco(d.data); fx.putImageData(d, 0, 0); }

  const c = document.createElement("canvas");
  const ctx = c.getContext("2d") as Ctx;
  const medir = medirCom(ctx);
  const lay: Layout = formato === "foto" ? layoutFoto(fw, fh, ev, medir) : layoutStories(fw, fh, cor, ev, medir, medirClaridade(img));
  c.width = lay.largura; c.height = lay.altura;
  ctx.imageSmoothingQuality = "high";
  for (const e of lay.elementos) {
    if (e.tipo === "fundo") { ctx.fillStyle = e.cor; ctx.fillRect(e.x, e.y, e.w, e.h); }
    else if (e.tipo === "foto") {
      ctx.drawImage(fc, e.recorte.x, e.recorte.y, e.recorte.w, e.recorte.h, e.x, e.y, e.w, e.h);
      if (e.contorno) { ctx.strokeStyle = e.contorno; ctx.lineWidth = 1; ctx.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1); }
    } else if (e.tipo === "logo") ctx.drawImage(e.variante === "branco" ? lb : lp, e.x, e.y, e.w, e.h);
    else {
      ctx.font = fonteCss(e.fonte);
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${e.fonte.espaco ?? 0}px`;
      ctx.fillStyle = e.cor; ctx.textBaseline = "alphabetic";
      // Alinha pela esquerda calculada, para o espaçamento de letras não deslocar a borda direita.
      const x = e.alinhar === "right" ? e.x - medir(e.texto, e.fonte) : e.x;
      ctx.textAlign = "left";
      ctx.fillText(e.texto, x, e.y);
    }
  }
  const blob = await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("falha_jpeg"))), "image/jpeg", 0.9));
  c.width = c.height = fc.width = fc.height = 0;
  return { blob, nome: nomeArquivo(n, formato, cor), largura: lay.largura, altura: lay.altura };
}

export const toqueComCompartilhar = (arquivos: File[]) =>
  typeof navigator !== "undefined" && matchMedia("(pointer: coarse)").matches && !!navigator.canShare?.({ files: arquivos });

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Chamar direto no clique (sem await antes): no iPhone o compartilhar oferece "Salvar imagem" e Stories. */
export async function entregar(gs: Gerada[], zip?: Blob, nomeZip = "fortem-10anos-fotos.zip"): Promise<void> {
  const arquivos = gs.map((g) => new File([g.blob], g.nome, { type: "image/jpeg" }));
  if (toqueComCompartilhar(arquivos)) {
    try { await navigator.share({ files: arquivos }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  if (gs.length === 1) { baixarBlob(gs[0].blob, gs[0].nome); return; }
  baixarBlob(zip ?? (await montarZip(gs)), nomeZip);
}

export function montarZip(gs: Gerada[]): Promise<Blob> {
  const zip = new JSZip();
  gs.forEach((g) => zip.file(g.nome, g.blob));
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
