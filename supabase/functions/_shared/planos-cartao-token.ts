// Tokens de cartão do checkout /planos (ligados à proposta, sem aluno).
// Usado pelo rede-tokenizacao-webhook (desvio) e pelo planos-checkout (consulta reserva).
// Nunca grava a consulta completa: só status, bandeira, last4, código do token e validade.

export type EstadoToken = "pendente" | "ativo" | "recusado";

/** Mesma leitura do webhook atual: Active+token = ativo; Active sem token = processando; Failed/outros terminais = recusado. */
export function estadoToken(consulta: any): EstadoToken {
  const status = String(consulta?.tokenizationStatus ?? "").trim();
  const brand = String(consulta?.brand?.tokenStatus ?? "").trim();
  const code = String(consulta?.token?.code ?? "").trim();
  if (status === "Active" && brand === "Failed") return "recusado";
  if (status === "Active" && code) return "ativo";
  if (status === "Active" || status === "" || status.toLowerCase() === "pending") return "pendente";
  return "recusado";
}

/** Apenas o que pode ficar gravado. */
export function consultaSegura(consulta: any) {
  return {
    tokenizationStatus: consulta?.tokenizationStatus ?? null,
    brandTokenStatus: consulta?.brand?.tokenStatus ?? null,
    bandeira: consulta?.brand?.name ?? null,
    last4: consulta?.last4 ?? null,
    returnCode: consulta?.returnCode ?? null,
  };
}

/** Atualiza o registro da proposta a partir da consulta da Rede. */
export async function aplicarConsultaToken(supabase: any, tokenizationId: string, consulta: any): Promise<EstadoToken> {
  const estado = estadoToken(consulta);
  const code = String(consulta?.token?.code ?? "").trim();
  await supabase.from("rede_tokenizacoes").update({
    status: estado === "ativo" ? "active" : estado === "recusado" ? "failed" : "pending",
    brand_name: consulta?.brand?.name ?? null,
    last4: consulta?.last4 ?? null,
    token_code: estado === "ativo" ? code : null,
    token_expiration: consulta?.token?.expirationDate ?? null,
    raw_response: consultaSegura(consulta),
    updated_at: new Date().toISOString(),
  }).eq("tokenization_id", tokenizationId).not("proposta_id", "is", null).is("aluno_id", null);
  return estado;
}
