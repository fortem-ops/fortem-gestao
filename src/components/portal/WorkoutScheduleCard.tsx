import { Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TreinoAgendamento } from "@/hooks/usePortalWorkout";

interface WorkoutScheduleCardProps {
  agendamentos: TreinoAgendamento[];
}

export function WorkoutScheduleCard({ agendamentos }: WorkoutScheduleCardProps) {
  if (agendamentos.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <p
          className="text-sm font-bold text-foreground"
          style={{ fontFamily: "Archivo, sans-serif" }}
        >
          Próximos agendamentos
        </p>
      </div>
      <div className="space-y-2">
        {agendamentos.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-3 rounded-xl bg-[#1A1A1A] border border-border"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">
                {format(parseISO(a.data), "EEE, dd/MM", { locale: ptBR })}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {a.horario_inicio?.slice(0, 5)} — {a.horario_fim?.slice(0, 5)}
              </p>
            </div>
            <span
              className={
                a.status === "realizado"
                  ? "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
              }
            >
              {a.status === "realizado" ? "Realizado" : "Confirmado"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
