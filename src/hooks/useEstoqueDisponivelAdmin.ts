import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EstoqueVariante = { fisico: number; encomendado: number; disponivel: number };
export const ESTOQUE_DISPONIVEL_KEY = ["loja-estoque-disponivel"];

/** Físico/Encomendado/Disponível por variante (fn_loja_estoque_disponivel). */
export const useEstoqueDisponivelAdmin = () =>
  useQuery({
    queryKey: ESTOQUE_DISPONIVEL_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_loja_estoque_disponivel", { p_produto_ids: null });
      if (error) throw error;
      const m = new Map<string, EstoqueVariante>();
      for (const d of (data ?? []) as any[]) {
        m.set(d.variante_id, {
          fisico: Number(d.estoque_fisico ?? 0),
          encomendado: Number(d.encomendado_pendente ?? 0),
          disponivel: Number(d.disponivel ?? 0),
        });
      }
      return m;
    },
  });

/** Variante sem retorno = físico do próprio registro, encomendado 0. */
export const estoqueDe = (m: Map<string, EstoqueVariante> | undefined, id: string, fisicoRegistro: number): EstoqueVariante =>
  m?.get(id) ?? { fisico: fisicoRegistro, encomendado: 0, disponivel: Math.max(0, fisicoRegistro) };
