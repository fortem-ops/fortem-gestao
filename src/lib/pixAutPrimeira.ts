// Pix imediato da 1ª mensalidade de um grupo de Pix Automático: leitura da prévia e mensagem para WhatsApp.

export interface ItemPrimeira { descricao: string; valor: number; vencimento: string | null; cobranca_id: string | null; venda_id: string | null }
export interface PixPrimeiraAtual {
  status: "reservado" | "ativa" | "liquidada" | "divergente" | "conferencia";
  valor: number; txid: string; pix_copia_cola: string | null; expira_em: string; data_pagamento: string | null; ultimo_erro: string | null;
}
export interface PreviaPrimeira {
  disponivel: boolean; itens: ItemPrimeira[]; bloqueios: { descricao: string; motivo: string }[];
  valor: number; completo: boolean; atual: PixPrimeiraAtual | null;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function itens(v: unknown): ItemPrimeira[] {
  return arr(v).map((x) => {
    const o = obj(x);
    return { descricao: str(o.descricao) ?? "Item", valor: Number(o.valor ?? 0), vencimento: str(o.vencimento),
      cobranca_id: str(o.cobranca_id), venda_id: str(o.venda_id) };
  });
}

export function lerPrevia(raw: unknown): PreviaPrimeira {
  const r = obj(raw); const c = obj(r.composicao); const a = r.atual ? obj(r.atual) : null;
  return {
    disponivel: r.disponivel === true,
    itens: itens(c.itens),
    bloqueios: arr(c.bloqueios).map((x) => ({ descricao: str(obj(x).descricao) ?? "Item", motivo: str(obj(x).motivo) ?? "" })),
    valor: Number(c.valor ?? 0),
    completo: c.completo === true,
    atual: a ? {
      status: (str(a.status) ?? "ativa") as PixPrimeiraAtual["status"], valor: Number(a.valor ?? 0), txid: str(a.txid) ?? "",
      pix_copia_cola: str(a.pix_copia_cola), expira_em: str(a.expira_em) ?? "", data_pagamento: str(a.data_pagamento), ultimo_erro: str(a.ultimo_erro),
    } : null,
  };
}

/** Mostrar o botão: grupo vigente, sem Pix da 1ª mensalidade em andamento/pago, e com pendências que não entram no débito automático. */
export function podeGerarPrimeira(p: PreviaPrimeira): boolean {
  return p.disponivel && p.completo && p.itens.length > 0 && (!p.atual || p.atual.status === "reservado");
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function mensagemWhatsappPrimeira(itensPix: ItemPrimeira[], total: number, copiaCola: string, expira: string): string {
  const validade = new Date(expira).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const linhas = itensPix.map((i) => `• ${i.descricao}: ${brl(i.valor)}`).join("\n");
  return `Olá! Segue o Pix da sua 1ª mensalidade FORTEM:\n${linhas}\nTotal: ${brl(total)}\n\n` +
    `Abra o app do seu banco, escolha Pix > Copia e Cola e cole o código abaixo. Válido até ${validade}.\n\n${copiaCola}`;
}
