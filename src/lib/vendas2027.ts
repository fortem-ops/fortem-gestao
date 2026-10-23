/**
 * Cálculo de valores das vendas dos planos 2027 (função pura, sem banco).
 * Regras: sem desconto de combo nem de Pix à vista; centavos de arredondamento
 * sempre na última parcela.
 */

export type Item2027 = {
  codigo: string;
  familia: "start_2027" | "power_2027" | "pro_2027" | string;
  modalidade_cobranca: "recorrencia_mensal" | "anual" | string;
  valor: number | string;
  taxa_recorrencia?: number | string | null;
  /** Duração em meses; na modalidade "pacote" também é o máximo de parcelas. */
  periodo_meses?: number | string | null;
};

export type Servico2027 = { codigo: string; valor: number | string };

export type FormaPlano2027 = "recorrencia" | "cartao_parcelado" | "pix_vista";
export type FormaServicos2027 = "cartao_parcelado" | "pix_vista";

export type Parcela2027 = {
  numero: number;
  valor: number;
  plano: number;
  servicos: number;
};

export type Cobranca2027 = {
  forma: FormaPlano2027 | FormaServicos2027;
  total: number;
  parcelas: Parcela2027[];
};

export type ResultadoVenda2027 = {
  plano: Cobranca2027;
  /** Serviços cobrados à parte (Start e recorrência). Null quando não há ou quando entram nas 12x. */
  servicosAvulsos: Cobranca2027 | null;
  totalPlano: number;
  totalServicos: number;
  totalGeral: number;
};

export type EntradaVenda2027 = {
  item: Item2027;
  servicos?: Servico2027[];
  forma: FormaPlano2027;
  /** Nº de parcelas no cartão (Power/Pro anual): 1 a 12. */
  parcelas?: number;
  /** Forma dos serviços cobrados à parte. */
  formaServicos?: FormaServicos2027;
  /** Parcelas dos serviços à parte no cartão: 1 a 6. */
  parcelasServicos?: number;
  /** Desconto sobre o plano (R$). Anual: abate o total; mensal: abate a 1ª mensalidade. */
  descontoPlano?: number;
};

export const MESES_RECORRENCIA_2027 = 12;
export const MAX_PARCELAS_PLANO_2027 = 12;
export const MAX_PARCELAS_SERVICOS_2027 = 6;

const toCents = (v: number | string | null | undefined) => Math.round((Number(v) || 0) * 100);
const fromCents = (c: number) => c / 100;

function dividir(totalC: number, n: number): number[] {
  const base = Math.floor(totalC / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? totalC - base * (n - 1) : base));
}

function montarParcelas(planoC: number, servicosC: number, n: number): Parcela2027[] {
  const totais = dividir(planoC + servicosC, n);
  const planos = dividir(planoC, n);
  return totais.map((t, i) => ({
    numero: i + 1,
    valor: fromCents(t),
    plano: fromCents(planos[i]),
    servicos: fromCents(t - planos[i]),
  }));
}

