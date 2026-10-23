/**
 * Regras de tela da venda 2027 que dependem da família (Consultoria Online).
 * Para Start/Power/Pro tudo devolve exatamente o comportamento anterior.
 */
import type { FormaPlano2027, FormaServicos2027 } from "@/lib/vendas2027";

export const FAMILIA_CONSULTORIA = "consultoria_2027";
export const DURACOES_CONSULTORIA = [
  { value: 1, label: "Mensal" },
  { value: 4, label: "4 meses" },
  { value: 6, label: "6 meses" },
] as const;

export function rotuloDuracao(meses: number): string {
  return DURACOES_CONSULTORIA.find((d) => d.value === meses)?.label ?? `${meses} meses`;
}

export function ehConsultoriaFamilia(familia: string): boolean {
  return familia === FAMILIA_CONSULTORIA;
}

/** Plano de ciclo mensal (uma cobrança por ciclo): Start ou Consultoria Mensal. */
export function ehCicloMensal2027(familia: string, duracao: number): boolean {
  return familia === "start_2027" || (ehConsultoriaFamilia(familia) && duracao === 1);
}

export function ehPacoteConsultoria(familia: string, duracao: number): boolean {
  return ehConsultoriaFamilia(familia) && duracao > 1;
}

/** Formas de pagamento do plano que a tela oferece. */
export function formasPermitidas2027(familia: string, duracao: number): FormaPlano2027[] {
  if (ehCicloMensal2027(familia, duracao)) return ["recorrencia"];
  if (ehPacoteConsultoria(familia, duracao)) return ["cartao_parcelado", "pix_vista"];
  return ["cartao_parcelado", "pix_vista", "recorrencia"];
}

/** Máximo de parcelas no cartão parcelado. */
export function maxParcelas2027(familia: string, duracao: number): number {
  return ehPacoteConsultoria(familia, duracao) ? duracao : 12;
}

/** Forma efetiva enviada ao servidor. */
export function formaEfetiva2027(familia: string, duracao: number, escolhida: FormaPlano2027): FormaPlano2027 {
  const permitidas = formasPermitidas2027(familia, duracao);
  return permitidas.includes(escolhida) ? escolhida : permitidas[0];
}

type ItemCat = {
  familia: string;
  frequencia?: string | number | null;
  modalidade_cobranca: string;
  periodo_meses?: number | string | null;
};

export function selecionarItem2027<T extends ItemCat>(
  catalogo: T[],
  familia: string,
  freq: string,
  modalidade: string,
  duracao: number,
): T | undefined {
  if (ehConsultoriaFamilia(familia)) {
    return catalogo.find((c) => c.familia === familia && Number(c.periodo_meses) === duracao);
  }
  return catalogo.find(
    (c) => c.familia === familia && String(c.frequencia) === freq && c.modalidade_cobranca === modalidade,
  );
}

/** Documento de contrato: não é gerado para a Consultoria (venda sem contrato). */
export function deveGerarDocumento2027(familia: string): boolean {
  return !ehConsultoriaFamilia(familia);
}

/** O chip da Consultoria só aparece com item liberado ou para aluno de teste. */
export function mostrarChipConsultoria(alunoDeTeste: boolean, algumItemVendavel: boolean): boolean {
  return alunoDeTeste || algumItemVendavel;
}

export type EntradaPayload2027 = {
  alunoId: string;
  catalogoId: string;
  familia: string;
  duracao: number;
  servicosSel: string[];
  forma: FormaPlano2027;
  parcelas: number;
  formaServicos: FormaServicos2027;
  parcelasServicos: number;
  dataInicio: string;
  primeiroVenc: string;
  substituir: boolean;
  observacoes: string;
  idem: string;
  desconto: number;
  descontoRecorrente: "" | "primeiro" | "todos";
};

/** Objeto enviado a fn_venda_2027_criar. */
export function montarPayloadVenda2027(e: EntradaPayload2027) {
  return {
    aluno_id: e.alunoId,
    catalogo_id: e.catalogoId,
    servicos: e.servicosSel,
    forma: e.forma,
    parcelas: e.forma === "cartao_parcelado" ? e.parcelas : 1,
    forma_servicos: e.formaServicos,
    parcelas_servicos: e.formaServicos === "cartao_parcelado" ? e.parcelasServicos : 1,
    data_inicio: e.dataInicio,
    primeiro_vencimento: e.primeiroVenc,
    substituir: e.substituir,
    observacoes: e.observacoes,
    idempotency_key: e.idem,
    desconto: e.desconto || 0,
    desconto_recorrente: ehCicloMensal2027(e.familia, e.duracao) && e.desconto > 0 && e.descontoRecorrente === "todos",
  };
}
