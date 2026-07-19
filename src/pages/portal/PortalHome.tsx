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

export default function PortalHome() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = student?.nome?.split(" ")[0] ?? "";

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
  const pct = contratado > 0 ? Math.min(100, (usado / contratado) * 100) : 0;

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
  const streakPct = Math.min(streakSemanas / 12, 1);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Saudação */}
      <div className="pt-2 pb-1">
        <p className="text-muted-foreground text-sm">{saudacao} 👋</p>
        <h1 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
          {primeiroNome}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">FORTEM · Portal do Aluno</p>
      </div>

      {/* Créditos de treino */}
      <section className="space-y-2">
        <SectionLabel>Créditos de Treino</SectionLabel>
        {temPlano ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 text-[10px] font-semibold tracking-wider uppercase">
                {String(planoAtivo!.tipo)}
                {student.frequencia_semanal ? ` · ${student.frequencia_semanal}×` : ""}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {diasRenovacao !== null
                  ? diasRenovacao === 0
                    ? "Renova em breve"
                    : `Renova em ${diasRenovacao} dia${diasRenovacao === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <p className="font-black text-[46px] leading-none text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
                {saldo}
              </p>
              <p className="text-xs text-muted-foreground mb-2">créditos restantes</p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{usado} utilizados</span>
                <span>{saldo} restantes</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="font-bold text-base text-foreground mb-1" style={{ fontFamily: "Archivo, sans-serif" }}>
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

      {/* Próximo treino */}
      {treinoAtual && (
        <section className="space-y-2">
          <SectionLabel>Próximo treino</SectionLabel>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-base truncate text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
                {treinoAtual.descricao}
              </p>
              {treinoAtual.versao && (
                <p className="text-[11px] text-muted-foreground">Versão {treinoAtual.versao}</p>
              )}
            </div>
            <Button size="sm" variant="ghost" className="text-primary" onClick={() => navigate("/portal/treinos")}>
              Ver <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </section>
      )}

      {/* Atalhos */}
      <section className="space-y-2">
        <SectionLabel>Atalhos</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          {shortcuts.map((s) => (
            <Link to={s.to} key={s.label}>
              <div className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-2 transition hover:border-primary/60">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
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
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r="21" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
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
              <span className="text-base font-black text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
                {streakSemanas}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
              {streakSemanas === 0
                ? "Comece sua sequência!"
                : `${streakSemanas} semana${streakSemanas > 1 ? "s" : ""} seguida${streakSemanas > 1 ? "s" : ""} 🔥`}
            </p>
            <p className="text-xs text-muted-foreground">
              {streakSemanas === 0
                ? "Agende seu primeiro treino da semana."
                : "Você está acima da média. Continue assim!"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
