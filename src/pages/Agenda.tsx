import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Trash2, User, CalendarIcon, CheckSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AddAgendaDialog } from "@/components/agenda/AddAgendaDialog";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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

const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HORAS = Array.from({ length: 16 }, (_, i) => i + 6);

const ATIVIDADE_COLORS: Record<string, string> = {
  "Nutrição": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Reabilitação": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Avaliação Funcional": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Avaliação Física": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Recovery (Bota de Compressão)": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "Treino Experimental": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function Agenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; date: Date; tipo: string } | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [prefill, setPrefill] = useState<{ date: Date; hour: number } | null>(null);
  const [editEvent, setEditEvent] = useState<any>(null);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { data: excecoes = [] } = useQuery({
    queryKey: ["agenda_servicos_excecoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_servicos_excecoes")
        .select("agenda_id, data_excecao");
      if (error) throw error;
      return data as { agenda_id: string; data_excecao: string }[];
    },
  });

  const excecoesSet = useMemo(
    () => new Set(excecoes.map((e) => `${e.agenda_id}|${e.data_excecao}`)),
    [excecoes]
  );

  const { data: agendas = [], isLoading } = useQuery({
    queryKey: ["agenda_servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_servicos")
        .select("id, dia_semana, data_especifica, tipo, horario_inicio, horario_fim, atividade, local, observacoes, profissional_id, consultor_id, aluno_id")
        .order("horario_inicio");
      if (error) throw error;

      const profIds = [...new Set(data.map((d: any) => d.profissional_id).filter(Boolean))];
      const alunoIds = [...new Set(data.map((d: any) => d.aluno_id).filter(Boolean))];

      let profilesMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", profIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name]));
        }
      }

      let alunosMap: Record<string, string> = {};
      if (alunoIds.length > 0) {
        const { data: alunos } = await supabase
          .from("alunos")
          .select("id, nome")
          .in("id", alunoIds);
        if (alunos) {
          alunosMap = Object.fromEntries(alunos.map((a: any) => [a.id, a.nome]));
        }
      }

      return data.map((d: any) => ({
        ...d,
        profissional_nome: profilesMap[d.profissional_id] || null,
        aluno_nome: d.aluno_id ? alunosMap[d.aluno_id] || null : null,
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const ev = agendas.find((a: any) => a.id === id);
      const { error } = await supabase.from("agenda_servicos").delete().eq("id", id);
      if (error) throw error;
      return ev;
    },
    onSuccess: (ev: any) => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos_excecoes"] });
      toast.success("Horário removido");

      // Fallback de notificação de cancelamento (idempotente no servidor)
      if (ev?.id && ev.aluno_id &&
          ["Treino Experimental","Avaliação Funcional"].includes(ev.atividade)) {
        supabase.functions.invoke("notify-agenda-evento", {
          body: { evento: "cancelado", agenda_id: ev.id, agenda: ev, origem: "frontend" },
        }).catch((e) => console.error("notify-agenda-evento (delete):", e));
      }

      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover horário"),
  });

  const excecaoMutation = useMutation({
    mutationFn: async ({ agenda_id, data }: { agenda_id: string; data: Date }) => {
      const dataStr = format(data, "yyyy-MM-dd");
      const { error } = await supabase
        .from("agenda_servicos_excecoes")
        .insert({ agenda_id, data_excecao: dataStr });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos_excecoes"] });
      toast.success("Dia removido da recorrência");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover este dia"),
  });

  const getEventsForCell = (dayIndex: number, hour: number) => {
    const date = weekDates[dayIndex];
    const diaSemana = date.getDay();

    return agendas.filter((a: any) => {
      const startHour = parseInt(a.horario_inicio?.split(":")[0] || "0");
      if (startHour !== hour) return false;

      if (a.tipo === "fixo") {
        if (a.dia_semana !== diaSemana) return false;
        const key = `${a.id}|${format(date, "yyyy-MM-dd")}`;
        return !excecoesSet.has(key);
      } else {
        return a.data_especifica && isSameDay(new Date(a.data_especifica + "T12:00:00"), date);
      }
    });
  };

  const handleCellClick = (dayIndex: number, hour: number) => {
    setEditEvent(null);
    setPrefill({ date: weekDates[dayIndex], hour });
    setDialogOpen(true);
  };

  const handleEventClick = (ev: any) => {
    setEditEvent(ev);
    setPrefill(null);
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setPrefill(null); setEditEvent(null); }
  };

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Agenda de Serviços</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Gerencie os horários das atividades</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/presencas"><CheckSquare className="h-4 w-4" /> <span className="hidden sm:inline">Lista de Presença</span></Link>
          </Button>
          <Button size="sm" onClick={() => { setPrefill(null); setEditEvent(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Horário</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", !weekStart && "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Ir para data</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={weekStart}
              onSelect={(date) => {
                if (date) setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2 w-full sm:w-auto">
          {format(weekDates[0], "dd MMM", { locale: ptBR })} — {format(weekDates[6], "dd MMM yyyy", { locale: ptBR })}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <ScrollArea className="h-[calc(100vh-240px)]">
          <div className="min-w-[900px]">
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
                      className={`border-l border-border/50 p-0.5 cursor-pointer hover:bg-muted/30 transition-colors ${isToday ? "bg-primary/5" : ""}`}
                      onClick={() => handleCellClick(dayIdx, hour)}
                    >
                      {events.map((ev: any) => (
                        <div
                          key={ev.id}
                          className={`rounded p-1.5 mb-0.5 text-xs border group relative ${ATIVIDADE_COLORS[ev.atividade] || "bg-muted text-foreground border-border"}`}
                          onClick={(e) => { e.stopPropagation(); handleEventClick(ev); }}
                        >
                          <div className="font-medium truncate">{ev.atividade}</div>
                          <div className="truncate opacity-75">{ev.local}</div>
                          <div className="truncate opacity-60">
                            {ev.horario_inicio?.slice(0, 5)} - {ev.horario_fim?.slice(0, 5)}
                          </div>
                          {ev.aluno_nome && (
                            <div className="truncate opacity-80 flex items-center gap-1 mt-0.5">
                              <User className="h-2.5 w-2.5" />
                              {ev.aluno_nome}
                            </div>
                          )}
                          {ev.profissional_nome && (
                            <div className="truncate opacity-60">{ev.profissional_nome}</div>
                          )}
                          {ev.tipo === "avulso" && (
                            <Badge variant="outline" className="mt-0.5 text-[10px] px-1 py-0">Avulso</Badge>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: ev.id, date: weekDates[dayIdx], tipo: ev.tipo }); }}
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

      <AddAgendaDialog open={dialogOpen} onOpenChange={handleOpenChange} prefill={prefill} editEvent={editEvent} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover horário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.tipo === "fixo"
                ? `Este é um horário fixo recorrente. Você pode remover apenas o dia ${deleteTarget ? format(deleteTarget.date, "dd/MM/yyyy", { locale: ptBR }) : ""} ou toda a recorrência.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleteTarget?.tipo === "fixo" && (
              <Button
                variant="outline"
                onClick={() => deleteTarget && excecaoMutation.mutate({ agenda_id: deleteTarget.id, data: deleteTarget.date })}
                disabled={excecaoMutation.isPending}
              >
                Somente este dia
              </Button>
            )}
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteTarget?.tipo === "fixo" ? "Toda a recorrência" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
