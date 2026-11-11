// Escolha do caminho de cobrança em rede-cobrar-token pelo TIPO da venda, não só pela origem.
// Venda Semestral de teste (origem teste_2027) é sempre de balcão: segue o caminho da 1ª mensalidade.
export type VendaCaminho = {
  origem: string | null;
  tipo_cobranca: string | null;
  familia: string | null;
  versao_2027: boolean;
  tem_cobranca_ciclo1: boolean;
};
export type Caminho = "primeiro_ciclo" | "generico";

export function origemBalcaoRecorrente(v: Pick<VendaCaminho, "origem" | "familia">): boolean {
  return v.origem === "manual" || (v.origem === "teste_2027" && v.familia === "semestral_2027");
}

export function escolherCaminhoCobranca(v: VendaCaminho): Caminho {
  if (v.tipo_cobranca === "recorrencia" && origemBalcaoRecorrente(v)) return "primeiro_ciclo";
  return "generico";
}

/** Caminho genérico nunca baixa só a venda de um plano 2027 recorrente com contrato e cobrança nº 1. */
export function genericoRecusa(v: VendaCaminho): boolean {
  return v.tipo_cobranca === "recorrencia" && v.versao_2027 && v.tem_cobranca_ciclo1;
}
