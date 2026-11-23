// Regras puras do push da equipe (sem dependência de Deno/Supabase; testadas no vitest).

export const PAPEIS_EQUIPE = ["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"] as const;
export type PapelEquipe = (typeof PAPEIS_EQUIPE)[number];

/**
 * Lista fechada de gatilhos com push. Gatilho fora daqui NÃO gera push.
 * `urgente` = pode sair a qualquer hora (cobrança e falha de rotina);
 * os demais fora do expediente ficam pendentes até a próxima abertura.
 * Fases 2–4 acrescentam os gatilhos aprovados aqui.
 */
export const GATILHOS_EQUIPE: Readonly<Record<string, { urgente: boolean }>> = {
  teste: { urgente: true },
};

export function gatilhoPermitido(gatilho: string): boolean {
  return Object.prototype.hasOwnProperty.call(GATILHOS_EQUIPE, gatilho);
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Devolve o motivo da recusa ou null se o texto pode ser enviado. */
export function validarMensagem(gatilho: string, titulo: string, corpo: string): string | null {
  if (!gatilhoPermitido(gatilho)) return "gatilho_sem_push";
  if (!titulo.trim()) return "titulo_vazio";
  const texto = `${titulo} ${corpo}`;
  if (texto.includes("!")) return "exclamacao";
  if (semAcento(texto).includes("comissionamento")) return "termo_proibido";
  return null;
}

// Brasília: UTC-3 fixo (sem horário de verão desde 2019).
const OFFSET_MS = 3 * 60 * 60 * 1000;
const ABERTURA_MIN = 6 * 60 + 10;

function fechamentoMin(diaSemana: number): number | null {
  if (diaSemana >= 1 && diaSemana <= 4) return 20 * 60 + 40;
  if (diaSemana === 5) return 19 * 60 + 40;
  return null; // sábado e domingo
}

export function dentroDoExpediente(agora: Date): boolean {
  const local = new Date(agora.getTime() - OFFSET_MS);
  const fecha = fechamentoMin(local.getUTCDay());
  if (fecha === null) return false;
  const min = local.getUTCHours() * 60 + local.getUTCMinutes();
  return min >= ABERTURA_MIN && min <= fecha;
}

/** Quando o push deve sair: agora (urgente ou no expediente) ou na próxima abertura (06:10 do próximo dia útil). */
export function momentoDeEnvio(agora: Date, urgente: boolean): Date {
  if (urgente || dentroDoExpediente(agora)) return agora;
  const local = new Date(agora.getTime() - OFFSET_MS);
  const min = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dia = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const hojeUtil = fechamentoMin(dia.getUTCDay()) !== null;
  if (!(hojeUtil && min < ABERTURA_MIN)) dia.setUTCDate(dia.getUTCDate() + 1);
  while (fechamentoMin(dia.getUTCDay()) === null) dia.setUTCDate(dia.getUTCDate() + 1);
  return new Date(dia.getTime() + ABERTURA_MIN * 60000 + OFFSET_MS);
}

export interface Candidato {
  user_id: string;
  papeis: string[];
  ativo: boolean;
}

/** Só funcionários ativos com papel de equipe; se `papel` vier, só quem tem esse papel. */
export function filtrarDestinatarios(candidatos: Candidato[], papel?: PapelEquipe): string[] {
  const ok = new Set<string>();
  for (const c of candidatos) {
    if (!c.ativo) continue;
    const equipe = c.papeis.filter((p) => (PAPEIS_EQUIPE as readonly string[]).includes(p));
    if (equipe.length === 0) continue;
    if (papel && !equipe.includes(papel)) continue;
    ok.add(c.user_id);
  }
  return [...ok];
}

export function inscricaoInvalida(status: number | undefined): boolean {
  return status === 404 || status === 410;
}
