/**
 * Helpers do módulo Ponto: formatação de duração, mapeamento de estado → label/cor.
 */

export type PontoEstado =
  | "nao_iniciado"
  | "em_jornada"
  | "em_intervalo"
  | "encerrada"
  | "nao_iniciou";

export type ProximaAcao = "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida" | null;

export const ACAO_LABEL: Record<NonNullable<ProximaAcao>, string> = {
  entrada: "Iniciar jornada",
  intervalo_inicio: "Iniciar intervalo",
  intervalo_fim: "Finalizar intervalo",
  saida: "Encerrar jornada",
};

export const STATUS_LABEL: Record<PontoEstado, string> = {
  nao_iniciado: "Não iniciado",
  nao_iniciou: "Não iniciou",
  em_jornada: "Em jornada",
  em_intervalo: "Em intervalo",
  encerrada: "Encerrada",
};

export const STATUS_DOT: Record<PontoEstado, string> = {
  nao_iniciado: "bg-muted-foreground",
  nao_iniciou: "bg-destructive",
  em_jornada: "bg-success",
  em_intervalo: "bg-warning",
  encerrada: "bg-muted-foreground",
};

/** Formata minutos como "Xh YYm" (ex: 192 → "3h 12m"). */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null || isNaN(min)) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Diferença em minutos entre agora e um timestamp ISO. */
export function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Formata um timestamptz ISO como "HH:mm". */
export function formatHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Resumo curto do user-agent (até 200 chars). */
export function shortDevice(): string {
  if (typeof navigator === "undefined") return "server";
  return navigator.userAgent.slice(0, 200);
}

/** Tenta capturar geolocalização com timeout curto. Falha silenciosamente. */
export function tryGeo(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    const timer = setTimeout(() => resolve({ lat: null, lng: null }), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve({ lat: null, lng: null });
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 },
    );
  });
}

export function mesLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
