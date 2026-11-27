export interface VarianteEstoque {
  estoque_atual?: number | null;
}

export interface DisponibilidadeProdutoInput {
  variantes: ReadonlyArray<VarianteEstoque>;
  varianteSelecionada: VarianteEstoque | null;
  precisaEscolher: boolean;
  permiteEncomenda: boolean;
}

export interface DisponibilidadeProduto {
  estoqueSelecionado: number;
  semEstoque: boolean;
  encomenda: boolean;
  esgotado: boolean;
  estoqueMax: number;
}

export function calcularDisponibilidadeProduto({
  variantes,
  varianteSelecionada,
  precisaEscolher,
  permiteEncomenda,
}: DisponibilidadeProdutoInput): DisponibilidadeProduto {
  if (variantes.length === 0) {
    return {
      estoqueSelecionado: 99,
      semEstoque: false,
      encomenda: false,
      esgotado: false,
      estoqueMax: 99,
    };
  }

  if (precisaEscolher) {
    const algumaComEstoque = variantes.some(
      (v) => Number(v.estoque_atual ?? 0) > 0
    );
    const semEstoque = !algumaComEstoque;
    const encomenda = semEstoque && permiteEncomenda;
    const esgotado = semEstoque && !encomenda;
    return {
      estoqueSelecionado: 0,
      semEstoque,
      encomenda,
      esgotado,
      estoqueMax: encomenda ? 10 : 0,
    };
  }

  const estoqueSelecionado = varianteSelecionada
    ? Number(varianteSelecionada.estoque_atual ?? 0)
    : 0;
  const semEstoque = estoqueSelecionado <= 0;
  const encomenda = semEstoque && permiteEncomenda;
  const esgotado = semEstoque && !encomenda;

  return {
    estoqueSelecionado,
    semEstoque,
    encomenda,
    esgotado,
    estoqueMax: encomenda ? 10 : estoqueSelecionado,
  };
}

export function textoEscolhaPendente(
  faltaTamanho: boolean,
  faltaCor: boolean
): string {
  if (faltaTamanho && !faltaCor) return "Escolha o tamanho";
  if (faltaCor && !faltaTamanho) return "Escolha a cor";
  return "Escolha as opções";
}