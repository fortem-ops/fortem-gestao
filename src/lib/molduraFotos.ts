// Molduras FORTEM para as fotos da festa (Fase 4). Regras puras: o desenho só segue a lista de elementos.
export type Formato = "foto" | "stories";
export type Cor = "colorida" | "pb";
export type Fonte = { peso: 400 | 700; tamanho: number; espaco?: number };
export type Medir = (texto: string, fonte: Fonte) => number;
export type Retangulo = { x: number; y: number; w: number; h: number };
export type Elemento =
  | ({ tipo: "fundo"; cor: string } & Retangulo)
  | ({ tipo: "foto"; recorte: Retangulo; contorno?: string } & Retangulo)
  | ({ tipo: "logo"; variante: "branco" | "preto" } & Retangulo)
  | { tipo: "texto"; texto: string; x: number; y: number; fonte: Fonte; cor: string; alinhar: "left" | "right" };
export type Layout = { largura: number; altura: number; modelo: "faixa" | "papel-branco" | "tela-cheia"; elementos: Elemento[] };
export type DadosEvento = { data: string; texto_assinatura: string | null; local: string | null };
/** Claridade média (0–1) da foto toda e do canto superior direito, medida antes de desenhar. */
export type Claridade = { media: number; canto: number };

export const VERMELHO = "#E73C3E";
export const CINZA = "#B1B3B3";
export const CINZA_ESCURO = "#6B6B6B";
export const PRETO = "#000000";
export const BRANCO = "#FFFFFF";
export const PAPEL = "#F2F2F2";
/** Proporção do SVG da logo (viewBox 570.68 × 101.9): nunca muda, para não distorcer. */
export const LOGO_PROPORCAO = 570.68 / 101.9;
export const STORIES = { largura: 1080, altura: 1920 };
export const AREA_SEGURA = { topo: 250, base: 340, lado: 64 };
export const FRASE: [string, string] = ["Não é sobre onde eu treino.", "É sobre quem eu sou."];
export const ARROBA = "@sou.fortem";
const CLARA = 0.82;

