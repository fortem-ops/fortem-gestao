import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CalendarPlus,
  Activity,
  Sparkles,
  User,
  ArrowRight,
  Flame,
} from "lucide-react";
import { differenceInCalendarDays, format, startOfWeek } from "date-fns";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function PortalHome() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();

  const firstName = student?.nome?.split(" ")[0] ?? "";

  const { data: planoAtivo } = useQuery({
    queryKey: ["portal-home-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("*")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: creditosTreino } = useQuery({
    queryKey: ["portal-home-creditos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("consumo_servicos")
        .select("quantidade, agenda_id, tipo_registro")
        .eq("aluno_id", student!.id)
        .eq("tipo_servico", "Treino");
      let contratado = 0;
      let usado = 0;
      (data || []).forEach((c: any) => {
        if (c.tipo_registro === "compra") contratado += c.quantidade ?? 1;
        if (!!c.agenda_id || c.tipo_registro === "uso_manual") usado += c.quantidade ?? 1;
      });
      return { contratado, usado };
    },
  });

  const { data: treinoAtual } = useQuery({
    queryKey: ["portal-home-treino", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("treinos")
        .select("id, descricao, versao, status")
        .eq("aluno_id", student!.id)
        .eq("status", "atual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: progressoRecente = [] } = useQuery({
    queryKey: ["portal-home-progresso", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_workout_progress")
        .select("data")
        .eq("aluno_id", student!.id)
        .order("data", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Calcula streak semanal (semanas consecutivas com pelo menos 1 treino)
  const streak = useMemo(() => {
    if (!progressoRecente.length) return 0;
    const semanas = new Set<string>();
    progressoRecente.forEach((p: any) => {
      const ws = startOfWeek(new Date(p.data), { weekStartsOn: 1 });
      semanas.add(format(ws, "yyyy-MM-dd"));
    });
    let s = 0;
    let cursor = startOfWeek(new Date(), { weekStartsOn: 1 });
    while (semanas.has(format(cursor, "yyyy-MM-dd"))) {
      s += 1;
      cursor = new Date(cursor.getTime() - 7 * 86400000);
    }
    return s;
  }, [progressoRecente]);

  const contratado = creditosTreino?.contratado ?? 0;
  const usado = creditosTreino?.usado ?? 0;
  const saldo = Math.max(0, contratado - usado);
  const pct = contratado > 0 ? Math.min(100, (usado / contratado) * 100) : 0;

  const diasRenovacao = planoAtivo?.proxima_renovacao
    ? Math.max(0, differenceInCalendarDays(new Date(planoAtivo.proxima_renovacao), new Date()))
    : null;

  const shortcuts = [
    { label: "Agendar", icon: CalendarPlus, to: "/portal/agenda" },
    { label: "Avaliação", icon: Activity, to: "/portal/avaliacoes" },
    { label: "Clube", icon: Sparkles, to: "/portal/clube" },
    { label: "Perfil", icon: User, to: "/portal/perfil" },
  ];

  if (!student) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Saudação */}
      <header className="pt-2">
        <h1 className="font-heading font-bold text-[22px] leading-tight tracking-tight">
          {greeting()}, {firstName}!
        </h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">FORTEM · Matriz</p>
      </header>

      {/* Créditos de treino */}
      <Card className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-widest">
            Créditos de Treino
          </p>
          {planoAtivo && (
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-[10px] tracking-wider">
              {String(planoAtivo.tipo).toUpperCase()}
              {student.frequencia_semanal ? ` · ${student.frequencia_semanal}×` : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-heading font-black text-[42px] leading-none">{saldo}</p>
            <p className="text-[11px] text-muted-foreground mt-2">
              {diasRenovacao !== null
                ? `Renova em ${diasRenovacao} dia${diasRenovacao === 1 ? "" : "s"}`
                : "Sem plano ativo"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Progress value={pct} className="h-1.5" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{usado} utilizados</span>
            <span>{saldo} restantes</span>
          </div>
        </div>
      </Card>

      {/* Próximo treino */}
      {treinoAtual && (
        <section className="space-y-2">
          <p className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-widest">
            Próximo treino
          </p>
          <Card className="glass-card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading font-semibold text-base truncate">{treinoAtual.descricao}</p>
              {treinoAtual.versao && (
                <p className="text-[11px] text-muted-foreground">Versão {treinoAtual.versao}</p>
              )}
            </div>
            <Button size="sm" variant="ghost" className="text-primary" onClick={() => navigate("/portal/treinos")}>
              Ver treino <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        </section>
      )}

      {/* Atalhos */}
      <section className="space-y-2">
        <p className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-widest">
          Atalhos
        </p>
        <div className="grid grid-cols-2 gap-3">
          {shortcuts.map((s) => (
            <button
              key={s.to}
              onClick={() => navigate(s.to)}
              className="glass-card rounded-2xl p-4 flex items-center gap-3 text-left transition hover:border-primary/60"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="font-heading font-semibold text-sm">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Streak */}
      {streak > 0 && (
        <Card className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-heading font-bold text-base">
              {streak} {streak === 1 ? "semana" : "semanas"} seguida{streak === 1 ? "" : "s"} 🔥
            </p>
            <p className="text-[11px] text-muted-foreground">Continue firme, sua constância está construindo resultado.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
