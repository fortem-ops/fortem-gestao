// Regras puras do Pix imediato da 1ª mensalidade de um grupo de Pix Automático. Sem banco nem Inter.

/** Validade do QR (segundos): 48 h, tempo para o aluno receber pelo WhatsApp e pagar. */
export const EXPIRACAO_PRIMEIRA_S = 172800;

export interface ItemComposicao { descricao?: string | null; valor: number | string }

/** solicitacaoPagador (máx. 140): "FORTEM 1ª mensalidade: Start R$ 150,00 + Corrida - Start R$ 170,00". */
export function descricaoPagador(itens: ItemComposicao[]): string {
  const partes = itens.map((i) => `${i.descricao ?? "Item"} R$ ${Number(i.valor).toFixed(2).replace(".", ",")}`);
  return `FORTEM 1ª mensalidade: ${partes.join(" + ")}`.slice(0, 140);
}

export function payloadCobPrimeira(p: { valor: number; chave: string; cpf: string; nome: string; itens: ItemComposicao[] }) {
  if (!(p.valor > 0)) throw new Error("valor_invalido");
  const soma = p.itens.reduce((s, i) => s + Math.round(Number(i.valor) * 100), 0);
  if (soma !== Math.round(p.valor * 100)) throw new Error("composicao_diferente_do_total");
  return {
    calendario: { expiracao: EXPIRACAO_PRIMEIRA_S },
    ...(p.cpf.length === 11 ? { devedor: { cpf: p.cpf, nome: p.nome.slice(0, 200) } } : {}),
    valor: { original: p.valor.toFixed(2) },
    chave: p.chave,
    solicitacaoPagador: descricaoPagador(p.itens),
  };
}

/** Fim da validade a partir de calendario.criacao do Inter (ou agora). */
export function expiraEm(criacao: unknown, expiracao: unknown, agora = Date.now()): string {
  const base = typeof criacao === "string" && !Number.isNaN(Date.parse(criacao)) ? Date.parse(criacao) : agora;
  const s = typeof expiracao === "number" && expiracao > 0 ? expiracao : EXPIRACAO_PRIMEIRA_S;
  return new Date(base + s * 1000).toISOString();
}

/** Valor do aviso "pix" do Inter ("320.00") em número; inválido = null (vai para conferência). */
export function valorPix(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
