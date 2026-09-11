export interface ProdutoCatalogo {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco_base: number | null;
  imagem_url: string | null;
  ativo: boolean | null;
  permite_encomenda: boolean | null;
  created_at: string | null;
  ordem?: number | null;
}

export interface ProdutoImagem {
  id: string;
  produto_id: string;
  cor: string | null;
  imagem_url: string;
  legenda: string | null;
  ordem: number;
  principal: boolean;
}

export interface ProdutoVariante {
  id: string;
  produto_id: string;
  tamanho: string | null;
  cor: string | null;
  cor_hex: string | null;
  preco: number | null;
  estoque_atual: number | null;
  imagem_url: string | null;
  ativo: boolean | null;
  sku: string | null;
}

export interface ProdutoComVariantes extends ProdutoCatalogo {
  variantes: ProdutoVariante[];
  imagens: ProdutoImagem[];
}

export const imagensDoProduto = (
  produto: ProdutoComVariantes,
  cor?: string | null,
): ProdutoImagem[] => {
  const especificas = cor
    ? produto.imagens.filter((imagem) => imagem.cor?.toLowerCase() === cor.toLowerCase())
    : [];
  const gerais = produto.imagens.filter((imagem) => !imagem.cor);
  return (especificas.length ? especificas : gerais).sort(
    (a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem,
  );
};

export const imagemPrincipalProduto = (
  produto: ProdutoComVariantes,
  cor?: string | null,
): string | null => imagensDoProduto(produto, cor)[0]?.imagem_url ?? produto.imagem_url;

export const precoDaVariante = (
  produto: Pick<ProdutoCatalogo, "preco_base">,
  variante?: ProdutoVariante | null
): number => {
  if (variante && variante.preco !== null && variante.preco !== undefined) {
    return Number(variante.preco);
  }
  return Number(produto.preco_base ?? 0);
};

export const estoqueTotal = (variantes: ProdutoVariante[]): number =>
  variantes.reduce((acc, v) => acc + Math.max(0, Number(v.estoque_atual ?? 0)), 0);

export const menorPreco = (produto: ProdutoComVariantes): number => {
  const disponiveis = produto.variantes.filter(
    (v) => Number(v.estoque_atual ?? 0) > 0
  );
  const base = disponiveis.length ? disponiveis : produto.variantes;
  const precos = base.map((v) => precoDaVariante(produto, v));
  if (!precos.length) return Number(produto.preco_base ?? 0);
  return Math.min(...precos);
};

export const formatBRL = (valor: number): string =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
