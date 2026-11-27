import { horarioFuturoPortal } from "@/components/portal/portalPresentation";

export interface FilaEsperaItem {
  id: string;
  aluno_id: string;
  tipo: "treino" | "servico";
  slot_id: string | null;
  agenda_servico_id: string | null;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  atividade: string;
  profissional_id: string | null;
  status: "ativo" | "saiu" | "agendou" | "encerrado";
}

export const LIMITE_FILAS_ATIVAS = 5;

export function filtrarFilasAtivasFuturas<T extends Pick<FilaEsperaItem, "status" | "data" | "horario_inicio">>(
  itens: T[],
  agora = new Date(),
): T[] {
  return itens.filter(
    (item) => item.status === "ativo" && horarioFuturoPortal(item.data, item.horario_inicio, agora),
  );
}

export function mensagemErroFilaEspera(erro: string | undefined): string {
  switch (erro) {
    case "limite_filas":
      return `Você já está em ${LIMITE_FILAS_ATIVAS} filas de espera ativas. Saia de uma para entrar em outra.`;
    case "sem_plano_corrida":
      return "Este horário é exclusivo para alunos com plano de Corrida ativo.";
    case "ja_agendado":
      return "Você já está agendado neste horário.";
    case "horario_com_vaga":
      return "Este horário já tem vaga disponível. Você pode agendar direto.";
    case "horario_passado":
      return "Este horário já começou.";
    case "somente_online":
      return "Seu plano atual não inclui agendamentos presenciais pelo app.";
    case "aluno_inativo":
      return "Seu cadastro não está ativo para entrar na fila de espera.";
    default:
      return "Não foi possível entrar na fila de espera.";
  }
}

export function contarFilaPorChave(
  itens: Pick<FilaEsperaItem, "tipo" | "slot_id" | "profissional_id" | "data" | "horario_inicio" | "status">[],
  agora = new Date(),
): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const item of filtrarFilasAtivasFuturas(itens, agora)) {
    const chave =
      item.tipo === "treino"
        ? `treino:${item.slot_id ?? ""}:${item.data}`
        : `servico:${item.profissional_id ?? ""}:${item.data}:${item.horario_inicio.slice(0, 5)}`;
    contagem[chave] = (contagem[chave] ?? 0) + 1;
  }
  return contagem;
}