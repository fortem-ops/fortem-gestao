import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAvaliacaoFuncional } from "@/lib/query-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Trash2, User, CalendarIcon, CheckSquare, EyeOff, X } from "lucide-react";
import { MultiSelectFilter } from "@/components/student/MultiSelectFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
// Faixas de 30 min: 06:00 até 21:30 (em minutos desde meia-noite)
const SLOTS = Array.from({ length: 32 }, (_, i) => 6 * 60 + i * 30);
const slotLabel = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Cor de destaque por atividade (barra lateral / ponto). O texto sempre usa
// tokens de alto contraste para garantir legibilidade.
const ATIVIDADE_ACCENT: Record<string, string> = {
  "Nutrição": "bg-blue-500",
  "Reabilitação": "bg-purple-500",
  "Avaliação Funcional": "bg-emerald-500",
  "Avaliação Física": "bg-amber-500",
  "Recovery (Bota de Compressão)": "bg-rose-500",
  "Treino Experimental": "bg-cyan-500",
};

const accentDe = (atividade: string) => ATIVIDADE_ACCENT[atividade] || "bg-muted-foreground";

export default function Agenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; date: Date; tipo: string } | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"dia" | "semana" | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => (new Date().getDay() + 6) % 7);
  const isWeek = (viewMode ?? (isMobile ? "dia" : "semana")) === "semana";
  const dayIdxs = isWeek ? [0, 1, 2, 3, 4, 5, 6] : [selectedDayIdx];

  const [prefill, setPrefill] = useState<{ date: Date; hour: number; minute?: number } | null>(null);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [cellDate, setCellDate] = useState<Date | null>(null);
  const [fAtividade, setFAtividade] = useState<string[]>([]);
  const [fProfissional, setFProfissional] = useState<string[]>([]);
  const [fAluno, setFAluno] = useState<string[]>([]);
  const [fOcupacao, setFOcupacao] = useState<"todos" | "livre" | "ocupado">("todos");

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
        .select("id, dia_semana, data_especifica, tipo, horario_inicio, horario_fim, atividade, local, observacoes, profissional_id, consultor_id, aluno_id, visivel_portal")
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

  type DeleteModo = "padrao" | "somente_dia" | "liberar_vaga" | "futuras";

  const buscarModelosFixos = async (ev: any) => {
    const diaSemana = new Date(ev.data_especifica + "T12:00:00").getDay();
    const { data } = await supabase
      .from("agenda_servicos")
      .select("id")
      .eq("tipo", "fixo")
      .eq("dia_semana", diaSemana)
      .eq("horario_inicio", ev.horario_inicio)
      .eq("atividade", ev.atividade)
      .eq("local", ev.local);
    return (data || []).map((m: any) => m.id);
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, modo = "padrao" }: { id: string; modo?: DeleteModo }) => {
      const ev = agendas.find((a: any) => a.id === id);

      // Dispara WhatsApp ANTES do delete (enquanto o registro ainda existe no banco)
      if (ev?.id) {
        try {
          await supabase.functions.invoke("whatsapp-disparo-agenda", {
            body: { evento: "agendamento_cancelado", agenda_id: ev.id },
          });
        } catch (e) {
          console.error("[WhatsApp Disparo cancelado] erro:", e);
        }
      }

      const { error } = await supabase.from("agenda_servicos").delete().eq("id", id);
      if (error) throw error;

      if (ev?.tipo === "avulso" && ev?.data_especifica) {
        const ids = await buscarModelosFixos(ev);

        // Devolve a vaga fixa à grade naquele dia (remove a exceção)
        if ((modo === "padrao" || modo === "liberar_vaga") && ids.length > 0) {
          await supabase
            .from("agenda_servicos_excecoes")
            .delete()
            .in("agenda_id", ids)
            .eq("data_excecao", ev.data_especifica);
        }

        // Encerra a vaga fixa daqui pra frente
        if (modo === "futuras" && ids.length > 0) {
          await supabase
            .from("agenda_servicos")
            .delete()
            .eq("tipo", "avulso")
            .eq("atividade", ev.atividade)
            .eq("local", ev.local)
            .eq("horario_inicio", ev.horario_inicio)
            .gt("data_especifica", ev.data_especifica);
          await supabase.from("agenda_servicos").delete().in("id", ids);
        }
        // modo === "somente_dia": mantém a exceção, vaga não reaparece nesse dia
      }
      return ev;
    },

    onSuccess: (ev: any) => {
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos"] });
      queryClient.invalidateQueries({ queryKey: ["agenda_servicos_excecoes"] });
      if (ev?.atividade === "Avaliação Funcional") {
        invalidateAvaliacaoFuncional(queryClient, ev?.aluno_id ?? undefined);
      }
      toast.success("Horário removido");

      // Email para todas as atividades com aluno vinculado
      if (ev?.id && ev.aluno_id) {
        supabase.functions.invoke("notify-agenda-evento", {
          body: { evento: "cancelado", agenda_id: ev.id, agenda: ev, origem: "frontend" },
        }).catch((e) => console.error("notify-agenda-evento (cancelado):", e));
      }

      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover horário"),
  });

  // Reserva avulsa que ocupa uma vaga de horário fixo
  const deleteTargetVagaFixa = useMemo(() => {
    if (!deleteTarget) return false;
    const ev = (agendas as any[]).find((a: any) => a.id === deleteTarget.id);
    if (!ev || ev.tipo !== "avulso" || !ev.data_especifica) return false;
    const diaSemana = new Date(ev.data_especifica + "T12:00:00").getDay();
    return (agendas as any[]).some(
      (a: any) =>
        a.tipo === "fixo" &&
        a.dia_semana === diaSemana &&
        a.horario_inicio === ev.horario_inicio &&
        a.atividade === ev.atividade &&
        a.local === ev.local,
    );
  }, [deleteTarget, agendas]);




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

  // Opções dos filtros derivadas dos dados carregados
  const opcoesAtividade = useMemo(() => {
    const s = new Set<string>(agendas.map((a: any) => a.atividade).filter(Boolean));
    return [...s].sort().map((v) => ({ value: v, label: v }));
  }, [agendas]);

  const { data: profissionaisTodos = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"]);
      const ids = [...new Set((roles || []).map((r: any) => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids)
        .order("full_name");
      return profs || [];
    },
    staleTime: 5 * 60_000,
  });

  const opcoesProfissional = useMemo(() => {
    const m = new Map<string, string>();
    (profissionaisTodos as any[]).forEach((p) => {
      if (p.user_id && p.full_name) m.set(p.user_id, p.full_name);
    });
    agendas.forEach((a: any) => {
      if (a.profissional_id && a.profissional_nome) m.set(a.profissional_id, a.profissional_nome);
    });
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label));
  }, [agendas, profissionaisTodos]);


  const opcoesAluno = useMemo(() => {
    const m = new Map<string, string>();
    agendas.forEach((a: any) => {
      if (a.aluno_id && a.aluno_nome) m.set(a.aluno_id, a.aluno_nome);
    });
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label));
  }, [agendas]);

  const temFiltro = fAtividade.length > 0 || fProfissional.length > 0 || fAluno.length > 0 || fOcupacao !== "todos";
  const limparFiltros = () => { setFAtividade([]); setFProfissional([]); setFAluno([]); setFOcupacao("todos"); };

  const getEventsForCell = (dayIndex: number, slot: number) => {
    const date = weekDates[dayIndex];
    const diaSemana = date.getDay();
    const dateStr = format(date, "yyyy-MM-dd");

    // Reservas já feitas nesse dia (usadas para ocultar a vaga-modelo correspondente)
    const reservasDoDia = agendas.filter(
      (a: any) => a.aluno_id && a.data_especifica === dateStr,
    );

    return agendas.filter((a: any) => {
      const [hh, mm] = (a.horario_inicio || "00:00").split(":");
      const startMin = parseInt(hh || "0") * 60 + parseInt(mm || "0");
      if (Math.floor(startMin / 30) * 30 !== slot) return false;


      if (fAtividade.length > 0 && !fAtividade.includes(a.atividade)) return false;
      if (fProfissional.length > 0 && !fProfissional.includes(a.profissional_id)) return false;
      if (fAluno.length > 0 && !fAluno.includes(a.aluno_id)) return false;
      if (fOcupacao === "livre" && a.aluno_id) return false;
      if (fOcupacao === "ocupado" && !a.aluno_id) return false;

      if (a.tipo === "fixo") {
        if (a.dia_semana !== diaSemana) return false;
        const key = `${a.id}|${dateStr}`;
        if (excecoesSet.has(key)) return false;
        // Vaga-modelo já reservada por um aluno neste dia/hora/profissional
        if (
          !a.aluno_id &&
          reservasDoDia.some(
            (r: any) =>
              r.profissional_id === a.profissional_id &&
              r.horario_inicio === a.horario_inicio &&
              r.atividade === a.atividade,
          )
        ) {
          return false;
        }
        return true;
      } else {
        return a.data_especifica && isSameDay(new Date(a.data_especifica + "T12:00:00"), date);
      }
    });
  };


  const handleCellClick = (dayIndex: number, slot: number) => {
    setEditEvent(null);
    setPrefill({ date: weekDates[dayIndex], hour: Math.floor(slot / 60), minute: slot % 60 });
    setDialogOpen(true);
  };

  const handleEventClick = (ev: any, date: Date) => {
    setEditEvent(ev);
    setCellDate(date);
    setPrefill(null);
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setPrefill(null); setEditEvent(null); setCellDate(null); }
  };

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setSelectedDayIdx((new Date().getDay() + 6) % 7);
  };
  const prevDay = () => {
    if (selectedDayIdx > 0) setSelectedDayIdx(selectedDayIdx - 1);
    else { setWeekStart(addDays(weekStart, -7)); setSelectedDayIdx(6); }
  };
  const nextDay = () => {
    if (selectedDayIdx < 6) setSelectedDayIdx(selectedDayIdx + 1);
    else { setWeekStart(addDays(weekStart, 7)); setSelectedDayIdx(0); }
  };


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
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("dia")}
            className={cn("px-3 h-9 text-xs font-semibold", !isWeek ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
          >
            Dia
          </button>
          <button
            onClick={() => setViewMode("semana")}
            className={cn("px-3 h-9 text-xs font-semibold border-l border-border", isWeek ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
          >
            Semana
          </button>
        </div>

        <Button variant="outline" size="icon" onClick={isWeek ? prevWeek : prevDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={isWeek ? nextWeek : nextDay}>
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
                if (date) {
                  setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
                  setSelectedDayIdx((date.getDay() + 6) % 7);
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2 w-full sm:w-auto">
          {isWeek
            ? `${format(weekDates[0], "dd MMM", { locale: ptBR })} — ${format(weekDates[6], "dd MMM yyyy", { locale: ptBR })}`
            : format(weekDates[selectedDayIdx], "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
        </span>
      </div>


      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Atividade</span>
            <MultiSelectFilter
              options={opcoesAtividade}
              value={fAtividade}
              onChange={setFAtividade}
              placeholderAll="Todas as atividades"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Profissional</span>
            <MultiSelectFilter
              options={opcoesProfissional}
              value={fProfissional}
              onChange={setFProfissional}
              placeholderAll="Todos os profissionais"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Aluno</span>
            <MultiSelectFilter
              options={opcoesAluno}
              value={fAluno}
              onChange={setFAluno}
              placeholderAll="Todos os alunos"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Ocupação</span>
            <Select value={fOcupacao} onValueChange={(v) => setFOcupacao(v as any)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos os horários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os horários</SelectItem>
                <SelectItem value="livre">Somente livres</SelectItem>
                <SelectItem value="ocupado">Somente ocupados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {opcoesAtividade.map((o) => (
            <span key={o.value} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", accentDe(o.value))} />
              {o.label}
            </span>
          ))}
          {temFiltro && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={limparFiltros}>
              <X className="h-3 w-3" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <ScrollArea className="h-[calc(100vh-240px)]">
          <div className={cn(isWeek && "min-w-[900px]")}>
            <div
              className="grid border-b border-border sticky top-0 bg-card z-10"
              style={{ gridTemplateColumns: `70px repeat(${dayIdxs.length}, minmax(0,1fr))` }}
            >
              <div className="p-2 text-xs text-muted-foreground text-center">Hora</div>
              {dayIdxs.map((dayIdx) => {
                const date = weekDates[dayIdx];
                const isToday = isSameDay(date, new Date());
                return (
                  <div key={dayIdx} className={`p-2 text-center border-l border-border ${isToday ? "bg-primary/10" : ""}`}>
                    <div className="text-xs text-muted-foreground">
                      {isWeek ? DIAS_CURTO[date.getDay()] : format(date, "EEEE", { locale: ptBR })}
                    </div>
                    <div className={`text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                      {isWeek ? format(date, "dd") : format(date, "dd 'de' MMMM", { locale: ptBR })}
                    </div>
                  </div>
                );
              })}
            </div>

            {SLOTS.map((slot) => (
              <div
                key={slot}
                className="grid border-b border-border/50 min-h-[44px]"
                style={{ gridTemplateColumns: `70px repeat(${dayIdxs.length}, minmax(0,1fr))` }}
              >
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                  {slotLabel(slot)}
                </div>
                {dayIdxs.map((dayIdx) => {
                  const events = getEventsForCell(dayIdx, slot);
                  const isToday = isSameDay(weekDates[dayIdx], new Date());
                  return (
                    <div
                      key={dayIdx}
                      className={`border-l border-border/50 p-0.5 cursor-pointer hover:bg-muted/30 transition-colors overflow-hidden min-w-0 ${isToday ? "bg-primary/5" : ""}`}
                      onClick={() => handleCellClick(dayIdx, slot)}
                    >

                      {events.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="rounded-md mb-0.5 text-xs border border-border bg-card hover:bg-muted/50 transition-colors group relative overflow-hidden flex"
                          onClick={(e) => { e.stopPropagation(); handleEventClick(ev, weekDates[dayIdx]); }}
                        >
                          <span className={cn("w-1 shrink-0", accentDe(ev.atividade))} />
                          <div className="p-1.5 min-w-0 flex-1">
                            <div className="font-semibold text-foreground truncate">{ev.atividade}</div>
                            <div className="truncate text-foreground/90">
                              {ev.horario_inicio?.slice(0, 5)} - {ev.horario_fim?.slice(0, 5)}
                            </div>
                            <div className="truncate text-muted-foreground">{ev.local}</div>
                            {ev.aluno_nome && (
                              <div className="truncate text-foreground flex items-center gap-1 mt-0.5">
                                <User className="h-2.5 w-2.5 shrink-0" />
                                {ev.aluno_nome}
                              </div>
                            )}
                            {ev.profissional_nome && (
                              <div className="truncate text-muted-foreground">{ev.profissional_nome}</div>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                              {ev.tipo === "avulso" && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">Avulso</Badge>
                              )}
                              {!ev.aluno_id && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/50 text-primary">Livre</Badge>
                              )}
                              {!ev.visivel_portal && (
                                <EyeOff className="h-3 w-3 text-muted-foreground" aria-label="Oculto no app do aluno" />
                              )}
                            </div>
                          </div>

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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>


      <AddAgendaDialog open={dialogOpen} onOpenChange={handleOpenChange} prefill={prefill} editEvent={editEvent} cellDate={cellDate} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover horário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.tipo === "fixo"
                ? `Este é um horário fixo recorrente. Você pode remover apenas o dia ${deleteTarget ? format(deleteTarget.date, "dd/MM/yyyy", { locale: ptBR }) : ""} ou toda a recorrência.`
                : deleteTargetVagaFixa
                  ? "Este agendamento ocupa uma vaga de horário fixo. Escolha o que deseja fazer."
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
            {deleteTargetVagaFixa && (
              <>
                <Button
                  variant="outline"
                  onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, modo: "liberar_vaga" })}
                  disabled={deleteMutation.isPending}
                >
                  Remover só o aluno
                </Button>
                <Button
                  variant="outline"
                  onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, modo: "somente_dia" })}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar só este dia
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, modo: "futuras" })}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar todas as futuras
                </Button>
              </>
            )}
            {!deleteTargetVagaFixa && (
              <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}>
                {deleteTarget?.tipo === "fixo" ? "Toda a recorrência" : "Remover"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
