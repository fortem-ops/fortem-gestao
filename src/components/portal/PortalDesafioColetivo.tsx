import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { desafioMaisProximo, percentualDesafio, type DesafioPortal } from "./portalPresentation";
import { textoRecompensaDesafio } from "@/lib/portalReorganizacao";

export default function PortalDesafioColetivo({ enabled, compacto = false }: { enabled: boolean; compacto?: boolean }) {
  // Mesma consulta e cache anteriormente usados pela Home.
  const { data: desafiosAtivos = [] } = useQuery({
    queryKey: ["portal-desafios-ativos"], enabled,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("clube_desafios").select("*").eq("status", "ativo")
        .lte("data_inicio", hoje).gte("data_fim", hoje)
        .order("data_fim", { ascending: true });
      return (data || []) as DesafioPortal[];
    },
  });
  const principal = desafioMaisProximo(desafiosAtivos);
  if (!enabled || !principal) return null;
  const lista = compacto ? [principal] : [principal, ...desafiosAtivos.filter((d) => d.id !== principal.id)];
  return <section className="portal-desafios space-y-3" aria-label="Desafio coletivo">
    {lista.map((d) => {
      const pct = percentualDesafio(d);
      const faltam = Math.max(0, d.valor_meta - d.progresso_atual);
      const dataFimBr = new Date(`${d.data_fim}T12:00:00`).toLocaleDateString("pt-BR");
      const recompensa = textoRecompensaDesafio(d);
      const conteudo = <>
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Desafio coletivo</p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 break-words text-base font-bold">{d.titulo}</h2>
          <span className="shrink-0 text-lg font-bold">{pct}%</span>
          {compacto && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>
        {!compacto && d.descricao && <p className="text-sm text-muted-foreground">{d.descricao}</p>}
        <div role="progressbar" aria-label={d.titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1 overflow-hidden bg-border">
          <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {d.progresso_atual.toLocaleString("pt-BR")} de {d.valor_meta.toLocaleString("pt-BR")} · {faltam > 0 ? `faltam ${faltam.toLocaleString("pt-BR")}` : "meta atingida"} · até {dataFimBr}
        </p>
        {!compacto && recompensa && <p className="text-xs text-muted-foreground">{recompensa}</p>}
      </>;
      return compacto
        ? <Link key={d.id} to="/portal/comunidade?aba=clube" className="block min-h-[44px] space-y-2 border border-border bg-card p-4 text-foreground">{conteudo}</Link>
        : <div key={d.id} className="space-y-3 border border-border bg-card p-4 text-foreground">{conteudo}</div>;
    })}
  </section>;
}