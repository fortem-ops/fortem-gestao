/**
 * Regras da página pública /planos (2027). Todos os valores vêm do catálogo
 * (fn_planos_publico_2027) e os totais só de calcularVenda2027.
 */
import { calcularVenda2027, type ResultadoVenda2027, type FormaServicos2027 } from "./vendas2027";

export type Familia2027 = "start_2027" | "power_2027" | "pro_2027";
export type Frequencia2027 = "1x" | "2x" | "3x" | "livre";
export type FormaPublica = "recorrencia" | "cartao_parcelado" | "pix_vista";

export type PlanoPublico = {
  codigo: string;
  familia: Familia2027;
  nome: string;
  frequencia: Frequencia2027;
  modalidade_cobranca: "recorrencia_mensal" | "anual";
  valor: number;
  taxa_recorrencia: number;
  quantidade_creditos: number | null;
  ilimitado: boolean;
  fidelidade_meses: number | null;
  licenca_dias: number | null;
  avaliacoes_funcionais: number;
  permite_fixar_horario: boolean;
  bota_compressao_mes: number;
  nivel_clube: string | null;
  reposicao_saldo_pct: number;
};

export type ServicoPublico = { codigo: string; nome: string; atividade: string; quantidade_sessoes: number; valor: number };

export type CatalogoPublico = {
  previa: boolean;
  disponivel: boolean;
  planos: PlanoPublico[];
  servicos: ServicoPublico[];
  corrida: { nome: string; valor: number }[];
};

export const FAMILIAS: Familia2027[] = ["start_2027", "power_2027", "pro_2027"];
export const FREQUENCIAS: Frequencia2027[] = ["1x", "2x", "3x", "livre"];

export const NOME_FAMILIA: Record<Familia2027, string> = { start_2027: "Start", power_2027: "Power", pro_2027: "Pro" };

export function rotuloFrequencia(f: Frequencia2027): string {
  return f === "livre" ? "Livre" : `${f} por semana`;
}

/** Start: só recorrência mensal no cartão. Power/Pro: 12x, Pix à vista ou recorrência. */
export function formasPermitidas(familia: Familia2027): FormaPublica[] {
  return familia === "start_2027" ? ["recorrencia"] : ["cartao_parcelado", "pix_vista", "recorrencia"];
}

export function encontrarItem(
  cat: Pick<CatalogoPublico, "planos">,
  familia: Familia2027,
  freq: Frequencia2027,
  forma: FormaPublica,
): PlanoPublico | undefined {
  const modalidade = forma === "recorrencia" ? "recorrencia_mensal" : "anual";
  return cat.planos.find((p) => p.familia === familia && p.frequencia === freq && p.modalidade_cobranca === modalidade);
}

/** Item usado para mostrar características (vantagens não mudam com a forma de pagamento). */
export function itemReferencia(cat: Pick<CatalogoPublico, "planos">, familia: Familia2027, freq: Frequencia2027) {
  return encontrarItem(cat, familia, freq, "recorrencia") ?? encontrarItem(cat, familia, freq, "cartao_parcelado");
}

/** Preço mensal de vitrine = valor mensal do catálogo (sem a taxa da recorrência). */
export function precoMensalVitrine(cat: Pick<CatalogoPublico, "planos">, familia: Familia2027, freq: Frequencia2027) {
  const m = encontrarItem(cat, familia, freq, "recorrencia");
  if (m) return Number(m.valor);
  const a = encontrarItem(cat, familia, freq, "cartao_parcelado");
  return a ? Number(a.valor) / 12 : null;
}

export function valorCorrida(cat: Pick<CatalogoPublico, "corrida">, familia: Familia2027): number | null {
  const alvo = `Corrida - ${NOME_FAMILIA[familia]}`;
  const c = cat.corrida.find((x) => x.nome === alvo);
  return c ? Number(c.valor) : null;
}

export type EscolhaPublica = {
  item: PlanoPublico;
  servicos: ServicoPublico[];
  forma: FormaPublica;
  parcelas: number;
  formaServicos: FormaServicos2027;
  parcelasServicos: number;
};

export function calcularResumo(e: EscolhaPublica): ResultadoVenda2027 {
  return calcularVenda2027({
    item: e.item,
    servicos: e.servicos.map((s) => ({ codigo: s.codigo, valor: s.valor })),
    forma: e.forma,
    parcelas: e.forma === "cartao_parcelado" ? e.parcelas : 1,
    formaServicos: e.formaServicos,
    parcelasServicos: e.formaServicos === "cartao_parcelado" ? e.parcelasServicos : 1,
  });
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "12x de R$ 329,00" ou "11x de R$ X + 1x de R$ Y" quando a última parcela leva a sobra. */
export function descreverParcelas(parcelas: { valor: number }[]): string {
  if (parcelas.length === 0) return "";
  if (parcelas.length === 1) return `1x de ${brl(parcelas[0].valor)}`;
  const primeira = parcelas[0].valor;
  const ultima = parcelas[parcelas.length - 1].valor;
  if (primeira === ultima) return `${parcelas.length}x de ${brl(primeira)}`;
  return `${parcelas.length - 1}x de ${brl(primeira)} + 1x de ${brl(ultima)}`;
}
