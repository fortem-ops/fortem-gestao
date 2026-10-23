/**
 * E4f — Rescisão da Consultoria Online.
 * Decisão do dono: para contratos consultoria_2027 a rescisão NÃO é calculada
 * nem executada pelo sistema; o pedido é comunicado ao administrador, que
 * trata manualmente. Usa APENAS o mecanismo de notificações já existente
 * (createNotificacao → fn_notificar_criar_notificacao, usado pela tela
 * Notificar), destinado a admin/coordenador. Nenhuma mudança de banco.
 */
import { supabase } from "@/integrations/supabase/client";
import { createNotificacao } from "@/lib/notificar";
import { ehConsultoria } from "@/lib/vigenciaLabels";

export { ehConsultoria };

export const TEXTO_RESCISAO_CONSULTORIA =
  "Rescisão da Consultoria Online é tratada pelo administrador";

export interface AvisoRescisaoConsultoriaInput {
  alunoId: string;
  alunoNome: string;
  vigenciaLabel: string;
  valorLabel: string;
  formaPagamentoLabel: string;
  motivo?: string;
  quemPediu: string;
}

export function textoAvisoRescisaoConsultoria(i: AvisoRescisaoConsultoriaInput) {
  return {
    titulo: `Rescisão de Consultoria Online — ${i.alunoNome}`,
    descricao: [
      "Pedido de rescisão da Consultoria Online. O sistema não calcula nem executa a rescisão: o administrador trata manualmente.",
      "",
      `Aluno: ${i.alunoNome}`,
      "Plano: Consultoria Online",
      `Vigência: ${i.vigenciaLabel}`,
      `Valor: ${i.valorLabel}`,
      `Forma de pagamento: ${i.formaPagamentoLabel}`,
      `Motivo: ${i.motivo?.trim() || "Não informado"}`,
      `Quem pediu: ${i.quemPediu}`,
    ].join("\n"),
  };
}

/** Registra o aviso para admin/coordenador pelo fluxo de Notificar existente. */
export async function avisarAdminRescisaoConsultoria(
  input: AvisoRescisaoConsultoriaInput,
): Promise<string> {
  const { titulo, descricao } = textoAvisoRescisaoConsultoria(input);
  return createNotificacao({
    titulo,
    descricao,
    categoria: "aluno",
    prioridade: "alta",
    tipo: "solicitacao",
    aluno_id: input.alunoId,
    destinatarios: [{ type: "all_admins" }, { type: "all_coordenadores" }],
  });
}

/** Identifica quem está registrando o pedido (equipe ou o próprio aluno). */
export async function quemEstaLogado(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? data.user?.id ?? "Usuário logado";
}
