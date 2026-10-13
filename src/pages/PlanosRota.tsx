import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TEXTOS_CHECKOUT } from "@/config/planosPublicoTextos";
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
  // Na prévia do editor a sessão chega com atraso: espera a sessão antes de pedir o catálogo,
  // senão o servidor responde como visitante e a prévia de admin cai no fluxo público (com Turnstile).
  const [usuario, setUsuario] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => { if (vivo) setUsuario(data.session?.user.id ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (vivo) setUsuario(s?.user.id ?? null); });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);
  const { data, isLoading } = useQuery({
    queryKey: ["planos-publico-2027", previa, previa ? usuario : null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_planos_publico_2027" as any, { p_previa: previa });
      if (error) throw error;
      return data as unknown as CatalogoPublico;
    },
    enabled: !previa || usuario !== undefined,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading || (previa && usuario === undefined)) return <div data-planos2027="true" className="min-h-screen bg-background" />;
  const usar2027 = !!data && data.planos.length > 0 && (data.disponivel || data.previa);
  // Prévia pedida sem admin logado: o servidor não liberou os itens; orienta o login.
  if (previa && !data?.previa) return <PreviaSemLogin />;
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

function PreviaSemLogin() {
  const T = TEXTOS_CHECKOUT.previaLogin;
  return (
    <div data-planos2027="true" className="min-h-screen bg-background text-foreground">
      <Seo path="/planos" title="Planos FORTEM 2027" description="Prévia de admin dos planos FORTEM." />
      <header className="border-b border-border"><div className="mx-auto max-w-5xl px-4 py-5"><span className="font-display text-xl font-black tracking-tight">FORTEM</span></div></header>
      <main className="mx-auto max-w-2xl px-4 py-20">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{T.titulo}</p>
        <h1 role="alert" className="mt-2 font-display text-2xl sm:text-3xl font-extrabold uppercase leading-tight">{T.texto}</h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className="inline-block bg-primary text-primary-foreground px-6 py-4 font-display font-bold uppercase tracking-wider">{T.entrar}</Link>
          <Link to="/planos" className="inline-block border border-border px-6 py-4 font-display font-bold uppercase tracking-wider">{T.publica}</Link>
        </div>
      </main>
    </div>
  );
}
