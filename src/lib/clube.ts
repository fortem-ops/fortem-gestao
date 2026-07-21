// Helpers do módulo Clube FORTEM: tema por nível, formatação, hash CPF client-side.
import type { Database } from "@/integrations/supabase/types";

export type NivelMembro = Database["public"]["Enums"]["clube_nivel_membro"];
export type StatusMembro = Database["public"]["Enums"]["clube_status_membro"];

export const NIVEL_LABEL: Record<NivelMembro, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
  platina: "Platina",
};

export const NIVEL_BADGE: Record<NivelMembro, string> = {
  bronze: "BRONZE MEMBER",
  prata: "PRATA MEMBER",
  ouro: "OURO MEMBER",
  diamante: "DIAMANTE MEMBER",
  platina: "PLATINA MEMBER",
};

// Paleta por nível — fiel à identidade visual das carteirinhas.
export const NIVEL_THEME: Record<
  NivelMembro,
  { bg: string; text: string; accent: string; muted: string; metallic?: string }
> = {
  bronze:   { bg: "#3B2A18", text: "#FFFFFF", accent: "#CD7F32", muted: "#8A5A2B" },
  prata:    { bg: "#F2F2F2", text: "#111111", accent: "#E10600", muted: "#BFBFBF" },
  ouro:     { bg: "#1A1408", text: "#FFFFFF", accent: "#F5C518", muted: "#8A7326", metallic: "#F5C518" },
  diamante: { bg: "#0A1A26", text: "#FFFFFF", accent: "#22D3EE", muted: "#0E7490", metallic: "#67E8F9" },
  platina:  { bg: "#050505", text: "#FFFFFF", accent: "#C084FC", muted: "#A6A6A6", metallic: "#E5E4E2" },
};

export const STATUS_LABEL: Record<StatusMembro, string> = {
  ativo: "ATIVO",
  bloqueado: "BLOQUEADO",
  inadimplente: "INADIMPLENTE",
  cancelado: "CANCELADO",
};

export const STATUS_DOT: Record<StatusMembro, string> = {
  ativo: "#22C55E",
  bloqueado: "#EF4444",
  inadimplente: "#F59E0B",
  cancelado: "#6B7280",
};

/**
 * Calcula SHA-256 do CPF (apenas dígitos) usando WebCrypto.
 */
export async function hashCpfClient(cpf: string): Promise<string> {
  const digits = cpf.replace(/\D/g, "");
  const bytes = new TextEncoder().encode(digits);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += parseInt(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

export function formatCpfMask(cpf: string): string {
  const d = cpf.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Distância em km entre dois pontos (Haversine). */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const NIVEL_RANK: Record<NivelMembro, number> = {
  bronze: -1,
  prata: 0,
  ouro: 1,
  diamante: 2,
  platina: 3,
};

export function nivelAtende(membro: NivelMembro, minimo: NivelMembro): boolean {
  return NIVEL_RANK[membro] >= NIVEL_RANK[minimo];
}
