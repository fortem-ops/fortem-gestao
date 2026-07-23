
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  Activity,
  CreditCard,
  User,
  ArrowRight,
  Utensils,
  Footprints,
  ChevronRight,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
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
        .select("id, descricao, versao, status, template_fase")
        .eq("aluno_id", student!.id)
        .eq("status", "atual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
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

  const { data: creditosAll = [] } = useQuery({
    queryKey: ["portal-home-creditos-all", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("creditos_aluno" as any)
        .select("id, atividade, quantidade_inicial, quantidade_usada, ilimitado, origem_tipo, origem_id, created_at")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .neq("atividade", "Treino")
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const avulsoIds = creditosAll
    .filter((c: any) => c.origem_tipo === "servico" && c.origem_id)
    .map((c: any) => c.origem_id);

  const { data: vendasAvulso = [] } = useQuery({
    queryKey: ["portal-home-vendas-avulso", student?.id, avulsoIds.sort().join(",")],
    enabled: !!student && avulsoIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas")
        .select("id, nome_snapshot, data_venda")
        .in("id", avulsoIds);
      return data || [];
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

  const { data: desafiosAtivos = [] } = useQuery({
    queryKey: ["portal-desafios-ativos"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("clube_desafios")
        .select("*")
        .eq("status", "ativo")
        .lte("data_inicio", hoje)
        .gte("data_fim", hoje)
        .order("data_fim", { ascending: true });
      return data || [];
    },
  });

  const iconServico = (atividade: string) => {
    const a = atividade.toLowerCase();
    if (a.includes("nutri")) return { icon: Utensils, label: "Nutrição" };
    if (a.includes("reab") || a.includes("fisio")) return { icon: Footprints, label: "Reabilitação" };
    return { icon: Activity, label: "Avaliação Funcional" };
  };

  const { data: streakData } = useQuery({
    queryKey: ["portal-streak-real", student?.id],
    enabled: !!student,
    queryFn: async () => {
      // Buscar treinos realizados das últimas 16 semanas
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 16 * 7);

      const { data } = await supabase
        .from("treino_agendamentos")
        .select("data")
        .eq("aluno_id", student!.id)
        .in("status", ["realizado", "confirmado"])
        .gte("data", dataInicio.toISOString().slice(0, 10))
        .order("data", { ascending: false });

      if (!data || data.length === 0) return 0;

      // Calcular streak de semanas consecutivas
      // Cada semana começa na segunda-feira
      function getWeekStart(dateStr: string): string {
        const d = new Date(dateStr + "T12:00:00");
        const day = d.getDay(); // 0=dom, 1=seg...
        const diff = day === 0 ? -6 : 1 - day; // ajustar para segunda
        d.setDate(d.getDate() + diff);
        return d.toISOString().slice(0, 10);
      }

      // Semanas com treino (Set para deduplicar)
      const semanasComTreino = new Set(data.map((t: any) => getWeekStart(t.data)));

      // Contar semanas consecutivas a partir da semana atual
      let streak = 0;
      const hoje = new Date();
      const diaAtual = hoje.getDay();
      const diffParaSeg = diaAtual === 0 ? -6 : 1 - diaAtual;
      const semanaAtual = new Date(hoje);
      semanaAtual.setDate(hoje.getDate() + diffParaSeg);

      for (let i = 0; i < 16; i++) {
        const semana = new Date(semanaAtual);
        semana.setDate(semanaAtual.getDate() - i * 7);
        const semanaStr = semana.toISOString().slice(0, 10);

        if (semanasComTreino.has(semanaStr)) {
          streak++;
        } else if (i === 0) {
          // Semana atual sem treino ainda — não quebra streak, verifica a anterior
          continue;
        } else {
          break;
        }
      }

      return streak;
    },
  });

  const streakSemanas = streakData ?? 0;

  const { data: pendenciasDocs } = useQuery({
    queryKey: ["portal-home-pendencias", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const cpfDigits = (student?.cpf ?? "").replace(/\D/g, "");
      const [contratoRes, anexoRes] = await Promise.all([
        supabase
          .from("contratos_documentos")
          .select("id, aceite")
          .eq("aluno_id", student!.id)
          .eq("aceite", false)
          .limit(1),
        cpfDigits
          ? supabase
              .from("legal_annexes")
              .select("id, signed_at")
              .or(`aluno_id.eq.${student!.id},cpf.eq.${cpfDigits}`)
              .not("signed_at", "is", null)
              .limit(1)
          : supabase
              .from("legal_annexes")
              .select("id, signed_at")
              .eq("aluno_id", student!.id)
              .not("signed_at", "is", null)
              .limit(1),
      ]);
      const contratoPendente = (contratoRes.data?.length ?? 0) > 0;
      const anexoAssinado = (anexoRes.data?.length ?? 0) > 0;
      return { contratoPendente, anexoPendente: !anexoAssinado };
    },
  });
  const temPendencia = !!pendenciasDocs && (pendenciasDocs.contratoPendente || pendenciasDocs.anexoPendente);


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
    { label: "Carteirinha", icon: CreditCard, to: "/portal/carteirinha" },
    { label: "Avaliação", icon: Activity, to: "/portal/avaliacoes" },
    { label: "Meu Perfil", icon: User, to: "/portal/perfil" },
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

      {temPendencia && (
        <Link
          to="/portal/contratos"
          className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-100">Documentos pendentes de aceite</p>
            <p className="text-xs text-amber-100/70">
              {pendenciasDocs?.contratoPendente && pendenciasDocs?.anexoPendente
                ? "Contrato e Anexo I aguardando sua assinatura"
                : pendenciasDocs?.contratoPendente
                ? "Seu contrato aguarda aceite"
                : "Anexo I aguarda sua assinatura"}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-300 shrink-0" />
        </Link>
      )}

      {/* Créditos de treino */}
      <section className="space-y-2">
        {temPlano ? (
          <Link to="/portal/plano">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3 cursor-pointer">
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
              <p className="text-[10px] text-primary font-semibold">Gerenciar plano →</p>
            </div>
          </Link>
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

      {/* Treino atual */}
      {treinoAtual && (
        <section className="space-y-2">
          <SectionLabel>Treino Atual</SectionLabel>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className="font-bold text-base text-foreground"
                style={{ fontFamily: "Archivo, sans-serif" }}
              >
                Confira seu próximo treino →
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {treinoAtual.template_fase ? treinoAtual.template_fase : "Treino personalizado"}
              </p>
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

      {/* Minha jornada */}
      {alunoDesde && (() => {
        const d = new Date(alunoDesde + "T00:00:00");
        const hoje = new Date();
        const diffDays = Math.floor((hoje.getTime() - d.getTime()) / 86400000);
        const anos = Math.floor(diffDays / 365);
        const meses = Math.floor((diffDays % 365) / 30);
        const tempo = anos > 0
          ? `${anos} ano${anos > 1 ? "s" : ""}${meses > 0 ? ` e ${meses} mês${meses > 1 ? "es" : ""}` : ""}`
          : meses > 0
          ? `${meses} mês${meses > 1 ? "es" : ""}`
          : `${diffDays} dia${diffDays !== 1 ? "s" : ""}`;
        const emoji = anos >= 2 ? "🏆" : anos >= 1 ? "⭐" : meses >= 6 ? "💪" : "🌱";
        return (
          <section className="space-y-2">
            <SectionLabel>Minha jornada</SectionLabel>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-2xl">
                {emoji}
              </div>
              <div>
                <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                  {tempo} na FORTEM
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Membro desde {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </section>
        );
      })()}

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

      {/* Desafios Coletivos */}
      {desafiosAtivos.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Desafios Coletivos 🏆</SectionLabel>
          {desafiosAtivos.map((d: any) => {
            const pct = Math.min(100, Math.round((d.progresso_atual / d.valor_meta) * 100));
            const diasRestantes = Math.max(0, Math.ceil((new Date(d.data_fim).getTime() - Date.now()) / 86400000));
            const faltam = d.valor_meta - d.progresso_atual;
            return (
              <div key={d.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-black text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{d.titulo}</p>
                    {d.descricao && <p className="text-xs text-muted-foreground mt-0.5">{d.descricao}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-primary" style={{fontFamily:'Archivo,sans-serif'}}>{pct}%</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{d.progresso_atual.toLocaleString('pt-BR')} realizados</span>
                    <span>Meta: {d.valor_meta.toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {faltam > 0 ? `Faltam ${faltam.toLocaleString('pt-BR')} para a meta` : "🎉 Meta atingida!"}
                  </p>
                  <p className="text-[11px] font-semibold text-primary">
                    {diasRestantes > 0 ? `${diasRestantes}d restantes` : "Último dia!"}
                  </p>
                </div>

                {d.pontos_recompensa > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-base">🎁</span>
                    <p className="text-xs text-foreground">
                      Ao atingir a meta, <strong>todos os alunos ativos</strong> recebem <strong>{d.pontos_recompensa} pontos</strong> no Clube FORTEM!
                    </p>
                  </div>
                )}
                {d.mensagem_recompensa && (
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <p className="text-xs text-muted-foreground">🤝 {d.mensagem_recompensa}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Serviços do Plano e Avulsos */}
      {creditosAll.length > 0 && (() => {
        const doPlano = creditosAll.filter((c: any) => c.origem_tipo === "plano");
        const doAvulso = creditosAll.filter((c: any) => c.origem_tipo === "servico");
        const vendasMap = new Map((vendasAvulso as any[]).map((v) => [v.id, v]));

        const saldoDe = (c: any) => (c.ilimitado ? Infinity : (c.quantidade_inicial - c.quantidade_usada));

        return (
          <>

            {/* Incluso no seu Plano */}
            {doPlano.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Incluso no seu Plano</SectionLabel>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  {doPlano.map((s: any) => {
                    const saldoS = s.ilimitado ? Infinity : s.quantidade_inicial - s.quantidade_usada;
                    const pctS = s.ilimitado ? 100 : Math.round((s.quantidade_usada / Math.max(s.quantidade_inicial, 1)) * 100);
                    const { icon: Icon } = iconServico(s.atividade);
                    const cor = saldoS > 0 || s.ilimitado ? "text-emerald-400" : "text-destructive";
                    const corBarra = saldoS > 0 || s.ilimitado ? "bg-emerald-500" : "bg-destructive";
                    return (
                      <div key={s.id} className="space-y-1.5">
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

            {/* Serviços Contratados à Parte */}
            {doAvulso.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Serviços Contratados à Parte</SectionLabel>
                <div className="space-y-3">
                  {doAvulso.map((s: any) => {
                    const saldoS = s.ilimitado ? Infinity : s.quantidade_inicial - s.quantidade_usada;
                    const pctS = s.ilimitado ? 100 : Math.round((s.quantidade_usada / Math.max(s.quantidade_inicial, 1)) * 100);
                    const { icon: Icon } = iconServico(s.atividade);
                    const cor = saldoS > 0 || s.ilimitado ? "text-emerald-400" : "text-destructive";
                    const corBarra = saldoS > 0 || s.ilimitado ? "bg-emerald-500" : "bg-destructive";
                    const venda = s.origem_id ? vendasMap.get(s.origem_id) : null;
                    const nome = venda?.nome_snapshot || s.atividade;
                    const dataCompra = venda?.data_venda
                      ? new Date(venda.data_venda + "T12:00:00").toLocaleDateString("pt-BR")
                      : null;
                    return (
                      <div key={s.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate" style={{ fontFamily: "Archivo, sans-serif" }}>
                                {nome}
                              </p>
                              {dataCompra && (
                                <p className="text-[10px] text-muted-foreground">Comprado em {dataCompra}</p>
                              )}
                            </div>
                          </div>
                          <span className={`text-sm font-black ${cor}`} style={{ fontFamily: "Archivo, sans-serif" }}>
                            {s.ilimitado ? "∞" : `${s.quantidade_usada}/${s.quantidade_inicial}`}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${corBarra}`} style={{ width: `${Math.min(pctS, 100)}%` }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">
                            {s.ilimitado
                              ? "Ilimitado"
                              : saldoS > 0
                                ? `${saldoS} disponível${saldoS > 1 ? "is" : ""}`
                                : "Créditos esgotados"}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
                            Avulso
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        );
      })()}

      {/* FAB Assistente FORTEM */}
      <Link
        to="/portal/assistente"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center"
        style={{ boxShadow: "0 4px 20px rgba(231,60,62,0.4)" }}
        aria-label="Abrir Assistente FORTEM"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </Link>
    </div>
  );
}
