import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FOTOS_SITE } from "./fotos";

export type ChaveFoto = keyof typeof FOTOS_SITE;
export interface Enquadramento { x: number; y: number; zoom: number }
export interface AjusteFoto {
  chave: string;
  desk: Enquadramento;
  mob: Enquadramento;
  arquivoPath: string | null;
  src: string | null;
  width: number | null;
  height: number | null;
}

export const LIMITE_MOBILE_PX = 768;
export const ENQ_PADRAO: Enquadramento = { x: 50, y: 50, zoom: 1 };

const limitar = (v: number, min: number, max: number, padrao: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao;

export function normalizarEnquadramento(e: Partial<Enquadramento>): Enquadramento {
  return {
    x: limitar(Number(e.x), 0, 100, 50),
    y: limitar(Number(e.y), 0, 100, 50),
    zoom: limitar(Number(e.zoom), 1, 2, 1),
  };
}

export function enquadramentoParaLargura(a: Pick<AjusteFoto, "desk" | "mob">, larguraTela: number): Enquadramento {
  return larguraTela < LIMITE_MOBILE_PX ? a.mob : a.desk;
}

/** Variáveis CSS lidas por `.site-publico .sp-foto img` (celular e computador). */
export function variaveisCss(a: Pick<AjusteFoto, "desk" | "mob">): Record<string, string> {
  return {
    "--fx-m": `${a.mob.x}%`, "--fy-m": `${a.mob.y}%`, "--fz-m": String(a.mob.zoom),
    "--fx-d": `${a.desk.x}%`, "--fy-d": `${a.desk.y}%`, "--fz-d": String(a.desk.zoom),
  };
}

const CHAVE_POR_SRC = new Map<string, string>(Object.entries(FOTOS_SITE).map(([k, f]) => [f.src, k]));
export const chaveDoSrc = (src?: string) => (src ? CHAVE_POR_SRC.get(src) ?? null : null);

export const AJUSTES_QUERY_KEY = ["site-fotos-ajuste"];

export function useAjustesFotosSite() {
  return useQuery({
    queryKey: AJUSTES_QUERY_KEY,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, AjusteFoto>> => {
      const { data, error } = await supabase.rpc("fn_site_fotos_publico");
      if (error) throw error;
      const caminhos = (data ?? []).map((r) => r.arquivo_path).filter(Boolean) as string[];
      const links = new Map<string, string>();
      if (caminhos.length) {
        const { data: assinados } = await supabase.storage.from("site-fotos").createSignedUrls(caminhos, 60 * 60 * 24 * 7);
        assinados?.forEach((s) => { if (s.path && s.signedUrl) links.set(s.path, s.signedUrl); });
      }
      const mapa: Record<string, AjusteFoto> = {};
      for (const r of data ?? []) {
        // Foto trocada sem link legível: não aplicar o enquadramento da nova na foto original.
        if (r.arquivo_path && !links.has(r.arquivo_path)) continue;
        mapa[r.chave] = {
          chave: r.chave,
          desk: normalizarEnquadramento({ x: r.desk_x, y: r.desk_y, zoom: r.desk_zoom }),
          mob: normalizarEnquadramento({ x: r.mob_x, y: r.mob_y, zoom: r.mob_zoom }),
          arquivoPath: r.arquivo_path,
          src: r.arquivo_path ? links.get(r.arquivo_path) ?? null : null,
          width: r.arquivo_width, height: r.arquivo_height,
        };
      }
      return mapa;
    },
  });
}
