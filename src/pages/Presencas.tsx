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
import { CalendarIcon, Check, X, RotateCcw, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

export default function Presencas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [profFilter, setProfFilter] = useState<string>("me");

  const dateStr = format(date, "yyyy-MM-dd");
  const diaSemana = date.getDay();

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["is-coord-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Aulas do dia: fixos do dia_semana + avulsos da data exata
  const { data: aulas = [], isLoading } = useQuery({
    queryKey: ["presencas-aulas", dateStr, isCoordAdmin, user?.id, profFilter],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("agenda_servicos")
        .select("id, tipo, atividade, local, dia_semana, horario_inicio, horario_fim, data_especifica, profissional_id, aluno_id")
        .or(`and(tipo.eq.fixo,dia_semana.eq.${diaSemana}),and(tipo.eq.avulso,data_especifica.eq.${dateStr})`)
        .order("horario_inicio");

      if (!isCoordAdmin || profFilter === "me") {
        query = query.eq("profissional_id", user!.id);
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
    queryKey: ["presencas", dateStr, agendaIds],
    enabled: agendaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_presencas")
        .select("agenda_id, comparecimento")
        .eq("data", dateStr)
        .in("agenda_id", agendaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const presencaMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    presencas.forEach((p: any) => (m[p.agenda_id] = p.comparecimento));
    return m;
  }, [presencas]);

  const markMutation = useSupabaseMutation<unknown, { agendaId: string; value: boolean | null }>({
    mutationFn: async ({ agendaId, value }) => {
      if (value === null) {
        const { error } = await supabase
          .from("agenda_presencas")
          .delete()
          .eq("agenda_id", agendaId)
          .eq("data", dateStr);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from("agenda_presencas")
        .upsert(
          {
            agenda_id: agendaId,
            data: dateStr,
            comparecimento: value,
            marcado_por: user!.id,
          },
          { onConflict: "agenda_id,data" },
        );
      if (error) throw error;
      return null;
    },
    invalidates: [["presencas", dateStr, agendaIds], ["rel-servicos"]],
    errorTitle: "Erro ao marcar presença",
  });

  const grupos = useMemo(() => {
    const map = new Map<string, AgendaRow[]>();
    aulas.forEach((a) => {
      const key = a.horario_inicio.slice(0, 5);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [aulas]);

  const totais = useMemo(() => {
    const total = aulas.length;
    const marcadas = aulas.filter((a) => a.id in presencaMap).length;
    const presentes = aulas.filter((a) => presencaMap[a.id] === true).length;
    const faltas = aulas.filter((a) => presencaMap[a.id] === false).length;
    return { total, marcadas, presentes, faltas };
  }, [aulas, presencaMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Lista de Presença</h1>
          <p className="text-muted-foreground text-sm">
            Marque presença ou falta das aulas do dia
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(date, "EEE, dd MMM yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={totais.total} />
        <StatCard label="Marcadas" value={`${totais.marcadas}/${totais.total}`} tone="info" />
        <StatCard label="Presentes" value={totais.presentes} tone="success" />
        <StatCard label="Faltas" value={totais.faltas} tone="danger" />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      {!isLoading && aulas.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma aula encontrada nesta data.
          </CardContent>
        </Card>
      )}

      {grupos.map(([hora, items]) => (
        <Card key={hora} className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hora}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((aula) => {
              const status = presencaMap[aula.id];
              const isPresent = status === true;
              const isAbsent = status === false;
              return (
                <div
                  key={aula.id}
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
                      onClick={() => markMutation.mutate({ agendaId: aula.id, value: true })}
                      disabled={markMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5" /> Presente
                    </Button>
                    <Button
                      size="sm"
                      variant={isAbsent ? "destructive" : "outline"}
                      className="gap-1"
                      onClick={() => markMutation.mutate({ agendaId: aula.id, value: false })}
                      disabled={markMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" /> Faltou
                    </Button>
                    {(isPresent || isAbsent) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => markMutation.mutate({ agendaId: aula.id, value: null })}
                        disabled={markMutation.isPending}
                        title="Limpar marcação"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
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
