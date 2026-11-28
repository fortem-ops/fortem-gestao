import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ComoGanharConquistas } from "@/components/portal/ComoGanharConquistas";
import { EXPLICACAO_BADGE, useMeuPlanoClube } from "@/lib/clubePlano";
import {
  GRUPOS_CONQUISTAS,
  calcularProximaConquista,
  grupoDaConquista,
  type BadgePortal,
} from "@/lib/portalReorganizacao";
import { cn } from "@/lib/utils";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";

export function EvolucaoConquistasAba() {
  const { student } = useStudentPortal();
  const [badgeAberto, setBadgeAberto] = useState<BadgePortal | null>(null);
  const { data: meuPlano } = useMeuPlanoClube(!!student);

  const { data: badges, isLoading } = useQuery<BadgePortal[]>({
    queryKey: ["portal-clube-badges", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("clube_badges").select("id, codigo, nome, descricao, criterio").eq("ativo", true),
        supabase.from("clube_aluno_badges").select("badge_id, conquistado_em").eq("aluno_id", student!.id),
      ]);
      const conq = new Map((mine.data ?? []).map((b) => [b.badge_id, b.conquistado_em]));
      return (all.data ?? []).map((b) => ({
        id: b.id,
        codigo: b.codigo,
        nome: b.nome,
        descricao: b.descricao,
        criterio: b.criterio,
        conquistado: conq.has(b.id),
        conquistado_em: conq.get(b.id) ?? null,
      }));
    },
  });

  const { data: totalTreinos = 0 } = useQuery<number>({
    queryKey: ["portal-total-treinos-conquistas", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { count } = await supabase
        .from("treino_agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("aluno_id", student!.id)
        .eq("status", "realizado");
      return count ?? 0;
    },
  });

  if (!student) return null;

  const lista = badges ?? [];
  const desbloqueadas = lista.filter((b) => b.conquistado).length;
  const total = lista.length;
  const pct = total > 0 ? Math.round((desbloqueadas / total) * 100) : 0;
  const proxima = calcularProximaConquista(
    lista,
    totalTreinos,
    meuPlano?.semanas_seguidas ?? 0,
    meuPlano?.chave === "consultoria",
  );

  return (
    <div className="space-y-6 pb-8 animate-fade-in" style={{ fontFamily: "Archivo, sans-serif" }}>
      {/* Card resumo */}
      <section className="space-y-3 border border-[#4A4B4B] bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black uppercase text-foreground">
            Desbloqueadas {desbloqueadas} de {total}
          </p>
          <span className="text-xs font-bold text-[#B1B3B3]">{pct}%</span>
        </div>
        <div className="h-1.5 bg-[#2C2C2C] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#C8282A]" style={{ width: `${pct}%` }} />
        </div>
        {proxima && (
          <p className="text-xs text-[#B1B3B3]">
            Próxima: <strong className="text-foreground">{proxima.nome}</strong> · faltam {proxima.faltam}
          </p>
        )}
        <ComoGanharConquistas />
      </section>

      {/* Grade agrupada em 3 colunas */}
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        GRUPOS_CONQUISTAS.map((grupo) => {
          const itens = lista.filter((b) => grupoDaConquista(b.codigo) === grupo.id);
          if (itens.length === 0) return null;
          return (
            <section key={grupo.id} className="space-y-3">
              <p className={ROTULO}>{grupo.titulo}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {itens.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBadgeAberto(b)}
                    className={cn(
                      "flex min-h-[84px] flex-col items-center justify-center bg-card p-2.5 text-center",
                      b.conquistado
                        ? "border border-white text-foreground"
                        : "border border-dashed border-[#4A4B4B] text-[#B1B3B3] opacity-70",
                    )}
                  >
                    <p className="text-[11px] font-bold leading-tight">{b.nome}</p>
                    <p className="mt-1.5 text-[10px] text-[#B1B3B3]">
                      {b.conquistado && b.conquistado_em
                        ? format(new Date(b.conquistado_em), "dd/MM/yy")
                        : "Bloqueada"}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}

      {badgeAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setBadgeAberto(null)}>
          <div
            role="dialog"
            aria-label={badgeAberto.nome}
            className="w-full space-y-3 border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={ROTULO}>Conquista</p>
            <p className="text-xl font-black uppercase text-foreground">{badgeAberto.nome}</p>
            <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", badgeAberto.conquistado ? "text-[#4CC38A]" : "text-[#E3B341]")}>
              {badgeAberto.conquistado ? "Desbloqueada" : "Bloqueada"}
            </p>
            <p className="text-sm text-[#B1B3B3]">{EXPLICACAO_BADGE[badgeAberto.nome] ?? badgeAberto.descricao ?? ""}</p>
            <button
              type="button"
              onClick={() => setBadgeAberto(null)}
              className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}