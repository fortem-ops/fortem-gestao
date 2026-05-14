import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Coffee, CheckCircle2, CircleDashed } from "lucide-react";
import { formatHora, formatMinutes, minutesSince, type PontoEstado } from "@/lib/ponto";
import { STATUS_PONTO_LABEL, STATUS_PONTO_CLASS, type StatusPonto } from "@/lib/pontoTolerancia";

interface Props {
  status: PontoEstado;
  entrada?: string | null;
  intervaloInicio?: string | null;
  intervaloFim?: string | null;
  saida?: string | null;
  statusPonto?: StatusPonto | null;
}

const STATUS_CONFIG: Record<PontoEstado, { label: string; color: string; icon: typeof Clock }> = {
  nao_iniciado: { label: "Não iniciado", color: "bg-muted-foreground", icon: CircleDashed },
  nao_iniciou: { label: "Não iniciado", color: "bg-muted-foreground", icon: CircleDashed },
  em_jornada: { label: "Em jornada", color: "bg-success", icon: Clock },
  em_intervalo: { label: "Em intervalo", color: "bg-warning", icon: Coffee },
  encerrada: { label: "Jornada encerrada", color: "bg-muted-foreground", icon: CheckCircle2 },
};

/** Bloco visual com status atual + tempo decorrido em tempo real. */
export function StatusJornadaCard({ status, entrada, intervaloInicio, intervaloFim, saida }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  // Tempo de referência para o cronômetro
  let refLabel = "";
  let minutos = 0;
  if (status === "em_intervalo" && intervaloInicio) {
    refLabel = `Em intervalo desde ${formatHora(intervaloInicio)}`;
    minutos = minutesSince(intervaloInicio);
  } else if (status === "em_jornada" && entrada) {
    refLabel = `Em jornada desde ${formatHora(entrada)}`;
    // tempo de jornada já trabalhado descontando intervalo já fechado
    let total = minutesSince(entrada);
    if (intervaloInicio && intervaloFim) {
      const i1 = new Date(intervaloInicio).getTime();
      const i2 = new Date(intervaloFim).getTime();
      total -= Math.floor((i2 - i1) / 60000);
    }
    minutos = Math.max(0, total);
  } else if (status === "encerrada" && entrada && saida) {
    refLabel = `Encerrada às ${formatHora(saida)}`;
    let total = Math.floor((new Date(saida).getTime() - new Date(entrada).getTime()) / 60000);
    if (intervaloInicio && intervaloFim) {
      total -= Math.floor((new Date(intervaloFim).getTime() - new Date(intervaloInicio).getTime()) / 60000);
    }
    minutos = Math.max(0, total);
  } else {
    refLabel = "Aguardando início da jornada";
  }

  // tick is intentionally read for re-render
  void tick;

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.color} ${status === "em_jornada" || status === "em_intervalo" ? "animate-pulse" : ""}`} />
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
          </div>
          <p className="text-xl font-heading font-semibold">{refLabel}</p>
          {minutos > 0 && (
            <p className="text-3xl font-bold text-primary">{formatMinutes(minutos)}</p>
          )}
        </div>
        <div className="p-3 rounded-full bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
