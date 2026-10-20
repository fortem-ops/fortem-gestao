import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { desafioMaisProximo, percentualDesafio, type DesafioPortal } from "./portalPresentation";

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
      const dias = Math.max(0, Math.ceil((new Date(d.data_fim).getTime() - Date.now()) / 86400000));
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
        <p className="text-xs text-muted-foreground">{faltam > 0 ? `Faltam ${faltam.toLocaleString("pt-BR")} para a meta` : "Meta atingida"}</p>
        {!compacto && <>
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div><dt className="text-muted-foreground">Valor atual</dt><dd className="font-bold">{d.progresso_atual.toLocaleString("pt-BR")}</dd></div>
            <div><dt className="text-muted-foreground">Meta</dt><dd className="font-bold">{d.valor_meta.toLocaleString("pt-BR")}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">Até {new Date(`${d.data_fim}T12:00:00`).toLocaleDateString("pt-BR")} · {dias > 0 ? `${dias} dias restantes` : "Último dia"}</p>
          {(d.pontos_recompensa ?? 0) > 0 && <p className="text-xs text-muted-foreground">Ao atingir a meta, todos os alunos ativos recebem {d.pontos_recompensa} pontos no Clube FORTEM.</p>}
          {d.mensagem_recompensa && <p className="text-xs text-muted-foreground">{d.mensagem_recompensa}</p>}
        </>}
      </>;
      return compacto
        ? <Link key={d.id} to="/portal/clube" className="block min-h-[44px] space-y-2 border border-border bg-card p-4 text-foreground">{conteudo}</Link>
        : <div key={d.id} className="space-y-3 border border-border bg-card p-4 text-foreground">{conteudo}</div>;
    })}
  </section>;
}