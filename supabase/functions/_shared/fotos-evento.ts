// Regras puras das fotos de eventos (reconhecimento facial). Sem rede, sem Deno: testável no vitest.
export const LIMIAR_BUSCA = 90;
export const MAX_ROSTOS_BUSCA = 100;
export const MIN_CONFIANCA_MODERACAO = 70;
export const MAX_FOTOS_ENVIO = 30;
export const MAX_BYTES_ARQUIVO = 15 * 1024 * 1024;
export const MAX_BYTES_REKOGNITION = 5 * 1024 * 1024;
export const LIMITE_BUSCAS_HORA = 10;
export const LIMITE_ENVIOS_HORA = 3;
export const LOTE_INDEXACAO = 5;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/heic", "image/heif"] as const;

/** Toda coleção da AWS precisa começar com "fortem-" (a chave só tem permissão para esse prefixo). */
export function colecaoValida(id: unknown): id is string {
  return typeof id === "string" && /^fortem-[a-zA-Z0-9_.-]{1,240}$/.test(id);
}
export function colecaoDoSlug(slug: string): string {
  return `fortem-evento-${slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

/** WhatsApp só dígitos com DDI 55; número brasileiro sem DDI recebe 55. */
export function normalizarWhatsapp(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let d = v.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^[0-9]{12,15}$/.test(d) ? d : null;
}

export function orientacao(largura: number, altura: number): "horizontal" | "vertical" {
  return largura >= altura ? "horizontal" : "vertical";
}

export type ArquivoInfo = { tipo: unknown; tamanho: unknown };
export function arquivoValido(a: ArquivoInfo): boolean {
  return typeof a.tipo === "string" && (TIPOS_ACEITOS as readonly string[]).includes(a.tipo.toLowerCase())
    && typeof a.tamanho === "number" && a.tamanho > 0 && a.tamanho <= MAX_BYTES_ARQUIVO;
}

export type FaceMatch = { Similarity?: number; Face?: { ExternalImageId?: string; FaceId?: string } };
/** IDs das fotos encontradas, sem repetir, da maior semelhança para a menor, só acima do limiar. */
export function fotosDosMatches(matches: FaceMatch[] | undefined, limiar = LIMIAR_BUSCA): string[] {
  const melhor = new Map<string, number>();
  for (const m of matches ?? []) {
    const id = m.Face?.ExternalImageId; const s = m.Similarity ?? 0;
    if (!id || s < limiar) continue;
    if ((melhor.get(id) ?? -1) < s) melhor.set(id, s);
  }
  return [...melhor.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export type FaceRecord = { Face?: { FaceId?: string } };
/** Resultado da indexação: sem rosto vira "sem_rosto" (fica na galeria, nunca na busca). */
export function resultadoIndexacao(records: FaceRecord[] | undefined): { status: "indexada" | "sem_rosto"; faceIds: string[] } {
  const faceIds = (records ?? []).map((r) => r.Face?.FaceId).filter((x): x is string => !!x);
  return { status: faceIds.length ? "indexada" : "sem_rosto", faceIds };
}

export type RotuloModeracao = { Name?: string; ParentName?: string; Confidence?: number };
/** Moderação assistida: só sinaliza; nunca aprova nem rejeita. */
export function alertaModeracao(labels: RotuloModeracao[] | undefined, min = MIN_CONFIANCA_MODERACAO) {
  const rotulos = (labels ?? []).filter((l) => (l.Confidence ?? 0) >= min && l.Name)
    .map((l) => ({ nome: l.Name as string, pai: l.ParentName ?? "", confianca: Math.round((l.Confidence ?? 0) * 10) / 10 }));
  return { alerta: rotulos.length > 0, rotulos };
}

/** Só fotos aprovadas e já processadas aparecem ao público (busca e galeria). */
export function fotoPublica(f: { status_moderacao: string; status_indexacao: string; upload_concluido: boolean }): boolean {
  return f.upload_concluido && f.status_moderacao === "aprovada" && (f.status_indexacao === "indexada" || f.status_indexacao === "sem_rosto");
}

/** Prazo de retenção vencido (data do evento + dias). */
export function retencaoVencida(dataEvento: string, dias: number, agora = new Date()): boolean {
  const fim = new Date(`${dataEvento}T00:00:00-03:00`).getTime() + dias * 86400000;
  return agora.getTime() >= fim;
}

/** Selfie em base64 (com ou sem prefixo data:), só JPEG/PNG, até 5 MB. */
export function decodificarSelfie(v: unknown): Uint8Array | null {
  if (typeof v !== "string" || v.length > 7_200_000) return null;
  const b64 = v.replace(/^data:image\/(jpeg|jpg|png);base64,/, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  let bin: string;
  try { bin = atob(b64); } catch { return null; }
  if (!bin.length || bin.length > MAX_BYTES_REKOGNITION) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return jpeg || png ? bytes : null;
}
