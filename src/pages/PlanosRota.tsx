import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogoPublico } from "@/lib/planosPublico2027";

const PlanosLegado = lazy(() => import("./Planos"));
const PlanosPublico2027 = lazy(() => import("./PlanosPublico2027"));

/**
 * /planos: mostra a página 2027 quando há itens vendáveis (troca automática no go-live)
 * ou na prévia de admin (?previa=1). Caso contrário, a página legada segue igual.
 */
export default function PlanosRota() {
  const [params] = useSearchParams();
  const previa = params.get("previa") === "1";
  const { data, isLoading } = useQuery({
    queryKey: ["planos-publico-2027", previa],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_planos_publico_2027" as any, { p_previa: previa });
      if (error) throw error;
      return data as unknown as CatalogoPublico;
    },
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) return <div className="min-h-screen bg-background" />;
  const usar2027 = !!data && data.planos.length > 0 && (data.disponivel || data.previa);
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      {usar2027 ? <PlanosPublico2027 catalogo={data!} /> : <PlanosLegado />}
    </Suspense>
  );
}
