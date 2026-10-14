/** Estado da ativação de uma proposta do site (venda/plano/contrato/créditos no perfil do aluno). */
export type EstadoAtivacao = "nao_paga" | "ativada" | "pendente";

export function estadoAtivacao(p: { pago_em?: string | null; ativada_em?: string | null }): EstadoAtivacao {
  if (!p.pago_em) return "nao_paga";
  return p.ativada_em ? "ativada" : "pendente";
}

/** Botão "Ativar agora": só admin e só proposta paga ainda não ativada. O servidor confere de novo. */
export function podeAtivarAgora(p: { isAdmin: boolean; pago_em?: string | null; ativada_em?: string | null }): boolean {
  return p.isAdmin && estadoAtivacao(p) === "pendente";
}
