import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AddAgendaDialog } from "@/components/agenda/AddAgendaDialog";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HORAS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00 to 21:00

const ATIVIDADE_COLORS: Record<string, string> = {
  "Nutrição": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Reabilitação": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Avaliação Funcional": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Avaliação Física": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Recovery (Bota de Compressão)": "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function Agenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { data: agendas = [], isLoading } = useQuery({
    queryKey: ["agenda_servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_servicos")
        .select("*, profiles:profissional_id(full_name)")
        .order("horario_inicio");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      toast.success("Horário removido");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover horário"),
  });

  const getEventsForCell = (dayIndex: number, hour: number) => {
    // dayIndex: 0=segunda(weekDates[0]) ... 6=domingo(weekDates[6])
    const date = weekDates[dayIndex];
    const diaSemana = date.getDay(); // 0=dom, 1=seg...

    return agendas.filter((a: any) => {
      const startHour = parseInt(a.horario_inicio?.split(":")[0] || "0");
      if (startHour !== hour) return false;

      if (a.tipo === "fixo") {
        return a.dia_semana === diaSemana;
      } else {
        // avulso - check specific date
        return a.data_especifica && isSameDay(new Date(a.data_especifica + "T12:00:00"), date);
      }
    });
  };

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Agenda de Serviços</h1>
          <p className="text-muted-foreground text-sm">Gerencie os horários das atividades</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Horário
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground ml-2">
          {format(weekDates[0], "dd MMM", { locale: ptBR })} — {format(weekDates[6], "dd MMM yyyy", { locale: ptBR })}
        </span>
      </div>

      {/* Weekly grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <ScrollArea className="h-[calc(100vh-240px)]">
          <div className="min-w-[900px]">
            {/* Header */}
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border sticky top-0 bg-card z-10">
              <div className="p-2 text-xs text-muted-foreground text-center">Hora</div>
              {weekDates.map((date, i) => {
                const isToday = isSameDay(date, new Date());
                return (
                  <div key={i} className={`p-2 text-center border-l border-border ${isToday ? "bg-primary/10" : ""}`}>
                    <div className="text-xs text-muted-foreground">{DIAS_CURTO[date.getDay()]}</div>
                    <div className={`text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                      {format(date, "dd")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            {HORAS.map((hour) => (
              <div key={hour} className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border/50 min-h-[60px]">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDates.map((_, dayIdx) => {
                  const events = getEventsForCell(dayIdx, hour);
                  const isToday = isSameDay(weekDates[dayIdx], new Date());
                  return (
                    <div
                      key={dayIdx}
                      className={`border-l border-border/50 p-0.5 ${isToday ? "bg-primary/5" : ""}`}
                    >
                      {events.map((ev: any) => (
                        <div
                          key={ev.id}
                          className={`rounded p-1.5 mb-0.5 text-xs border cursor-pointer group relative ${ATIVIDADE_COLORS[ev.atividade] || "bg-muted text-foreground border-border"}`}
                        >
                          <div className="font-medium truncate">{ev.atividade}</div>
                          <div className="truncate opacity-75">{ev.local}</div>
                          <div className="truncate opacity-60">
                            {ev.horario_inicio?.slice(0, 5)} - {ev.horario_fim?.slice(0, 5)}
                          </div>
                          {ev.profiles?.full_name && (
                            <div className="truncate opacity-60">{ev.profiles.full_name}</div>
                          )}
                          {ev.tipo === "avulso" && (
                            <Badge variant="outline" className="mt-0.5 text-[10px] px-1 py-0">Avulso</Badge>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(ev.id); }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <AddAgendaDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover horário?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
