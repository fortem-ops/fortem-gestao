export type VendaRow = {
  valor?: number | null;
  status?: string | null;
  plano_tipo?: string | null;
  item?: string | null;
};

const isCancelado = (r: VendaRow) =>
  (r.status ?? "").toLowerCase() === "cancelado";

export function calcStats(rows: VendaRow[]) {
  const validas = rows.filter((r) => !isCancelado(r));
  const cancelados = rows.length - validas.length;
  const total = validas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const qtd = validas.length;
  const ticket = qtd > 0 ? total / qtd : 0;
  return { total, qtd, ticket, cancelados };
}

export function calcPorPlano(rows: VendaRow[]) {
  const map = new Map<string, { plano: string; valor: number; qtd: number }>();
  for (const r of rows) {
    if (isCancelado(r)) continue;
    const plano = r.plano_tipo || r.item || "—";
    const prev = map.get(plano) ?? { plano, valor: 0, qtd: 0 };
    prev.valor += Number(r.valor) || 0;
    prev.qtd += 1;
    map.set(plano, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
}

export function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(n) || 0);
}

export const TAXA_MENSAL_RECORRENCIA = 20;

export type TipoCobranca = "recorrencia" | "tradicional";

export function calcularTotaisVenda(opts: {
  valorPlano: number;
  desconto: number;
  periodoMeses: number;
  tipoCobranca: TipoCobranca | null;
  aluno2025: boolean;
}) {
  const valorPlano = Number(opts.valorPlano) || 0;
  const desconto = Math.max(0, Math.min(Number(opts.desconto) || 0, valorPlano));
  const subtotalPlano = Math.max(0, valorPlano - desconto);
  const periodo = Math.max(1, Number(opts.periodoMeses) || 1);
  const taxaMensal =
    opts.tipoCobranca === "recorrencia" && !opts.aluno2025 ? TAXA_MENSAL_RECORRENCIA : 0;
  const taxaTotal = taxaMensal * periodo;
  const total = subtotalPlano + taxaTotal;
  const mensalEstimado =
    opts.tipoCobranca === "recorrencia" ? subtotalPlano / periodo + taxaMensal : total;
  return { valorPlano, desconto, subtotalPlano, taxaMensal, taxaTotal, total, mensalEstimado };
}

