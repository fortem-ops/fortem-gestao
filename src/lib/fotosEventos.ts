// Regras puras da área da equipe de Fotos de Eventos (testáveis sem navegador).
export const TIPOS_UPLOAD = ["image/jpeg", "image/png", "image/heic", "image/heif"];
export const MAX_BYTES_UPLOAD = 15 * 1024 * 1024;
export const LADO_PREVIA = 1200;

export function ehHeic(f: { type: string; name: string }): boolean {
  return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}
/** Aceita JPEG/PNG/HEIC até 15 MB (HEIC sem tipo no navegador é reconhecido pela extensão). */
export function arquivoAceito(f: { type: string; name: string; size: number }): boolean {
  const tipoOk = TIPOS_UPLOAD.includes(f.type.toLowerCase()) || ehHeic(f);
  return tipoOk && f.size > 0 && f.size <= MAX_BYTES_UPLOAD;
}

/** Tamanho da prévia: maior lado até 1200px, sem ampliar. */
export function dimensoesPrevia(w: number, h: number, lado = LADO_PREVIA): { w: number; h: number } {
  const m = Math.max(w, h);
  if (m <= lado) return { w, h };
  const k = lado / m;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export function slugValido(s: string): boolean { return /^[a-z0-9-]{2,60}$/.test(s); }
export function slugDe(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
export function colecaoDe(slug: string): string { return `fortem-evento-${slug}`; }

/** dHash 64 bits a partir de tons de cinza 9x8 (linha a linha). */
export function dHash(cinza: ArrayLike<number>): string {
  if (cinza.length !== 72) throw new Error("dhash_precisa_9x8");
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += cinza[y * 9 + x] > cinza[y * 9 + x + 1] ? "1" : "0";
  return bits;
}
export function hamming(a: string, b: string): number {
  let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d + Math.abs(a.length - b.length);
}

export type FotoModeracao = { id: string; enviado_por: string | null; alerta_moderacao: boolean; criado_em: string; hash?: string | null };
/** Fila: fotos com alerta primeiro, depois as mais antigas. */
export function ordenarFila<T extends FotoModeracao>(fotos: T[]): T[] {
  return [...fotos].sort((a, b) => Number(b.alerta_moderacao) - Number(a.alerta_moderacao) || a.criado_em.localeCompare(b.criado_em));
}
/** Agrupa fotos quase idênticas (dHash com distância ≤ limite) do MESMO remetente, mantendo a ordem da fila. */
export function agruparQuaseIdenticas<T extends FotoModeracao>(fotos: T[], limite = 6): T[][] {
  const grupos: T[][] = [];
  for (const f of fotos) {
    const g = f.hash ? grupos.find((gr) => gr[0].enviado_por === f.enviado_por && gr[0].hash && hamming(gr[0].hash, f.hash!) <= limite) : undefined;
    if (g) g.push(f); else grupos.push([f]);
  }
  return grupos;
}

/** Atalhos da tela cheia: A aprova, R rejeita, setas navegam. */
export type AcaoTecla = "aprovar" | "rejeitar" | "anterior" | "proxima" | null;
export function acaoDaTecla(key: string): AcaoTecla {
  const k = key.toLowerCase();
  if (k === "a") return "aprovar";
  if (k === "r") return "rejeitar";
  if (key === "ArrowLeft") return "anterior";
  if (key === "ArrowRight") return "proxima";
  return null;
}

export type FotoTotais = { origem: string; status_moderacao: string; status_indexacao: string; upload_concluido: boolean };
export function totais(fotos: FotoTotais[]) {
  const t = {
    total: 0, fotografo: 0, convidado: 0, pendentes: 0, aprovadas: 0, rejeitadas: 0,
    indexadas: 0, sem_rosto: 0, erro: 0, a_indexar: 0, incompletas: 0,
  };
  for (const f of fotos) {
    if (!f.upload_concluido) { t.incompletas++; continue; }
    t.total++;
    if (f.origem === "fotografo") t.fotografo++; else t.convidado++;
    if (f.status_moderacao === "pendente") t.pendentes++;
    else if (f.status_moderacao === "aprovada") t.aprovadas++;
    else t.rejeitadas++;
    if (f.status_moderacao !== "aprovada") continue;
    if (f.status_indexacao === "indexada") t.indexadas++;
    else if (f.status_indexacao === "sem_rosto") t.sem_rosto++;
    else if (f.status_indexacao === "erro") t.erro++;
    else t.a_indexar++;
  }
  return t;
}
