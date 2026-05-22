import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarIcon, Check, X, RotateCcw, User, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  subDays,
  addDays,
  getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ViewMode = "dia" | "semana" | "mes";

type AgendaRow = {
  id: string;
  tipo: string;
  atividade: string;
  local: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  data_especifica: string | null;
  profissional_id: string;
  aluno_id: string | null;
  profissional_nome?: string | null;
  aluno_nome?: string | null;
};

type PresencaRow = {
  agenda_id: string;
  data: string;
  comparecimento: boolean;
};

export default function Presencas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("dia");
  const [profFilter, setProfFilter] = useState<string>("me");
  const [expandedWeekDays, setExpandedWeekDays] = useState<Set<string>>(new Set());

  const isCoordAdminQuery = useQuery({
    queryKey: ["is-coord-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const isCoordAdmin = isCoordAdminQuery.data;

  // ---- range helpers ----
  const weekStart = startOfWeek(date, { locale: ptBR });
  const weekEnd = endOfWeek(date, { locale: ptBR });
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  const currentRangeLabel = useMemo(() => {
    if (viewMode === "dia") return format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "semana") {
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      if (sameMonth) return `${format(weekStart, "dd")} – ${format(weekEnd, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
      return `${format(weekStart, "dd/MM")} – ${format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}`;
    }
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  }, [viewMode, date, weekStart, weekEnd]);

  // ---- data fetchers ----
  const { data: aulas = [], isLoading: isLoadingAulas } = useQuery({
    queryKey: ["presencas-aulas", viewMode, date.toISOString(), isCoordAdmin, user?.id, profFilter],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("agenda_servicos")
        .select("id, tipo, atividade, local, dia_semana, horario_inicio, horario_fim, data_especifica, profissional_id, aluno_id")
        .order("horario_inicio");

      if (!isCoordAdmin || profFilter === "me") {
        query = query.eq("profissional_id", user!.id);
      }

      // filter by view range
      if (viewMode === "dia") {
        const d = format(date, "yyyy-MM-dd");
        const ds = date.getDay();
        query = query.or(`and(tipo.eq.fixo,dia_semana.eq.${ds}),and(tipo.eq.avulso,data_especifica.eq.${d})`);
      } else if (viewMode === "semana") {
        const start = format(weekStart, "yyyy-MM-dd");
        const end = format(weekEnd, "yyyy-MM-dd");
        const dias = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((d) => d.getDay());
        const diaSet = [...new Set(dias)].join(",");
        query = query.or(`and(tipo.eq.fixo,dia_semana.in.(${diaSet})),and(tipo.eq.avulso,data_especifica.gte.${start},data_especifica.lte.${end})`);
      } else {
        const start = format(monthStart, "yyyy-MM-dd");
        const end = format(monthEnd, "yyyy-MM-dd");
        const dias = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((d) => d.getDay());
        const diaSet = [...new Set(dias)].join(",");
        query = query.or(`and(tipo.eq.fixo,dia_semana.in.(${diaSet})),and(tipo.eq.avulso,data_especifica.gte.${start},data_especifica.lte.${end})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as AgendaRow[];

      const profIds = [...new Set(rows.map((r) => r.profissional_id).filter(Boolean))];
      const alunoIds = [...new Set(rows.map((r) => r.aluno_id).filter(Boolean))] as string[];

      const [profilesRes, alunosRes] = await Promise.all([
        profIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", profIds)
          : Promise.resolve({ data: [] as any[] }),
        alunoIds.length
          ? supabase.from("alunos").select("id, nome").in("id", alunoIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = Object.fromEntries((profilesRes.data ?? []).map((p: any) => [p.user_id, p.full_name]));
      const aluMap = Object.fromEntries((alunosRes.data ?? []).map((a: any) => [a.id, a.nome]));

      return rows.map((r) => ({
        ...r,
        profissional_nome: profMap[r.profissional_id] ?? null,
        aluno_nome: r.aluno_id ? aluMap[r.aluno_id] ?? null : null,
      }));
    },
  });

  const agendaIds = aulas.map((a) => a.id);

  const { data: presencas = [] } = useQuery({
    queryKey: ["presencas", viewMode, date.toISOString(), agendaIds],
    enabled: agendaIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("agenda_presencas")
        .select("agenda_id, data, comparecimento")
        .in("agenda_id", agendaIds);

      if (viewMode === "dia") {
        query = query.eq("data", format(date, "yyyy-MM-dd"));
      } else if (viewMode === "semana") {
        const start = format(weekStart, "yyyy-MM-dd");
        const end = format(weekEnd, "yyyy-MM-dd");
        query = query.gte("data", start).lte("data", end);
      } else {
        const start = format(monthStart, "yyyy-MM-dd");
        const end = format(monthEnd, "yyyy-MM-dd");
        query = query.gte("data", start).lte("data", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PresencaRow[];
    },
  });

  const presencaMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    presencas.forEach((p) => {
      m[`${p.agenda_id}|${p.data}`] = p.comparecimento;
    });
    return m;
  }, [presencas]);

  const markMutation = useSupabaseMutation<unknown, { agendaId: string; value: boolean | null; dataStr: string }>({
    mutationFn: async ({ agendaId, value, dataStr }) => {
      if (value === null) {
        const { error } = await supabase
          .from("agenda_presencas")
          .delete()
          .eq("agenda_id", agendaId)
          .eq("data", dataStr);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from("agenda_presencas")
        .upsert(
          {
            agenda_id: agendaId,
            data: dataStr,
            comparecimento: value,
            marcado_por: user!.id,
          },
          { onConflict: "agenda_id,data" },
        );
      if (error) throw error;
      return null;
    },
    invalidates: [["presencas"], ["rel-servicos"]],
    errorTitle: "Erro ao marcar presença",
  });

  // ---- day view helpers ----
  const dateStr = format(date, "yyyy-MM-dd");
  const diaSemana = date.getDay();

  const aulasDoDia = useMemo(() => {
    if (viewMode !== "dia") return [];
    return aulas.filter((a) => {
      if (a.tipo === "avulso") return a.data_especifica === dateStr;
      return a.dia_semana === diaSemana;
    });
  }, [aulas, viewMode, dateStr, diaSemana]);

  const gruposDia = useMemo(() => {
    const map = new Map<string, AgendaRow[]>();
    aulasDoDia.forEach((a) => {
      const key = a.horario_inicio.slice(0, 5);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [aulasDoDia]);

  const totaisDia = useMemo(() => {
    const total = aulasDoDia.length;
    const marcadas = aulasDoDia.filter((a) => `${a.id}|${dateStr}` in presencaMap).length;
    const presentes = aulasDoDia.filter((a) => presencaMap[`${a.id}|${dateStr}`] === true).length;
    const faltas = aulasDoDia.filter((a) => presencaMap[`${a.id}|${dateStr}`] === false).length;
    return { total, marcadas, presentes, faltas };
  }, [aulasDoDia, presencaMap, dateStr]);

  // ---- week view helpers ----
  const weekDays = useMemo(() => {
    if (viewMode !== "semana") return [];
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [viewMode, weekStart, weekEnd]);

  const weekDayStats = useMemo(() => {
    if (viewMode !== "semana") return [];
    return weekDays.map((d) => {
      const ds = d.getDay();
      const dStr = format(d, "yyyy-MM-dd");
      const dayAulas = aulas.filter((a) => {
        if (a.tipo === "avulso") return a.data_especifica === dStr;
        return a.dia_semana === ds;
      });
      const marcadas = dayAulas.filter((a) => `${a.id}|${dStr}` in presencaMap).length;
      const presentes = dayAulas.filter((a) => presencaMap[`${a.id}|${dStr}`] === true).length;
      const faltas = dayAulas.filter((a) => presencaMap[`${a.id}|${dStr}`] === false).length;
      return {
        date: d,
        dateStr: dStr,
        aulas: dayAulas,
        total: dayAulas.length,
        marcadas,
        presentes,
        faltas,
      };
    });
  }, [viewMode, weekDays, aulas, presencaMap]);

  const toggleExpandWeekDay = (dStr: string) => {
    setExpandedWeekDays((prev) => {
      const next = new Set(prev);
      if (next.has(dStr)) next.delete(dStr);
      else next.add(dStr);
      return next;
    });
  };

  // ---- month view helpers ----
  const monthGridDays = useMemo(() => {
    if (viewMode !== "mes") return [];
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMode, monthStart, monthEnd]);

  const monthDayStats = useMemo(() => {
    if (viewMode !== "mes") return new Map<string, { total: number; marcadas: number; presentes: number; faltas: number }>();
    const map = new Map<string, { total: number; marcadas: number; presentes: number; faltas: number }>();
    monthGridDays.forEach((d) => {
      const ds = d.getDay();
      const dStr = format(d, "yyyy-MM-dd");
      const dayAulas = aulas.filter((a) => {
        if (a.tipo === "avulso") return a.data_especifica === dStr;
        return a.dia_semana === ds;
      });
      const marcadas = dayAulas.filter((a) => `${a.id}|${dStr}` in presencaMap).length;
      const presentes = dayAulas.filter((a) => presencaMap[`${a.id}|${dStr}`] === true).length;
      const faltas = dayAulas.filter((a) => presencaMap[`${a.id}|${dStr}`] === false).length;
      map.set(dStr, { total: dayAulas.length, marcadas, presentes, faltas });
    });
    return map;
  }, [viewMode, monthGridDays, aulas, presencaMap]);

  // ---- navigation ----
  const goPrev = () => {
    if (viewMode === "dia") setDate((d) => subDays(d, 1));
    else if (viewMode === "semana") setDate((d) => subWeeks(d, 1));
    else setDate((d) => subMonths(d, 1));
  };

  const goNext = () => {
    if (viewMode === "dia") setDate((d) => addDays(d, 1));
    else if (viewMode === "semana") setDate((d) => addWeeks(d, 1));
    else setDate((d) => addMonths(d, 1));
  };

  const goToday = () => setDate(new Date());

  const isLoading = isLoadingAulas;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Lista de Presença</h1>
          <p className="text-muted-foreground text-sm">
            {viewMode === "dia" && "Marque presença ou falta das aulas do dia"}
            {viewMode === "semana" && "Visualize e marque presenças da semana"}
            {viewMode === "mes" && "Resumo mensal de presenças — clique em um dia para detalhar"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCoordAdmin && (
            <Select value={profFilter} onValueChange={setProfFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Minhas aulas</SelectItem>
                <SelectItem value="all">Todos os profissionais</SelectItem>
              </SelectContent>
            </Select>
          )}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            className="border rounded-md p-0.5"
          >
            <ToggleGroupItem value="dia" className="text-xs px-3 py-1.5 h-auto data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Dia
            </ToggleGroupItem>
            <ToggleGroupItem value="semana" className="text-xs px-3 py-1.5 h-auto data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem value="mes" className="text-xs px-3 py-1.5 h-auto data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Mês
            </ToggleGroupItem>
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{currentRangeLabel}</span>
                <span className="sm:hidden">{format(date, "dd/MM/yy")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Navigation arrows for week/month */}
      {(viewMode === "semana" || viewMode === "mes") && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={goNext} className="gap-1">
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      {/* ===== DIA ===== */}
      {viewMode === "dia" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total" value={totaisDia.total} />
            <StatCard label="Marcadas" value={`${totaisDia.marcadas}/${totaisDia.total}`} tone="info" />
            <StatCard label="Presentes" value={totaisDia.presentes} tone="success" />
            <StatCard label="Faltas" value={totaisDia.faltas} tone="danger" />
          </div>

          {aulasDoDia.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma aula encontrada nesta data.
              </CardContent>
            </Card>
          )}

          {gruposDia.map(([hora, items]) => (
            <Card key={hora} className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{hora}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((aula) => {
                  const status = presencaMap[`${aula.id}|${dateStr}`];
                  const isPresent = status === true;
                  const isAbsent = status === false;
                  return (
                    <AulaRow
                      key={aula.id}
                      aula={aula}
                      isPresent={isPresent}
                      isAbsent={isAbsent}
                      dateStr={dateStr}
                      profFilter={profFilter}
                      onMark={(value) => markMutation.mutate({ agendaId: aula.id, value, dataStr: dateStr })}
                      isPending={markMutation.isPending}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* ===== SEMANA ===== */}
      {viewMode === "semana" && (
        <div className="space-y-3">
          {weekDayStats.map((dayStat) => (
            <WeekDayCard
              key={dayStat.dateStr}
              dayStat={dayStat}
              isExpanded={expandedWeekDays.has(dayStat.dateStr)}
              onToggleExpand={() => toggleExpandWeekDay(dayStat.dateStr)}
              presencaMap={presencaMap}
              profFilter={profFilter}
              onMark={(agendaId, value, dataStr) => markMutation.mutate({ agendaId, value, dataStr })}
              isPending={markMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ===== MÊS ===== */}
      {viewMode === "mes" && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGridDays.map((d) => {
                const dStr = format(d, "yyyy-MM-dd");
                const stats = monthDayStats.get(dStr);
                const inMonth = isSameMonth(d, date);
                const isToday = isSameDay(d, new Date());
                const hasData = stats && stats.total > 0;
                const allMarked = hasData && stats.marcadas === stats.total;
                const allPresent = hasData && stats.presentes === stats.total;

                return (
                  <button
                    key={dStr}
                    onClick={() => {
                      setDate(d);
                      setViewMode("dia");
                    }}
                    className={cn(
                      "relative rounded-lg border p-2 min-h-[72px] text-left transition-colors hover:bg-accent/50",
                      !inMonth && "opacity-40 border-transparent",
                      inMonth && "border-border",
                      isToday && "ring-1 ring-primary",
                      hasData && allMarked && !allPresent && "bg-yellow-500/5 border-yellow-500/20",
                      hasData && allPresent && "bg-emerald-500/5 border-emerald-500/20",
                    )}
                  >
                    <div className={cn("text-xs font-medium", isToday && "text-primary")}>
                      {format(d, "d")}
                    </div>
                    {hasData && (
                      <div className="mt-1 space-y-0.5">
                        <div className="text-[10px] text-muted-foreground">
                          {stats.total} aula{stats.total > 1 ? "s" : ""}
                        </div>
                        {stats.marcadas > 0 && (
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "h-1.5 rounded-full",
                                stats.presentes === stats.total && stats.total > 0 ? "bg-emerald-500" : "bg-primary"
                              )}
                              style={{ width: `${(stats.marcadas / stats.total) * 16}px` }}
                            />
                            <span className="text-[9px] text-muted-foreground">
                              {stats.marcadas}/{stats.total}
                            </span>
                          </div>
                        )}
                        {stats.presentes > 0 && (
                          <div className="text-[10px] text-emerald-500">
                            {stats.presentes} presente{stats.presentes > 1 ? "s" : ""}
                          </div>
                        )}
                        {stats.faltas > 0 && (
                          <div className="text-[10px] text-destructive">
                            {stats.faltas} falta{stats.faltas > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AulaRow({
  aula,
  isPresent,
  isAbsent,
  dateStr,
  profFilter,
  onMark,
  isPending,
}: {
  aula: AgendaRow;
  isPresent: boolean;
  isAbsent: boolean;
  dateStr: string;
  profFilter: string;
  onMark: (value: boolean | null) => void;
  isPending: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
        isPresent && "border-emerald-500/30 bg-emerald-500/5",
        isAbsent && "border-destructive/30 bg-destructive/5",
        !isPresent && !isAbsent && "border-border",
      )}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{aula.atividade}</span>
          <Badge variant={aula.tipo === "fixo" ? "secondary" : "outline"} className="text-[10px]">
            {aula.tipo}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {aula.horario_inicio.slice(0, 5)}–{aula.horario_fim.slice(0, 5)} · {aula.local}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {aula.aluno_nome && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {aula.aluno_nome}
            </span>
          )}
          {aula.profissional_nome && profFilter === "all" && (
            <span>· {aula.profissional_nome}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant={isPresent ? "default" : "outline"}
          className={cn("gap-1", isPresent && "bg-emerald-600 hover:bg-emerald-600/90 text-white")}
          onClick={() => onMark(true)}
          disabled={isPending}
        >
          <Check className="h-3.5 w-3.5" /> Presente
        </Button>
        <Button
          size="sm"
          variant={isAbsent ? "destructive" : "outline"}
          className="gap-1"
          onClick={() => onMark(false)}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" /> Faltou
        </Button>
        {(isPresent || isAbsent) && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onMark(null)}
            disabled={isPending}
            title="Limpar marcação"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function groupAulasByHora(aulas: AgendaRow[]): [string, AgendaRow[]][] {
  const map = new Map<string, AgendaRow[]>();
  aulas.forEach((a) => {
    const key = a.horario_inicio.slice(0, 5);
    const arr = map.get(key) ?? [];
    arr.push(a);
    map.set(key, arr);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function WeekDayCard({
  dayStat,
  isExpanded,
  onToggleExpand,
  presencaMap,
  profFilter,
  onMark,
  isPending,
}: {
  dayStat: {
    date: Date;
    dateStr: string;
    aulas: AgendaRow[];
    total: number;
    marcadas: number;
    presentes: number;
    faltas: number;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  presencaMap: Record<string, boolean>;
  profFilter: string;
  onMark: (agendaId: string, value: boolean | null, dataStr: string) => void;
  isPending: boolean;
}) {
  const dayAulasGrupos = groupAulasByHora(dayStat.aulas);

  return (
    <Card className={cn("glass-card", !isSameDay(dayStat.date, new Date()) && "opacity-90")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">
              {format(dayStat.date, "EEEE", { locale: ptBR })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(dayStat.date, "dd/MM")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dayStat.total > 0 && (
              <div className="flex items-center gap-2 text-xs">
                {dayStat.presentes > 0 && (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                    {dayStat.presentes} presente{dayStat.presentes > 1 ? "s" : ""}
                  </Badge>
                )}
                {dayStat.faltas > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                    {dayStat.faltas} falta{dayStat.faltas > 1 ? "s" : ""}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {dayStat.marcadas}/{dayStat.total} marcada{dayStat.total > 1 ? "s" : ""}
                </span>
              </div>
            )}
            {dayStat.total > 0 && (
              <Button variant="ghost" size="sm" onClick={onToggleExpand}>
                {isExpanded ? "Recolher" : "Expandir"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && dayStat.total > 0 && (
        <CardContent className="space-y-2 pt-0">
          {dayAulasGrupos.map(([hora, items]) => (
            <div key={hora}>
              <div className="text-xs font-semibold text-muted-foreground mb-1">{hora}</div>
              {items.map((aula) => {
                const status = presencaMap[`${aula.id}|${dayStat.dateStr}`];
                const isPresent = status === true;
                const isAbsent = status === false;
                return (
                  <AulaRow
                    key={aula.id}
                    aula={aula}
                    isPresent={isPresent}
                    isAbsent={isAbsent}
                    dateStr={dayStat.dateStr}
                    profFilter={profFilter}
                    onMark={(value) => onMark(aula.id, value, dayStat.dateStr)}
                    isPending={isPending}
                  />
                );
              })}
            </div>
          ))}
        </CardContent>
      )}
      {!isExpanded && dayStat.total > 0 && (
        <CardContent className="pt-1 pb-3">
          <div className="flex flex-wrap gap-2">
            {dayStat.aulas.slice(0, 5).map((aula) => (
              <Badge key={aula.id} variant="outline" className="text-[10px]">
                {aula.atividade} · {aula.horario_inicio.slice(0, 5)}
              </Badge>
            ))}
            {dayStat.aulas.length > 5 && (
              <span className="text-[10px] text-muted-foreground">+{dayStat.aulas.length - 5} aulas</span>
            )}
          </div>
        </CardContent>
      )}
      {dayStat.total === 0 && (
        <CardContent className="pt-0 pb-4">
          <span className="text-sm text-muted-foreground">Nenhuma aula neste dia.</span>
        </CardContent>
      )}
    </Card>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "danger"
      ? "text-destructive"
      : tone === "info"
      ? "text-primary"
      : "text-foreground";
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-heading font-bold mt-1", toneClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}
