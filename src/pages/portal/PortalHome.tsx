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
  Utensils,
  Footprints,
  Settings,
  ChevronRight,
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

  const { data: avaliacaoResume } = useQuery({
    queryKey: ["portal-home-avaliacao", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("id, tipo, data, dados")
        .eq("aluno_id", student!.id)
        .in("tipo", ["funcional_v2", "funcional"])
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: servicosPlano = [] } = useQuery({
    queryKey: ["portal-home-servicos-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("creditos_aluno" as any)
        .select("atividade, quantidade_inicial, quantidade_usada, ilimitado")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .neq("atividade", "Treino");
      return (data as any[]) || [];
    },
  });

  const { data: alunoDesde } = useQuery({
    queryKey: ["portal-aluno-desde", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("data_inicio")
        .eq("aluno_id", student!.id)
        .order("data_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data?.data_inicio ?? null;
    },
  });

  const iconServico = (atividade: string) => {
    const a = atividade.toLowerCase();
    if (a.includes("nutri")) return { icon: Utensils, label: "Nutrição" };
    if (a.includes("reab") || a.includes("fisio")) return { icon: Footprints, label: "Reabilitação" };
    return { icon: Activity, label: "Avaliação Funcional" };
  };

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
  const pctRestante = total > 0 ? Math.round((saldo / total) * 100) : 0;
  const corBarra = pctRestante > 30 ? "bg-emerald-500" : pctRestante > 10 ? "bg-warning" : "bg-destructive";

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

  const scoreGeral = avaliacaoResume
    ? (() => {
        const dados = (avaliacaoResume.dados as any) || {};
        const metricas: any[] = dados.metricas || [];
        if (!metricas.length) return null;
        const scoreMap: Record<string, number> = {
          Excelente: 100, Bom: 80, Regular: 60, Médio: 55, Fraco: 30
        };
        const scores = metricas.flatMap((m: any) => [
          scoreMap[m.leftClass] ?? null,
          scoreMap[m.rightClass] ?? null,
        ]).filter((v): v is number => v !== null);
        return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      })()
    : null;

  const diasDesdeAvaliacao = avaliacaoResume
    ? differenceInCalendarDays(new Date(), new Date(avaliacaoResume.data))
    : null;

  const mesesDesde = diasDesdeAvaliacao !== null ? Math.floor(diasDesdeAvaliacao / 30) : null;
  const precisaReavaliar = mesesDesde !== null && mesesDesde >= 4;

  const metricasAtencao = avaliacaoResume
    ? (() => {
        const dados = (avaliacaoResume.dados as any) || {};
        const metricas: any[] = dados.metricas || [];
        return metricas.filter((m: any) =>
          ["Fraco", "Regular"].includes(m.leftClass) || ["Fraco", "Regular"].includes(m.rightClass)
        ).length;
      })()
    : 0;

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
                className={`h-full rounded-full transition-all ${corBarra}`}
                style={{ width: `${Math.min(pctRestante, 100)}%` }}
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

      {/* Gerenciar Plano */}
      <Link to="/portal/plano">
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Gerenciar Plano</p>
              <p className="text-xs text-muted-foreground">Trancar, cancelar, upgrades e vantagens</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </Link>

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
                {treinoAtual.descricao?.trim() || "Treino Personalizado"}
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
                <div className="w-9 h-9 rounded-xl bg-[#2C2C2C] flex items-center justify-center">
                  <s.icon className="w-[18px] h-[18px] text-primary" />
                </div>
                <span className="text-[11px] font-semibold text-foreground/70 text-center leading-tight">
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

      {/* Banner Avaliação Funcional */}
      {avaliacaoResume && (
        <section className="space-y-2">
          <SectionLabel>Diagnóstico Funcional</SectionLabel>
          <Link to="/portal/avaliacoes">
            <div className={`rounded-2xl p-4 flex items-center gap-4 border ${
              precisaReavaliar
                ? "bg-primary/5 border-primary/30"
                : "bg-card border-border"
            }`}>
              {/* Score ring */}
              <div className="relative w-16 h-16 shrink-0">
                {(() => {
                  const score = scoreGeral ?? 0;
                  const radius = 26;
                  const circ = 2 * Math.PI * radius;
                  const color = score >= 85 ? "#22C55E" : score >= 70 ? "#4ADE80" : score >= 55 ? "#60A5FA" : score >= 40 ? "#F59E0B" : "#EF4444";
                  return (
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(0 0% 20%)" strokeWidth="5" />
                      <circle
                        cx="32" cy="32" r={radius} fill="none"
                        stroke={color} strokeWidth="5"
                        strokeDasharray={`${(score / 100) * circ} ${circ}`}
                        strokeLinecap="round"
                      />
                    </svg>
                  );
                })()}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-foreground leading-none" style={{fontFamily:'Archivo,sans-serif'}}>
                    {scoreGeral ?? "—"}
                  </span>
                  <span className="text-[9px] text-muted-foreground">/100</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                  {precisaReavaliar ? "Hora de reavaliar!" : "Avaliação em dia"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mesesDesde === 0
                    ? "Avaliado este mês"
                    : `Há ${mesesDesde} ${mesesDesde === 1 ? "mês" : "meses"}`}
                  {metricasAtencao > 0 ? ` · ${metricasAtencao} ponto${metricasAtencao > 1 ? "s" : ""} de atenção` : ""}
                </p>
                <p className="text-[11px] text-primary font-semibold mt-1.5">
                  Ver diagnóstico completo →
                </p>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Serviços do Plano */}
      {servicosPlano.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Serviços do Plano</SectionLabel>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            {servicosPlano.map((s: any) => {
              const saldoS = s.ilimitado ? Infinity : s.quantidade_inicial - s.quantidade_usada;
              const pctS = s.ilimitado ? 100 : Math.round((s.quantidade_usada / Math.max(s.quantidade_inicial, 1)) * 100);
              const { icon: Icon } = iconServico(s.atividade);
              const cor = saldoS > 0 || s.ilimitado ? "text-emerald-400" : "text-destructive";
              const corBarra = saldoS > 0 || s.ilimitado ? "bg-emerald-500" : "bg-destructive";
              return (
                <div key={s.atividade} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#2C2C2C] flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{s.atividade}</span>
                    </div>
                    <span className={`text-sm font-black ${cor}`} style={{ fontFamily: "Archivo, sans-serif" }}>
                      {s.ilimitado ? "∞" : `${s.quantidade_usada}/${s.quantidade_inicial}`}
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${corBarra}`} style={{ width: `${Math.min(pctS, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {s.ilimitado
                      ? "Ilimitado"
                      : saldoS > 0
                        ? `${saldoS} disponível${saldoS > 1 ? "is" : ""}`
                        : "Créditos esgotados"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