function inteiroEntre(v: number | undefined, min: number, max: number, nome: string): number {
  const n = v ?? 1;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${nome} deve ser entre ${min} e ${max}`);
  }
  return n;
}

export const FAMILIA_CONSULTORIA_2027 = "consultoria_2027";

/** Pacote de N meses (Consultoria 4/6 meses): total = valor − desconto, 1..N parcelas ou Pix à vista. */
function calcularPacote(e: EntradaVenda2027, valorC: number, descC: number, servicosC: number): ResultadoVenda2027 {
  const meses = Number(e.item.periodo_meses);
  if (!Number.isInteger(meses) || meses < 1) throw new Error("Duração do pacote inválida");
  if (e.forma === "recorrencia") throw new Error("Pacote não pode ser vendido em recorrência");
  if (servicosC > 0) throw new Error("Pacote não aceita serviços na mesma venda");
  if (descC >= valorC) throw new Error("Desconto maior que o valor do plano");
  const n = e.forma === "pix_vista" ? 1 : inteiroEntre(e.parcelas, 1, meses, "Parcelas");
  const planoC = valorC - descC;
  return {
    plano: { forma: e.forma, total: fromCents(planoC), parcelas: montarParcelas(planoC, 0, n) },
    servicosAvulsos: null,
    totalPlano: fromCents(planoC),
    totalServicos: 0,
    totalGeral: fromCents(planoC),
  };
}

export function calcularVenda2027(e: EntradaVenda2027): ResultadoVenda2027 {
  const { item, forma } = e;
  const servicos = e.servicos ?? [];
  const valorC = toCents(item.valor);
  const servicosC = servicos.reduce((s, x) => s + toCents(x.valor), 0);
  if (valorC <= 0) throw new Error("Valor do plano inválido");
  const descC = toCents(e.descontoPlano);
  if (descC < 0) throw new Error("Desconto inválido");

  const ehStart = item.familia === "start_2027";
  const ehMensal = item.modalidade_cobranca === "recorrencia_mensal";
  // Consultoria Online mensal segue o Start: um ciclo por vez, sem taxa.
  const cicloACiclo = ehStart || item.familia === FAMILIA_CONSULTORIA_2027;

  if (item.modalidade_cobranca === "pacote") return calcularPacote(e, valorC, descC, servicosC);

  if (ehStart && !ehMensal) throw new Error("Start 2027 é só recorrência mensal");
  if (ehMensal && forma !== "recorrencia") throw new Error("Item mensal só pode ser vendido em recorrência");
  if (!ehMensal && forma === "recorrencia") throw new Error("Item anual não pode ser vendido em recorrência");

  // Power/Pro anual: plano + serviços nas mesmas parcelas (ou Pix à vista)
  if (!ehMensal) {
    const n = forma === "pix_vista" ? 1 : inteiroEntre(e.parcelas, 1, MAX_PARCELAS_PLANO_2027, "Parcelas");
    if (descC >= valorC) throw new Error("Desconto maior que o valor do plano");
    const planoC = valorC - descC;
    const parcelas = montarParcelas(planoC, servicosC, n);
    return {
      plano: { forma, total: fromCents(planoC + servicosC), parcelas },
      servicosAvulsos: null,
      totalPlano: fromCents(planoC),
      totalServicos: fromCents(servicosC),
      totalGeral: fromCents(planoC + servicosC),
    };
  }

  // Recorrência mensal: Power/Pro = 12 cobranças de catálogo + taxa;
  // Start e Consultoria = 1 cobrança por ciclo (sem taxa, renova mês a mês até o cancelamento).
  const taxaC = cicloACiclo ? 0 : toCents(item.taxa_recorrencia);
  const mensalC = valorC + taxaC;
  const nCobrancas = cicloACiclo ? 1 : MESES_RECORRENCIA_2027;
  if (descC >= mensalC) throw new Error("Desconto maior que a mensalidade");
  const parcelasPlano: Parcela2027[] = Array.from({ length: nCobrancas }, (_, i) => {
    const v = i === 0 ? mensalC - descC : mensalC;
    return { numero: i + 1, valor: fromCents(v), plano: fromCents(v), servicos: 0 };
  });
  const totalPlanoC = mensalC * nCobrancas - descC;

  let servicosAvulsos: Cobranca2027 | null = null;
  if (servicosC > 0) {
    const formaS = e.formaServicos ?? "pix_vista";
    const n =
      formaS === "pix_vista"
        ? 1
        : inteiroEntre(e.parcelasServicos, 1, MAX_PARCELAS_SERVICOS_2027, "Parcelas dos serviços");
    servicosAvulsos = { forma: formaS, total: fromCents(servicosC), parcelas: montarParcelas(0, servicosC, n) };
  }

  return {
    plano: { forma, total: fromCents(totalPlanoC), parcelas: parcelasPlano },
    servicosAvulsos,
    totalPlano: fromCents(totalPlanoC),
    totalServicos: fromCents(servicosC),
    totalGeral: fromCents(totalPlanoC + servicosC),
  };
}

export type Vendavel2027 = {
  ativo?: boolean | null;
  vendavel_desde?: string | null;
  vendavel_ate?: string | null;
};

/** Item 2027 pode ser vendido hoje? Aluno de teste vê também itens ainda desligados. */
export function itemVendavel2027(item: Vendavel2027, hoje: string, alunoDeTeste: boolean): boolean {
  if (alunoDeTeste) return true;
  if (!item.ativo) return false;
  if (item.vendavel_desde && item.vendavel_desde > hoje) return false;
  if (item.vendavel_ate && item.vendavel_ate < hoje) return false;
  return true;
}

/** Fim do ciclo mensal: do dia da venda até o dia anterior ao mesmo dia do mês seguinte. */
export function fimCicloMensal(inicio: string): string {
  const [y, m, d] = inicio.split("-").map(Number);
  const prox = new Date(Date.UTC(y, m, d));
  if (prox.getUTCMonth() !== (m % 12)) prox.setUTCDate(0); // ex.: 31/01 -> 28/02
  prox.setUTCDate(prox.getUTCDate() - 1);
  return prox.toISOString().slice(0, 10);
}

/** Venda só de serviços 2027: até 6x no cartão ou Pix à vista, sem desconto. */
export function calcularServicos2027(
  servicos: Servico2027[],
  forma: FormaServicos2027,
  parcelas = 1,
): Cobranca2027 {
  const totalC = servicos.reduce((s, x) => s + toCents(x.valor), 0);
  if (totalC <= 0) throw new Error("Escolha ao menos um serviço");
  const n = forma === "pix_vista" ? 1 : inteiroEntre(parcelas, 1, MAX_PARCELAS_SERVICOS_2027, "Parcelas dos serviços");
  return { forma, total: fromCents(totalC), parcelas: montarParcelas(0, totalC, n) };
}

/** Item do catálogo (legado ou 2027) pode aparecer para venda hoje? Respeita ativo e vendavel_desde/ate. */
export function itemCatalogoVendavelHoje(item: Vendavel2027, hoje: string): boolean {
  return itemVendavel2027(item, hoje, false);
}

/** Planos atuais (legado, sem versão) que podem ser vendidos hoje no VendaDialog. */
export function filtrarLegadoVendavel<T extends Vendavel2027 & { versao?: number | null }>(itens: T[], hoje: string): T[] {
  return itens.filter((i) => (i.versao ?? null) === null && itemCatalogoVendavelHoje(i, hoje));
}
