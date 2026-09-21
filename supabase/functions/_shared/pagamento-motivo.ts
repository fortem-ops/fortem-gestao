// ─────────────────────────────────────────────────────────────
// Tradução do motivo de recusa de pagamento para linguagem simples.
// Espelha o mapeamento usado nas telas (friendlyMessage / MENSAGENS_ERRO),
// para que o aviso interno à equipe fale a mesma língua do aluno.
// ─────────────────────────────────────────────────────────────

/** Códigos de retorno da Rede mais comuns em recusa. */
const RETURN_CODES: Record<string, string> = {
  "51": "Cartão sem limite disponível.",
  "54": "Cartão vencido.",
  "57": "Transação não permitida para este cartão.",
  "62": "Cartão restrito pelo emissor.",
  "78": "Cartão bloqueado / ainda não desbloqueado pelo titular.",
  "82": "Código de segurança (CVV) inválido.",
  "05": "Pagamento não autorizado pelo banco emissor.",
  "41": "Cartão informado como perdido.",
  "43": "Cartão informado como roubado.",
  "14": "Número do cartão inválido.",
  "91": "Banco emissor indisponível no momento.",
  "96": "Falha temporária no processamento da operadora.",
};

/** Chaves de erro internas usadas pelas edge functions. */
const ERROS_INTERNOS: Record<string, string> = {
  recusado_bandeira: "A bandeira do cartão recusou gerar o token (cartão não pôde ser processado).",
  tokenizacao_falhou: "A bandeira do cartão recusou gerar o token (cartão não pôde ser processado).",
  falha_criptograma: "A operadora não autorizou o uso deste cartão.",
  cartao_inativo_ou_invalido: "Cartão inválido ou inativo.",
  cartao_ainda_nao_confirmado: "O cartão ainda não havia sido confirmado pela operadora.",
  token_expirado: "A sessão de pagamento expirou.",
};

export function motivoAmigavel(input: {
  returnCode?: string | null;
  returnMessage?: string | null;
  erro?: string | null;
}): string {
  const code = String(input.returnCode ?? "").trim();
  const erro = String(input.erro ?? "").trim();

  if (erro && ERROS_INTERNOS[erro]) return ERROS_INTERNOS[erro];
  if (code && RETURN_CODES[code]) return RETURN_CODES[code];

  const msg = String(input.returnMessage ?? "").toLowerCase();
  if (msg.includes("insufficient") || msg.includes("saldo") || msg.includes("limite"))
    return "Cartão sem limite disponível.";
  if (msg.includes("expired") || msg.includes("vencid") || msg.includes("validade"))
    return "Cartão vencido.";
  if (msg.includes("security") || msg.includes("cvv"))
    return "Código de segurança (CVV) inválido.";
  if (msg.includes("invalid") || msg.includes("inválid"))
    return "Dados do cartão inválidos.";
  if (msg.includes("denied") || msg.includes("negad") || msg.includes("recus"))
    return "Pagamento não autorizado pelo banco emissor.";
  if (msg.includes("timeout") || msg.includes("tempo"))
    return "O banco emissor demorou para responder.";

  return "O pagamento não foi autorizado.";
}

/** Motivo + código técnico entre parênteses, para o e-mail da equipe. */
export function motivoComCodigo(input: {
  returnCode?: string | null;
  returnMessage?: string | null;
  erro?: string | null;
}): string {
  const base = motivoAmigavel(input);
  const tecnico = [
    input.erro ? `erro: ${input.erro}` : null,
    input.returnCode ? `returnCode: ${input.returnCode}` : null,
    input.returnMessage ? `retorno: ${input.returnMessage}` : null,
  ].filter(Boolean).join(" · ");
  return tecnico ? `${base} (${tecnico})` : base;
}
