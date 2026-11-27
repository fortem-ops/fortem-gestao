export type TipoEventoHorario =
  | "agendou"
  | "cancelou"
  | "checkin"
  | "presenca"
  | "falta"
  | "fila_entrou"
  | "fila_saiu"
  | "fila_avisado";

export type TipoAutorHorario = "aluno" | "equipe" | "sistema" | null;

export interface FilaAtivaHorario {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  created_at: string;
}

export interface EventoHorarioTreino {
  id: string;
  ocorrido_em: string;
  tipo: TipoEventoHorario;
  aluno_id: string;
  aluno_nome: string;
  autor_nome: string | null;
  autor_tipo: TipoAutorHorario;
  detalhe: string | null;
}

export interface HistoricoHorarioPayload {
  fila_ativa: FilaAtivaHorario[];
  eventos: EventoHorarioTreino[];
}

const ROTULOS_TIPO: Record<TipoEventoHorario, string> = {
  agendou: "Agendou",
  cancelou: "Cancelou",
  checkin: "Check-in",
  presenca: "Presença marcada",
  falta: "Falta marcada",
  fila_entrou: "Entrou na fila",
  fila_saiu: "Saiu da fila",
  fila_avisado: "Avisado de vaga",
};

export function rotuloEventoHorario(tipo: TipoEventoHorario, autorTipo: TipoAutorHorario): string {
  if (tipo === "cancelou" && autorTipo === "equipe") {
    return "Removido pela equipe";
  }
  return ROTULOS_TIPO[tipo];
}

export function rotuloAutorHorario(autorNome: string | null, autorTipo: TipoAutorHorario): string {
  if (autorTipo === "sistema") return "Sistema";
  if (autorTipo === "aluno") {
    return autorNome ? `${autorNome} (portal)` : "Aluno (portal)";
  }
  if (autorTipo === "equipe") {
    return autorNome ? `${autorNome} (equipe)` : "Equipe";
  }
  if (autorNome) return autorNome;
  return "Autor não registrado";
}

export function ordenarEventosHorario(eventos: EventoHorarioTreino[]): EventoHorarioTreino[] {
  return [...eventos].sort(
    (a, b) => new Date(b.ocorrido_em).getTime() - new Date(a.ocorrido_em).getTime(),
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseHistoricoHorarioPayload(raw: unknown): HistoricoHorarioPayload {
  if (!isRecord(raw)) {
    return { fila_ativa: [], eventos: [] };
  }
  const filaRaw = Array.isArray(raw.fila_ativa) ? raw.fila_ativa : [];
  const eventosRaw = Array.isArray(raw.eventos) ? raw.eventos : [];

  const fila_ativa: FilaAtivaHorario[] = filaRaw
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id ?? ""),
      aluno_id: String(item.aluno_id ?? ""),
      aluno_nome: String(item.aluno_nome ?? "Aluno"),
      created_at: String(item.created_at ?? ""),
    }));

  const eventos: EventoHorarioTreino[] = eventosRaw
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id ?? ""),
      ocorrido_em: String(item.ocorrido_em ?? ""),
      tipo: (String(item.tipo ?? "agendou") as TipoEventoHorario),
      aluno_id: String(item.aluno_id ?? ""),
      aluno_nome: String(item.aluno_nome ?? "Aluno"),
      autor_nome: typeof item.autor_nome === "string" ? item.autor_nome : null,
      autor_tipo:
        item.autor_tipo === "aluno" || item.autor_tipo === "equipe" || item.autor_tipo === "sistema"
          ? item.autor_tipo
          : null,
      detalhe: typeof item.detalhe === "string" ? item.detalhe : null,
    }));

  return { fila_ativa, eventos: ordenarEventosHorario(eventos) };
}