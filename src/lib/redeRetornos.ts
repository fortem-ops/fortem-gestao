// Tradução dos códigos de retorno da Rede (e.Rede) para exibição. Só exibição.
const MAPA: Record<string, string> = {
  "00": "Aprovada.",
  "101": "Recusada pelo banco: cartão vencido. Peça outro cartão.",
  "102": "Recusada pelo banco: suspeita de fraude ou cartão bloqueado. A aluna deve falar com o banco.",
  "103": "Recusada pelo banco: transação não permitida para este cartão.",
  "104": "Recusada pelo banco: cartão com restrição. A aluna deve falar com o banco.",
  "105": "Recusada pelo banco: cartão bloqueado ou cancelado. Peça outro cartão.",
  "106": "Recusada pelo banco: tentativas de senha excedidas.",
  "107": "Recusada pelo banco: transação não autorizada. A aluna deve falar com o banco.",
  "108": "Recusada pelo banco: valor não permitido para este cartão.",
  "109": "Recusada pelo banco: cartão inexistente ou dados incorretos.",
  "110": "Recusada pelo banco: transação não permitida.",
  "111": "Recusada pelo banco: saldo ou limite insuficiente. Peça à aluna para liberar limite ou usar outro cartão.",
  "112": "Recusada pelo banco: cartão vencido. Peça outro cartão.",
  "113": "Recusada: banco emissor indisponível. Tente novamente mais tarde.",
  "114": "Recusada: dados do cartão inválidos.",
  "115": "Recusada pelo banco: limite de transações excedido.",
  "116": "Recusada pelo banco: cartão não aceita esta modalidade.",
  "117": "Recusada pelo banco: transação não autorizada. A aluna deve falar com o banco.",
  "118": "Recusada pelo banco: cartão bloqueado.",
  "119": "Recusada: código de segurança inválido.",
  "121": "Recusada: erro no processamento. Tente novamente.",
  "122": "Recusada: transação duplicada ou já processada.",
  "123": "Recusada: a aluna cancelou o pagamento recorrente com o banco.",
  "124": "Recusada pelo banco: não autorizada.",
  "51": "Recusada pelo banco: saldo ou limite insuficiente.",
  "57": "Recusada pelo banco: transação não permitida para este cartão.",
};

export function motivoRede(code?: string | null, message?: string | null): string {
  const c = (code ?? "").trim();
  const txt = MAPA[c];
  if (txt) return `${txt} (código ${c})`;
  const orig = message?.trim() || "Recusada";
  return c ? `${orig} (código ${c})` : orig;
}
