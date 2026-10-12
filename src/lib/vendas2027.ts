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

export function calcularVenda2027(e: EntradaVenda2027): ResultadoVenda2027 {
  const { item, forma } = e;
  const servicos = e.servicos ?? [];
  const valorC = toCents(item.valor);
  const servicosC = servicos.reduce((s, x) => s + toCents(x.valor), 0);
  if (valorC <= 0) throw new Error("Valor do plano inválido");

  const ehStart = item.familia === "start_2027";
  const ehMensal = item.modalidade_cobranca === "recorrencia_mensal";

  if (ehStart && !ehMensal) throw new Error("Start 2027 é só recorrência mensal");
  if (ehMensal && forma !== "recorrencia") throw new Error("Item mensal só pode ser vendido em recorrência");
  if (!ehMensal && forma === "recorrencia") throw new Error("Item anual não pode ser vendido em recorrência");

  // Power/Pro anual: plano + serviços nas mesmas parcelas (ou Pix à vista)
  if (!ehMensal) {
    const n = forma === "pix_vista" ? 1 : inteiroEntre(e.parcelas, 1, MAX_PARCELAS_PLANO_2027, "Parcelas");
    const parcelas = montarParcelas(valorC, servicosC, n);
    return {
      plano: { forma, total: fromCents(valorC + servicosC), parcelas },
      servicosAvulsos: null,
      totalPlano: fromCents(valorC),
      totalServicos: fromCents(servicosC),
      totalGeral: fromCents(valorC + servicosC),
    };
  }

  // Recorrência mensal: valor do catálogo + taxa (Start sem taxa), 12 cobranças iguais
  const taxaC = ehStart ? 0 : toCents(item.taxa_recorrencia);
  const mensalC = valorC + taxaC;
  const parcelasPlano: Parcela2027[] = Array.from({ length: MESES_RECORRENCIA_2027 }, (_, i) => ({
    numero: i + 1,
    valor: fromCents(mensalC),
    plano: fromCents(mensalC),
    servicos: 0,
  }));
  const totalPlanoC = mensalC * MESES_RECORRENCIA_2027;

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