export function dataEvento(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${a}`;
}
export const assinatura = (ev: DadosEvento) => (ev.texto_assinatura?.trim() || "10 ANOS").toUpperCase();
export const altaFaixa = (alturaFoto: number) => Math.max(60, Math.round(alturaFoto * 0.07));
export const modeloStories = (w: number, h: number) => (w >= h ? "papel-branco" : "tela-cheia");

/** Reduz a fonte até o texto caber na largura (nunca abaixo de 60% do tamanho pedido). */
export function caber(texto: string, fonte: Fonte, largura: number, medir: Medir): Fonte {
  let t = fonte.tamanho;
  while (t > fonte.tamanho * 0.6 && medir(texto, { ...fonte, tamanho: t }) > largura) t -= 1;
  return { ...fonte, tamanho: t };
}

/** Formato FOTO: a imagem inteira, sem corte, com faixa preta embaixo (7% da altura, mínimo 60px). */
export function layoutFoto(w: number, h: number, ev: DadosEvento, medir: Medir): Layout {
  const f = altaFaixa(h);
  const pad = Math.round(f * 0.5);
  const logoH = Math.round(f * 0.34);
  const logoW = Math.round(logoH * LOGO_PROPORCAO);
  const base = h + Math.round(f / 2 + f * 0.11);
  const data = dataEvento(ev.data);
  let fonte: Fonte = { peso: 700, tamanho: Math.round(f * 0.3), espaco: Math.round(f * 0.03) };
  const livre = w - pad * 3 - logoW;
  const larg = (fn: Fonte) => medir(assinatura(ev), fn) + fn.tamanho * 0.6 + medir(data, { ...fn, peso: 400 });
  while (fonte.tamanho > 8 && larg(fonte) > livre) fonte = { ...fonte, tamanho: fonte.tamanho - 1 };
  const dataX = w - pad;
  const assX = dataX - medir(data, { ...fonte, peso: 400 }) - fonte.tamanho * 0.6;
  return {
    largura: w, altura: h + f, modelo: "faixa",
    elementos: [
      { tipo: "fundo", cor: PRETO, x: 0, y: 0, w, h: h + f },
      { tipo: "foto", recorte: { x: 0, y: 0, w, h }, x: 0, y: 0, w, h },
      { tipo: "logo", variante: "branco", x: pad, y: h + Math.round((f - logoH) / 2), w: logoW, h: logoH },
      { tipo: "texto", texto: assinatura(ev), x: assX, y: base, fonte, cor: VERMELHO, alinhar: "right" },
      { tipo: "texto", texto: data, x: dataX, y: base, fonte: { ...fonte, peso: 400 }, cor: CINZA, alinhar: "right" },
    ],
  };
}

/** Recorte "cover": preenche o destino sem distorcer, cortando o excesso no centro. */
export function recorteCobrir(w: number, h: number, dw: number, dh: number): Retangulo {
  const escala = Math.max(dw / w, dh / h);
  const sw = dw / escala, sh = dh / escala;
  return { x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh };
}

function papelBranco(w: number, h: number, cor: Cor, ev: DadosEvento, medir: Medir, clar: Claridade): Layout {
  const { largura: W, altura: H } = STORIES, S = AREA_SEGURA;
  const zona = H - S.topo - S.base;
  const cartaoW = W - S.lado * 2, pad = 28, maxFotoW = cartaoW - pad * 2;
  const logoH = 44, logoW = Math.round(logoH * LOGO_PROPORCAO);
  const fixo = logoH + 56 + pad + 24 + 26 + pad + 64 + 84 + 34 + 92 + 22 + 28;
  const ar = w / h;
  const fotoH = Math.round(Math.min(maxFotoW / ar, zona - fixo));
  const fotoW = Math.round(fotoH * ar);
  let y = S.topo + Math.round((zona - (fixo + fotoH)) / 2);
  const els: Elemento[] = [{ tipo: "fundo", cor: PAPEL, x: 0, y: 0, w: W, h: H }];
  els.push({ tipo: "logo", variante: "preto", x: Math.round((W - logoW) / 2), y, w: logoW, h: logoH });
  y += logoH + 56;
  const cartaoH = pad + fotoH + 24 + 26 + pad;
  els.push({ tipo: "fundo", cor: BRANCO, x: S.lado, y, w: cartaoW, h: cartaoH });
  const fx = Math.round((W - fotoW) / 2);
  els.push({ tipo: "foto", recorte: { x: 0, y: 0, w, h }, x: fx, y: y + pad, w: fotoW, h: fotoH, contorno: clar.media > CLARA ? CINZA : undefined });
  const linha = y + pad + fotoH + 24 + 22;
  const fLinha: Fonte = { peso: 700, tamanho: 24, espaco: 4 };
  els.push({ tipo: "texto", texto: dataEvento(ev.data), x: fx, y: linha, fonte: fLinha, cor: CINZA_ESCURO, alinhar: "left" });
  if (ev.local?.trim()) els.push({ tipo: "texto", texto: ev.local.trim().toUpperCase(), x: fx + fotoW, y: linha, fonte: caber(ev.local.trim().toUpperCase(), fLinha, fotoW / 2 - 16, medir), cor: CINZA_ESCURO, alinhar: "right" });
  y += cartaoH + 64;
  const destaque = cor === "pb" ? VERMELHO : PRETO;
  const centro = (texto: string, yy: number, fonte: Fonte, c: string) => {
    const fn = caber(texto, fonte, W - S.lado * 2, medir);
    els.push({ tipo: "texto", texto, x: (W + medir(texto, fn)) / 2, y: yy, fonte: fn, cor: c, alinhar: "right" });
  };
  centro(assinatura(ev), y + 76, { peso: 700, tamanho: 96, espaco: 4 }, destaque);
  y += 84 + 34;
  centro(FRASE[0], y + 38, { peso: 700, tamanho: 40 }, PRETO);
  centro(FRASE[1], y + 84, { peso: 700, tamanho: 40 }, PRETO);
  y += 92 + 22;
  centro(ARROBA, y + 24, { peso: 700, tamanho: 26, espaco: 2 }, cor === "pb" ? VERMELHO : CINZA_ESCURO);
  return { largura: W, altura: H, modelo: "papel-branco", elementos: els };
}

function telaCheia(w: number, h: number, cor: Cor, ev: DadosEvento, medir: Medir, clar: Claridade): Layout {
  const { largura: W, altura: H } = STORIES, S = AREA_SEGURA;
  const pb = cor === "pb";
  const els: Elemento[] = [{ tipo: "foto", recorte: recorteCobrir(w, h, W, H), x: 0, y: 0, w: W, h: H }];
  const topo = S.topo + 40;
  const logoH = 34, logoW = Math.round(logoH * LOGO_PROPORCAO), boxH = 82;
  els.push({ tipo: "fundo", cor: PRETO, x: S.lado, y: topo, w: logoW + 56, h: boxH });
  els.push({ tipo: "logo", variante: "branco", x: S.lado + 28, y: topo + (boxH - logoH) / 2, w: logoW, h: logoH });
  // Cantoneira em L: branca na colorida (preta se o canto for muito claro); vermelha na P&B.
  const cant = pb ? VERMELHO : clar.canto > CLARA ? PRETO : BRANCO;
  const dir = W - S.lado, braco = 100, esp = 6;
  els.push({ tipo: "fundo", cor: cant, x: dir - braco, y: topo, w: braco, h: esp });
  els.push({ tipo: "fundo", cor: cant, x: dir - esp, y: topo, w: esp, h: braco });
  const base = H - S.base, altura = 210, seloW = 220, gap = 28;
  const yTopo = base - altura;
  const textoW = W - S.lado * 2 - seloW - gap;
  els.push({ tipo: "fundo", cor: PRETO, x: S.lado, y: yTopo, w: textoW, h: altura });
  const fFrase = caber(FRASE[0], { peso: 700, tamanho: 38 }, textoW - 64, medir);
  els.push({ tipo: "texto", texto: FRASE[0], x: S.lado + 32, y: yTopo + 70, fonte: fFrase, cor: BRANCO, alinhar: "left" });
  els.push({ tipo: "texto", texto: FRASE[1], x: S.lado + 32, y: yTopo + 120, fonte: fFrase, cor: pb ? VERMELHO : BRANCO, alinhar: "left" });
  els.push({ tipo: "texto", texto: ARROBA, x: S.lado + 32, y: yTopo + 172, fonte: { peso: 700, tamanho: 26, espaco: 2 }, cor: pb ? VERMELHO : CINZA, alinhar: "left" });
  const seloX = dir - seloW;
  els.push({ tipo: "fundo", cor: pb ? VERMELHO : PRETO, x: seloX, y: yTopo, w: seloW, h: altura });
  const [l1, ...resto] = assinatura(ev).split(" ");
  const l2 = resto.join(" ");
  const f1 = caber(l1, { peso: 700, tamanho: 72 }, seloW - 56, medir);
  const f2 = caber(l2, { peso: 700, tamanho: 46, espaco: 4 }, seloW - 56, medir);
  els.push({ tipo: "texto", texto: l1, x: seloX + 28, y: yTopo + (l2 ? 118 : 140), fonte: f1, cor: pb ? BRANCO : VERMELHO, alinhar: "left" });
  if (l2) els.push({ tipo: "texto", texto: l2, x: seloX + 28, y: yTopo + 172, fonte: f2, cor: BRANCO, alinhar: "left" });
  return { largura: W, altura: H, modelo: "tela-cheia", elementos: els };
}

export function layoutStories(w: number, h: number, cor: Cor, ev: DadosEvento, medir: Medir, clar: Claridade = { media: 0.5, canto: 0.5 }): Layout {
  return modeloStories(w, h) === "papel-branco" ? papelBranco(w, h, cor, ev, medir, clar) : telaCheia(w, h, cor, ev, medir, clar);
}

/** Caixa ocupada por um texto (aproximada pela altura da fonte). */
export function caixaTexto(e: Extract<Elemento, { tipo: "texto" }>, medir: Medir): Retangulo {
  const lw = medir(e.texto, e.fonte);
  return { x: e.alinhar === "right" ? e.x - lw : e.x, y: e.y - e.fonte.tamanho * 0.8, w: lw, h: e.fonte.tamanho };
}

/** P&B por manipulação de pixels (luminância Rec. 601), no lugar. */
export function pretoEBranco(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const l = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
    px[i] = px[i + 1] = px[i + 2] = l;
  }
}

/** Claridade média (0–1) de um trecho RGBA. */
export function claridade(px: Uint8ClampedArray): number {
  let s = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) { s += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114; n++; }
  return n ? s / n / 255 : 0;
}

/** Limita a área da tela para caber no limite de canvas do iPhone (~16,7 MP). */
export function escalaSegura(w: number, h: number, limite = 16_000_000): number {
  return w * h > limite ? Math.sqrt(limite / (w * h)) : 1;
}

export const nomeArquivo = (n: number, formato: Formato, cor: Cor) =>
  `fortem-10anos-${String(n).padStart(2, "0")}-${formato}-${cor === "pb" ? "pb" : "colorida"}.jpg`;
