import { buildInclusoPlano, SERVICOS_PLANO } from "@/lib/creditosServicos";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { queryPlanoPrincipalAtivo } from "@/lib/planoPrincipal";
import { Activity, ArrowRight, Utensils, Footprints, ChevronRight, MessageCircle } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import type { ReactNode } from "react";
import { useAlunoAvaliacoesConsolidadas } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import {
  montarMedidasPortal,
  montarResumoPortal,
  montarSelosInicio,
  type PortalNivel,
} from "@/components/portal/portalAssessmentLogic";

const COR_AVISO = "text-[#E3B341]";
const COR_OK = "text-[#4CC38A]";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">{children}</p>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div aria-hidden className="animate-pulse border border-[#4A4B4B] bg-[#1A1A1A]" style={{ height: h }} />;
}

function Cantoneiras() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-[#E73C3E]" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#E73C3E]" />
    </>
  );
}

function toTitleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex"];

function inicioSemana(d: Date) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

export default function PortalHome() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = toTitleCase(student?.nome?.split(" ")[0] ?? "");

  // ---------- 1ª onda (acima da dobra), em paralelo ----------
  const planoQ = useQuery({
    queryKey: ["portal-home-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await queryPlanoPrincipalAtivo(
        student!.id,
        "id, tipo, data_inicio, data_fim, proxima_renovacao, servicos",
      );
      return data;
    },
  });
  const planoAtivo = planoQ.data;

  const cicloQ = useQuery({
    queryKey: ["portal-home-ciclo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("ciclos_credito")
        .select("creditos_liberados, creditos_usados, data_inicio, data_fim, status, contratos!inner(aluno_id)")
        .eq("contratos.aluno_id", student!.id)
        .eq("status", "ativo")
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const cicloAtivo = cicloQ.data;

  // Mesma consulta e chave da Agenda: o resultado é compartilhado em cache.
  const agendQ = useQuery({
    queryKey: ["portal-meus-agendamentos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("*, treino_slots(*)")
        .eq("aluno_id", student!.id)
        .gte("data", format(new Date(), "yyyy-MM-dd"))
        .in("status", ["agendado", "confirmado"])
        .order("data", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const meusAgendamentos = agendQ.data ?? [];

  const treinoQ = useQuery({
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
  const treinoAtual = treinoQ.data;

  const pendQ = useQuery({
    queryKey: ["portal-home-pendencias", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const [contratoRes, anexoRes] = await Promise.all([
        supabase.from("contratos_documentos").select("id, aceite").eq("aluno_id", student!.id).eq("aceite", false).limit(1),
        supabase.from("legal_annexes").select("id, signed_at").eq("aluno_id", student!.id).not("signed_at", "is", null).limit(1),
      ]);
      const contratoPendente = (contratoRes.data?.length ?? 0) > 0;
      const anexoAssinado = (anexoRes.data?.length ?? 0) > 0;
      return { contratoPendente, anexoPendente: !anexoAssinado };
    },
  });
  const pendenciasDocs = pendQ.data;

  // ---------- 2ª onda: só depois que a 1ª terminar (ou após 1,5 s) ----------
  const primeiraOndaPronta =
    !!student && !planoQ.isLoading && !cicloQ.isLoading && !agendQ.isLoading && !pendQ.isLoading;
  const [segundaOnda, setSegundaOnda] = useState(false);
  useEffect(() => {
    if (primeiraOndaPronta) setSegundaOnda(true);
  }, [primeiraOndaPronta]);
  useEffect(() => {
    if (!student) return;
    const t = setTimeout(() => setSegundaOnda(true), 1500);
    return () => clearTimeout(t);
  }, [student]);
  const liberar = !!student && segundaOnda;

  const { data: consumosPlano = [], isLoading: consumosLoading } = useQuery({
    queryKey: ["portal-home-consumos", student?.id, planoAtivo?.id],
    enabled: liberar && !!planoAtivo?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("consumo_servicos")
        .select("tipo_servico, tipo_registro, quantidade, agenda_id")
        .eq("aluno_id", student!.id)
        .eq("plano_id", planoAtivo!.id);
      return (data as any[]) || [];
    },
  });

  const { data: creditosAll = [] } = useQuery({
    queryKey: ["portal-home-creditos-all", student?.id],
    enabled: liberar,
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
    enabled: liberar && avulsoIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("id, nome_snapshot, data_venda").in("id", avulsoIds);
      return data || [];
    },
  });

  const { data: desafiosAtivos = [] } = useQuery({
    queryKey: ["portal-desafios-ativos"],
    enabled: liberar,
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

  // Mesma consulta da sequência; a resposta também alimenta as colunas da semana.
  const { data: frequencia, isLoading: freqLoading } = useQuery({
    queryKey: ["portal-streak-real", student?.id, "semana"],
    enabled: liberar,
    queryFn: async () => {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 16 * 7);
      const { data } = await supabase
        .from("treino_agendamentos")
        .select("data")
        .eq("aluno_id", student!.id)
        .in("status", ["realizado", "confirmado"])
        .gte("data", dataInicio.toISOString().slice(0, 10))
        .order("data", { ascending: false });

      const datas = (data || []).map((t: any) => t.data as string);
      const semanaKey = (dateStr: string) => inicioSemana(new Date(dateStr + "T12:00:00")).toISOString().slice(0, 10);
      const semanas = new Set(datas.map(semanaKey));
      const atual = inicioSemana(new Date());
      let streak = 0;
      for (let i = 0; i < 16; i++) {
        const s = new Date(atual);
        s.setDate(atual.getDate() - i * 7);
        if (semanas.has(s.toISOString().slice(0, 10))) streak++;
        else if (i === 0) continue;
        else break;
      }
      const diasSemana = DIAS_SEMANA.map((_, i) => {
        const d = new Date(atual);
        d.setDate(atual.getDate() + i);
        return datas.includes(format(d, "yyyy-MM-dd"));
      });
      return { streak, diasSemana };
    },
  });

  const avaliacoesQ = useAlunoAvaliacoesConsolidadas(liberar ? student?.id : undefined);

  const iconServico = (atividade: string) => {
    const a = atividade.toLowerCase();
    if (a.includes("nutri")) return { icon: Utensils };
    if (a.includes("reab") || a.includes("fisio")) return { icon: Footprints };
    return { icon: Activity };
  };

  if (!student) return null;

  const temPendencia = !!pendenciasDocs && (pendenciasDocs.contratoPendente || pendenciasDocs.anexoPendente);
  const contratado = cicloAtivo?.creditos_liberados ?? 0;
  const usado = cicloAtivo?.creditos_usados ?? 0;
  const saldo = Math.max(0, contratado - usado);
  const pctRestante = contratado > 0 ? Math.round((saldo / contratado) * 100) : 0;
  const dataRenovacao = planoAtivo?.proxima_renovacao ?? cicloAtivo?.data_fim ?? null;
  const diasRenovacao = dataRenovacao ? Math.max(0, differenceInCalendarDays(new Date(dataRenovacao), new Date())) : null;
  const temPlano = !!planoAtivo;

  const planoLabel = (() => {
    if (!planoAtivo) return "";
    const partes = planoAtivo.tipo.split(/\s*[-–·]\s*/).map((p: string) => p.trim()).filter(Boolean);
    const corrida = partes.filter((p: string) => p.toUpperCase().includes("CORRIDA"));
    const principais = partes.filter((p: string) => !p.toUpperCase().includes("CORRIDA"));
    const label: string[] = [];
    if (principais.length) label.push(principais.join(" - "));
    if (student.frequencia_semanal) label.push(`${student.frequencia_semanal}x`);
    if (corrida.length) label.push("Corrida");
    return label.join(" · ");
  })();

  // Próximo treino
  const hojeStr = format(new Date(), "yyyy-MM-dd");
  const agora = format(new Date(), "HH:mm");
  const proximo = meusAgendamentos.find((a: any) => {
    const ini = (a.horario_inicio ?? a.treino_slots?.horario_inicio ?? "").slice(0, 5);
    return a.data > hojeStr || (a.data === hojeStr && (!ini || ini >= agora || a.status === "agendado" || a.status === "confirmado"));
  });
  const checkinHoje = proximo && proximo.data === hojeStr;
  const descreverDia = (a: any) => {
    const d = new Date(a.data + "T12:00:00");
    const diff = differenceInCalendarDays(d, new Date());
    const dia = diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    const hr = (a.horario_inicio ?? a.treino_slots?.horario_inicio ?? "").slice(0, 5);
    return `${dia.charAt(0).toUpperCase() + dia.slice(1)}${hr ? `, ${hr}` : ""}`;
  };

  // Diagnóstico
  const avaliacaoResume = avaliacoesQ.data?.funcional.latest ?? null;
  const selosAvaliacao = montarSelosInicio(montarMedidasPortal(avaliacaoResume));
  const resumoAvaliacao = montarResumoPortal(montarMedidasPortal(avaliacaoResume));
  const diasDesdeAvaliacao = avaliacaoResume ? differenceInCalendarDays(new Date(), new Date(avaliacaoResume.data)) : null;
  const mesesDesde = diasDesdeAvaliacao !== null ? Math.floor(diasDesdeAvaliacao / 30) : null;
  const precisaReavaliar = mesesDesde !== null && mesesDesde >= 4;
  const nivelChip: Record<PortalNivel, { rotulo: string; cor: string }> = {
    equilibrado: { rotulo: "Equilibrado", cor: COR_OK },
    atencao: { rotulo: "Atenção", cor: COR_AVISO },
    prioridade: { rotulo: "Prioridade", cor: "text-[#E73C3E]" },
  };

  // Serviços
  const doPlano = SERVICOS_PLANO.map((cfg) => ({
    atividade: cfg.label,
    ...buildInclusoPlano((planoAtivo as any)?.servicos, consumosPlano as any[], cfg.tipo),
  })).filter((s) => s.total > 0);
  const doAvulso = creditosAll.filter((c: any) => c.origem_tipo === "servico");
  const vendasMap = new Map((vendasAvulso as any[]).map((v) => [v.id, v]));

  const btnPrimario =
    "flex min-h-[44px] flex-1 items-center justify-center bg-[#C8282A] px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-white";
  const btnFilete =
    "flex min-h-[44px] flex-1 items-center justify-center border border-[#4A4B4B] px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-foreground";
  const cartao = "border border-[#4A4B4B] bg-[#1A1A1A]";

  return (
    <div className="space-y-5 pb-32 pt-4" style={{ fontFamily: "Archivo, sans-serif" }}>
      {/* 1. Saudação */}
      <h1 className="pt-2 text-2xl font-black uppercase tracking-tight text-foreground">
        {saudacao}, {primeiroNome}
      </h1>

      {/* 2. Próximo treino */}
      <section className={`relative p-5 ${cartao}`} aria-labelledby="proximo-treino">
        <Cantoneiras />
        {agendQ.isLoading ? (
          <div className="h-[132px]" aria-busy="true" />
        ) : proximo ? (
          <div className="space-y-4">
            <div>
              <p id="proximo-treino" className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">
                {checkinHoje ? "Treino de hoje" : "Próximo treino"}
              </p>
              <p className="mt-1 text-3xl font-black text-foreground">{descreverDia(proximo)}</p>
              {treinoAtual && (
                <p className="mt-1 text-xs text-[#B1B3B3]">{treinoAtual.template_fase || "Treino personalizado"}</p>
              )}
            </div>
            <div className="flex gap-2">
              {checkinHoje ? (
                <button className={btnPrimario} onClick={() => navigate("/portal/treinos")}>Fazer check-in</button>
              ) : (
                <button className={btnPrimario} onClick={() => navigate("/portal/treinos")}>Ver treino</button>
              )}
              <button className={btnFilete} onClick={() => navigate("/portal/agenda")}>Remarcar</button>
            </div>
            {checkinHoje && (
              <Link to="/portal/treinos" className="flex min-h-[44px] items-center text-xs font-semibold text-[#B1B3B3]">
                Ver treino <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p id="proximo-treino" className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Próximo treino</p>
            <p className="text-xl font-black text-foreground">Você não tem treino agendado</p>
            <div className="flex gap-2">
              <button className={btnPrimario} onClick={() => navigate("/portal/agenda")}>Agendar treino</button>
              {treinoAtual && (
                <button className={btnFilete} onClick={() => navigate("/portal/treinos")}>Ver treino</button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3. Pendência */}
      {temPendencia && (
        <Link
          to="/portal/contratos"
          className={`flex min-h-[44px] items-center gap-3 border border-[#E3B341]/50 px-4 py-2 ${COR_AVISO}`}
        >
          <span className="flex-1 truncate text-sm font-bold">
            Documentos pendentes de aceite
            <span className="font-normal text-[#B1B3B3]">
              {" · "}
              {pendenciasDocs?.contratoPendente && pendenciasDocs?.anexoPendente
                ? "Contrato e Anexo I"
                : pendenciasDocs?.contratoPendente
                ? "Contrato"
                : "Anexo I"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* 4. Créditos de treino */}
      <section className="space-y-2">
        <SectionLabel>Créditos de treino</SectionLabel>
        {planoQ.isLoading || cicloQ.isLoading ? (
          <Skeleton h={148} />
        ) : temPlano ? (
          <div className={`space-y-3 p-5 ${cartao}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-foreground">
                <span className="text-4xl font-black">{saldo}</span>
                <span className="text-sm text-[#B1B3B3]"> de {contratado} restantes</span>
              </p>
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">{planoLabel}</span>
            </div>
            <div className="h-1 bg-[#4A4B4B]">
              <div className="h-full bg-foreground" style={{ width: `${Math.min(pctRestante, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-[#B1B3B3]">
              <span>
                {diasRenovacao !== null
                  ? diasRenovacao === 0
                    ? "Renova em breve"
                    : `Renova em ${diasRenovacao} dia${diasRenovacao === 1 ? "" : "s"}`
                  : "Renovação próxima"}
                {` · ${usado} utilizados`}
              </span>
              <Link to="/portal/plano" className="flex min-h-[44px] items-center font-semibold text-foreground">
                Gerenciar plano <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className={`space-y-3 p-5 ${cartao}`}>
            <p className="text-base font-bold text-foreground">Nenhum plano ativo</p>
            <p className="text-xs text-[#B1B3B3]">Fale com a equipe para ativar seu plano e começar a treinar.</p>
            <button className={`${btnFilete} w-full`} onClick={() => navigate("/portal/perfil")}>Falar com a equipe</button>
          </div>
        )}
      </section>

      {/* 5. Frequência da semana */}
      <section className="space-y-2">
        <SectionLabel>Sua semana</SectionLabel>
        {!liberar || freqLoading ? (
          <Skeleton h={104} />
        ) : (
          <div className={`p-4 ${cartao}`} style={{ minHeight: 104 }}>
            <div className="grid grid-cols-5 gap-2">
              {DIAS_SEMANA.map((d, i) => {
                const feito = frequencia?.diasSemana[i];
                return (
                  <div key={d} className="flex flex-col items-center gap-1.5">
                    <div className={`h-8 w-full border ${feito ? "border-foreground bg-foreground" : "border-[#4A4B4B]"}`} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#B1B3B3]">{d}</span>
                    <span className="sr-only">{feito ? "treino feito" : "sem treino"}</span>
                  </div>
                );
              })}
            </div>
            {(frequencia?.streak ?? 0) > 0 && (
              <p className="mt-3 text-sm font-bold text-foreground">
                {frequencia!.streak} semana{frequencia!.streak > 1 ? "s" : ""} seguida{frequencia!.streak > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 6. Incluso no seu plano */}
      {temPlano && (
        !liberar || consumosLoading ? (
          <section className="space-y-2">
            <SectionLabel>Incluso no seu plano</SectionLabel>
            <Skeleton h={160} />
          </section>
        ) : doPlano.length > 0 ? (
          <section className="space-y-2">
            <SectionLabel>Incluso no seu plano</SectionLabel>
            <div className={`divide-y divide-[#4A4B4B] ${cartao}`}>
              {doPlano.map((s) => {
                const { icon: Icon } = iconServico(s.atividade);
                const saldoS = s.total - s.usado;
                return (
                  <div key={s.atividade} className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-[#B1B3B3]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{s.atividade}</p>
                      <p className="text-xs text-[#B1B3B3]">
                        {s.usado} de {s.total} usados{saldoS <= 0 ? " · esgotado" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/portal/agenda")}
                      className="h-[45px] border border-[#4A4B4B] px-4 text-xs font-bold uppercase tracking-[0.08em] text-foreground"
                    >
                      Agendar
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null
      )}

      {/* Upgrade (Start) */}
      {["Start", "Start+"].includes(planoAtivo?.tipo ?? "") && (
        <section className={`space-y-3 p-4 ${cartao}`}>
          <p className="text-sm font-bold text-foreground">Turbine seu plano</p>
          <p className="text-xs text-[#B1B3B3]">
            No Power, Pro ou Max você já sai com Avaliação Funcional, Nutrição e Reabilitação incluídas no plano, sem precisar contratar à parte.
          </p>
          <button
            onClick={() =>
              window.open(
                "https://wa.me/555135199451?text=" + encodeURIComponent("Olá. Quero saber mais sobre fazer upgrade do meu plano."),
                "_blank",
              )
            }
            className={`${btnFilete} w-full`}
          >
            Conhecer planos superiores
          </button>
        </section>
      )}

      {/* Serviços contratados à parte */}
      {liberar && doAvulso.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Serviços contratados à parte</SectionLabel>
          <div className={`divide-y divide-[#4A4B4B] ${cartao}`}>
            {doAvulso.map((s: any) => {
              const saldoS = s.ilimitado ? Infinity : s.quantidade_inicial - s.quantidade_usada;
              const { icon: Icon } = iconServico(s.atividade);
              const venda = s.origem_id ? vendasMap.get(s.origem_id) : null;
              const nome = venda?.nome_snapshot || s.atividade;
              const dataCompra = venda?.data_venda ? new Date(venda.data_venda + "T12:00:00").toLocaleDateString("pt-BR") : null;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="h-4 w-4 shrink-0 text-[#B1B3B3]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
                    <p className="text-xs text-[#B1B3B3]">
                      {s.ilimitado
                        ? "Ilimitado"
                        : `${s.quantidade_usada} de ${s.quantidade_inicial} usados${saldoS <= 0 ? " · esgotado" : ""}`}
                      {dataCompra ? ` · comprado em ${dataCompra}` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#B1B3B3]">Avulso</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7. Diagnóstico funcional */}
      {!liberar || avaliacoesQ.isLoading ? (
        <section className="space-y-2">
          <SectionLabel>Diagnóstico funcional</SectionLabel>
          <Skeleton h={120} />
        </section>
      ) : avaliacaoResume ? (
        <section className="space-y-2">
          <SectionLabel>Diagnóstico funcional</SectionLabel>
          <Link to="/portal/avaliacoes" className={`block space-y-3 p-4 ${cartao}`}>
            <p className="text-xs text-[#B1B3B3]">
              {precisaReavaliar ? "Hora de reavaliar · " : ""}
              {mesesDesde === 0 ? "Avaliado este mês" : `Avaliado há ${mesesDesde} ${mesesDesde === 1 ? "mês" : "meses"}`}
              {` · ${resumoAvaliacao.pontos} ponto${resumoAvaliacao.pontos === 1 ? "" : "s"} de atenção`}
            </p>
            <div className="flex flex-wrap gap-2">
              {[selosAvaliacao.atencao, selosAvaliacao.equilibrado].map((selo) => (
                <span
                  key={selo.titulo}
                  className="inline-flex min-h-[44px] max-w-full items-center gap-2 border border-[#4A4B4B] px-3 text-xs"
                >
                  <span className={`font-bold uppercase tracking-[0.08em] ${nivelChip[selo.nivel].cor}`}>
                    {nivelChip[selo.nivel].rotulo}
                  </span>
                  <span className="truncate text-foreground">{selo.texto}</span>
                </span>
              ))}
            </div>
            <p className="flex items-center text-xs font-semibold text-foreground">
              Ver evolução <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </p>
          </Link>
        </section>
      ) : null}

      {/* Desafios coletivos (abaixo da dobra) */}
      {liberar && desafiosAtivos.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Desafios coletivos</SectionLabel>
          {desafiosAtivos.map((d: any) => {
            const pct = Math.min(100, Math.round((d.progresso_atual / d.valor_meta) * 100));
            const diasRestantes = Math.max(0, Math.ceil((new Date(d.data_fim).getTime() - Date.now()) / 86400000));
            const faltam = d.valor_meta - d.progresso_atual;
            return (
              <div key={d.id} className={`space-y-3 p-4 ${cartao}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-black text-foreground">{d.titulo}</p>
                    {d.descricao && <p className="mt-0.5 text-xs text-[#B1B3B3]">{d.descricao}</p>}
                  </div>
                  <p className="text-lg font-black text-foreground">{pct}%</p>
                </div>
                <div className="h-1 bg-[#4A4B4B]">
                  <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-[#B1B3B3]">
                  <span>{faltam > 0 ? `Faltam ${faltam.toLocaleString("pt-BR")} para a meta` : "Meta atingida"}</span>
                  <span>{diasRestantes > 0 ? `${diasRestantes} dias restantes` : "Último dia"}</span>
                </div>
                {d.pontos_recompensa > 0 && (
                  <p className="text-xs text-[#B1B3B3]">
                    Ao atingir a meta, todos os alunos ativos recebem {d.pontos_recompensa} pontos no Clube FORTEM.
                  </p>
                )}
                {d.mensagem_recompensa && <p className="text-xs text-[#B1B3B3]">{d.mensagem_recompensa}</p>}
              </div>
            );
          })}
        </section>
      )}

      {/* 8. Assistente */}
      <Link to="/portal/assistente" className={`flex min-h-[56px] items-center gap-3 px-4 ${cartao}`}>
        <MessageCircle className="h-4 w-4 text-[#B1B3B3]" />
        <span className="flex-1 text-sm font-semibold text-foreground">Assistente Fortem</span>
        <ChevronRight className="h-4 w-4 text-[#B1B3B3]" />
      </Link>
    </div>
  );
}
