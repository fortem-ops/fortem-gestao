import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { WHATSAPP_FORTEM, type CatalogoPublico } from "@/lib/planosPublico2027";

const PlanosPublico2027 = lazy(() => import("./PlanosPublico2027"));

/**
 * /planos: sempre a página 2027. Sem itens vendáveis (antes do go-live), o público vê "em breve";
 * a prévia de admin (?previa=1) mostra os itens ainda desligados.
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

  if (isLoading) return <div data-planos2027="true" className="min-h-screen bg-background" />;
  const usar2027 = !!data && data.planos.length > 0 && (data.disponivel || data.previa);
  if (!usar2027) return <PlanosEmBreve />;
  return (
    <Suspense fallback={<div data-planos2027="true" className="min-h-screen bg-background" />}>
      <PlanosPublico2027 catalogo={data!} />
    </Suspense>
  );
}

function PlanosEmBreve() {
  const link = `https://wa.me/${WHATSAPP_FORTEM}?text=${encodeURIComponent("Olá, quero saber mais sobre os planos FORTEM.")}`;
  return (
    <div data-planos2027="true" className="min-h-screen bg-background text-foreground">
      <Seo path="/planos" title="Planos FORTEM 2027" description="Os novos planos FORTEM chegam em breve. Fale com a equipe pelo WhatsApp." />
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <span className="font-display text-xl font-black tracking-tight">FORTEM</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-20">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Novos planos</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold uppercase leading-tight">Planos 2027 em breve</h1>
        <p className="mt-4 text-muted-foreground">
          Estamos preparando os novos planos FORTEM. Enquanto isso, a equipe atende você pelo WhatsApp para montar o seu plano.
        </p>
        <a href={link} target="_blank" rel="noreferrer" className="mt-8 inline-block bg-primary text-primary-foreground px-6 py-4 font-display font-bold uppercase tracking-wider">
          Falar no WhatsApp
        </a>
      </main>
    </div>
  );
}
