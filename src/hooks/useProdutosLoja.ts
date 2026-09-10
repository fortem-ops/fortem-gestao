import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ProdutoCatalogo,
  ProdutoComVariantes,
  ProdutoVariante,
} from "@/integrations/store/types";

const PRODUTO_COLS =
  "id,nome,descricao,categoria,preco_base,imagem_url,ativo,permite_encomenda,created_at";
const VARIANTE_COLS =
  "id,produto_id,tamanho,cor,cor_hex,preco,estoque_atual,imagem_url,ativo,sku";

export const useProdutosLoja = () =>
  useQuery<ProdutoComVariantes[]>({
    queryKey: ["loja", "produtos"],
    queryFn: async () => {
      const { data: produtos, error } = await (supabase as any)
        .from("produtos_catalogo")
        .select(PRODUTO_COLS)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const lista = (produtos ?? []) as ProdutoCatalogo[];
      if (!lista.length) return [];

      const { data: variantes, error: errVar } = await (supabase as any)
        .from("produtos_variantes")
        .select(VARIANTE_COLS)
        .eq("ativo", true)
        .in(
          "produto_id",
          lista.map((p) => p.id)
        );
      if (errVar) throw errVar;

      const porProduto = new Map<string, ProdutoVariante[]>();
      ((variantes ?? []) as ProdutoVariante[]).forEach((v) => {
        const arr = porProduto.get(v.produto_id) ?? [];
        arr.push(v);
        porProduto.set(v.produto_id, arr);
      });

      return lista.map((p) => ({
        ...p,
        variantes: porProduto.get(p.id) ?? [],
      }));
    },
  });

export const useProdutoLoja = (produtoId?: string) =>
  useQuery<ProdutoComVariantes | null>({
    queryKey: ["loja", "produto", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data: produto, error } = await (supabase as any)
        .from("produtos_catalogo")
        .select(PRODUTO_COLS)
        .eq("id", produtoId!)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      if (!produto) return null;

      const { data: variantes, error: errVar } = await (supabase as any)
        .from("produtos_variantes")
        .select(VARIANTE_COLS)
        .eq("produto_id", produtoId!)
        .eq("ativo", true);
      if (errVar) throw errVar;

      return {
        ...(produto as ProdutoCatalogo),
        variantes: (variantes ?? []) as ProdutoVariante[],
      };
    },
  });
