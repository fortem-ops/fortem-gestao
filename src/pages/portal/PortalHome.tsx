import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  Activity,
  Sparkles,
  User,
  ArrowRight,
} from "lucide-react";
import { differenceInCalendarDays, format, startOfWeek } from "date-fns";
import type { ReactNode } from "react";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function toTitleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function PortalHome() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = toTitleCase(student?.nome?.split(" ")[0] ?? "");

  const { data: planoAtivo } = useQuery({
    queryKey: ["portal-home-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, tipo, data_inicio, data_fim, proxima_renovacao")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: cicloAtivo } = useQuery({
    queryKey: ["portal-home-ciclo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("ciclos_credito")
        .select("creditos_liberados, creditos_usados, data_inicio, data_fim, status")
        .eq("status", "ativo")
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
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

  const streakSemanas = useMemo(() => {
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

  const contratado = cicloAtivo?.creditos_liberados ?? 0;
  const usado = cicloAtivo?.creditos_usados ?? 0;
  const saldo = Math.max(0, contratado - usado);
  const total = contratado;
  const pct = contratado > 0 ? Math.min(100, (saldo / contratado) * 100) : 0;

  const dataRenovacao = planoAtivo?.proxima_renovacao ?? cicloAtivo?.data_fim ?? null;
  const diasRenovacao = dataRenovacao
    ? Math.max(0, differenceInCalendarDays(new Date(dataRenovacao), new Date()))
    : null;

  const shortcuts = [
    { label: "Agendar", icon: CalendarPlus, to: "/portal/agenda" },
    { label: "Avaliação", icon: Activity, to: "/portal/avaliacoes" },
    { label: "Clube", icon: Sparkles, to: "/portal/clube" },
    { label: "Perfil", icon: User, to: "/portal/perfil" },
  ];

  if (!student) return null;

  const temPlano = !!planoAtivo && contratado > 0;
  const ringLen = 132;
  const streakPct = Math.min(streakSemanas / 8, 1);

  return (
    <div className="space-y-5 animate-fade-in pb-32 pt-4">
      {/* Saudação */}
      <div className="pt-2 pb-1">
        <p className="text-muted-foreground text-sm">{saudacao} 👋</p>
        <h1
          className="text-2xl font-black tracking-tight text-foreground"
          style={{ fontFamily: "Archivo, sans-serif" }}
        >
          {primeiroNome}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">FORTEM · Portal do Aluno</p>
      </div>

      {/* Créditos de treino */}
      <section className="space-y-2">
        {temPlano ? (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Créditos de Treino
              </span>
              <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                {planoAtivo!.tipo.toUpperCase()}
                {student.frequencia_semanal ? ` · ${student.frequencia_semanal}×` : ""}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-black text-foreground"
                style={{ fontFamily: "Archivo, sans-serif" }}
              >
                {saldo}
              </span>
              <span className="text-base text-muted-foreground font-medium">
                / {total} créditos
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {diasRenovacao !== null
                ? diasRenovacao === 0
                  ? "Renova em breve"
                  : `Renova em ${diasRenovacao} dia${diasRenovacao === 1 ? "" : "s"}`
                : "Renovação próxima"}
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usado} utilizados</span>
              <span>{saldo} restantes</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p
              className="font-bold text-base text-foreground mb-1"
              style={{ fontFamily: "Archivo, sans-serif" }}
            >
              Nenhum plano ativo
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Fale com a equipe para ativar seu plano e começar a treinar.
            </p>
            <Button size="sm" className="w-full" onClick={() => navigate("/portal/perfil")}>
              Falar com a equipe
            </Button>
          </div>
        )}
      </section>

      {/* Treino atual */}
      {treinoAtual && (
        <section className="space-y-2">
          <SectionLabel>Treino Atual</SectionLabel>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className="font-semibold text-base truncate text-foreground"
                style={{ fontFamily: "Archivo, sans-serif" }}
              >
                {treinoAtual.descricao}
              </p>
              {treinoAtual.versao && (
                <p className="text-[11px] text-muted-foreground">Versão {treinoAtual.versao}</p>
              )}
            </div>
            <button
              onClick={() => navigate("/portal/treinos")}
              className="text-primary font-semibold text-sm whitespace-nowrap"
            >
              Ver treino →
            </button>
          </div>
        </section>
      )}

      {/* Atalhos */}
      <section className="space-y-2">
        <SectionLabel>Atalhos</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          {shortcuts.map((s) => (
            <Link to={s.to} key={s.label}>
              <div className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-2 min-h-[76px] justify-center">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">
                  {s.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Streak */}
      <section className="space-y-2">
        <SectionLabel>Sua frequência</SectionLabel>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 54 54">
              <circle
                cx="27"
                cy="27"
                r="21"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="4"
              />
              <circle
                cx="27"
                cy="27"
                r="21"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeDasharray={ringLen}
                strokeDashoffset={ringLen - ringLen * streakPct}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-base font-black text-foreground"
                style={{ fontFamily: "Archivo, sans-serif" }}
              >
                {streakSemanas}
              </span>
            </div>
          </div>
          <div>
            <p
              className="font-bold text-sm text-foreground"
              style={{ fontFamily: "Archivo, sans-serif" }}
            >
              {streakSemanas === 0
                ? "Comece sua sequência!"
                : `${streakSemanas} semana${streakSemanas > 1 ? "s" : ""} seguida${streakSemanas > 1 ? "s" : ""} 🔥`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {streakSemanas === 0
                ? "Agende seu primeiro treino."
                : "Continue assim — você está evoluindo!"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
