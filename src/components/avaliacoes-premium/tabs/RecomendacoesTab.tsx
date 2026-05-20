import { AlertTriangle, CheckCircle2, ShieldAlert, Clock, Activity, Zap } from "lucide-react";
import type { Recomendacao } from "../recomendacoesEngine";

interface Props {
  recomendacoes: Recomendacao[];
}

const PRIO_STYLE: Record<Recomendacao["prioridade"], { cls: string; label: string }> = {
  alta: { cls: "bg-rose-500/10 text-rose-300 border-rose-500/30", label: "ALTA" },
  media: { cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", label: "MÉDIA" },
  baixa: { cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", label: "BAIXA" },
};

const AREA_ICON: Record<Recomendacao["area"], typeof AlertTriangle> = {
  mobilidade: Activity,
  flexibilidade: Zap,
  forca: ShieldAlert,
  composicao: Activity,
  fisioterapia: AlertTriangle,
  reavaliacao: Clock,
};

export function RecomendacoesTab({ recomendacoes }: Props) {
  if (recomendacoes.length === 0) {
    return (
      <div className="bio-card p-8 text-center text-white/70 text-sm flex flex-col items-center gap-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        Nenhuma recomendação crítica detectada nas avaliações atuais.
      </div>
    );
  }

  const grouped = {
    alta: recomendacoes.filter((r) => r.prioridade === "alta"),
    media: recomendacoes.filter((r) => r.prioridade === "media"),
    baixa: recomendacoes.filter((r) => r.prioridade === "baixa"),
  };

  return (
    <div className="space-y-4">
      {(["alta", "media", "baixa"] as const).map((prio) => {
        if (grouped[prio].length === 0) return null;
        return (
          <section key={prio} className="space-y-2">
            <h3 className="bio-label">
              Prioridade {PRIO_STYLE[prio].label}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[prio].map((r) => {
                const Icon = AREA_ICON[r.area];
                return (
                  <div key={r.id} className={`bio-card p-4 border-l-2 ${prio === "alta" ? "border-l-rose-500/60" : prio === "media" ? "border-l-amber-500/60" : "border-l-emerald-500/60"}`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-white/5">
                        <Icon className="w-4 h-4 text-white/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white/90">{r.titulo}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[prio].cls}`}>
                            {PRIO_STYLE[prio].label}
                          </span>
                        </div>
                        <p className="text-xs text-white/65 mt-1.5 leading-relaxed">{r.descricao}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
