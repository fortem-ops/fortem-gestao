import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { useAlunoAvaliacoesConsolidadas } from "@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas";
import { FuncionalV2Viewer } from "@/components/student/assessment/funcionalV2/FuncionalV2Viewer";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, AlertCircle, ArrowRight, CalendarCheck, ChevronDown, ChevronUp, ClipboardCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

const MESES_IDEAL_REAVALIAR = 4; // periodicidade recomendada

export default function PortalAssessments() {
  const { student } = useStudentPortal();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: consolidado, isLoading } = useAlunoAvaliacoesConsolidadas(student?.id);

  // Buscar avaliações raw para histórico completo
  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["portal-avaliacoes-raw", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", student!.id)
        .in("tipo", ["funcional_v2", "funcional", "composicao_corporal", "pliometria"])
        .order("data", { ascending: false });
      return (data || []) as Tables<"avaliacoes">[];
    },
  });

  if (!student) return null;

  const funcional = consolidado?.funcional;
  const composicao = consolidado?.composicao;
  const ultimaFuncional = funcional?.latest;
  const ultimaComposicao = composicao?.latest;

  // Calcular status de reavaliação
  const diasDesdeUltimaFuncional = ultimaFuncional
    ? differenceInDays(new Date(), parseISO(ultimaFuncional.data))
    : null;
  const mesesDesde = diasDesdeUltimaFuncional !== null
    ? Math.floor(diasDesdeUltimaFuncional / 30)
    : null;
  const precisaReavaliar = mesesDesde !== null && mesesDesde >= MESES_IDEAL_REAVALIAR;
  const proximaReavaliacao = mesesDesde !== null
    ? Math.max(0, MESES_IDEAL_REAVALIAR - mesesDesde)
    : null;

  return (
    <div className="space-y-5 animate-fade-in pb-32">

      {/* ── HEADER ── */}
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Avaliação Funcional</p>
        <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
          Seu diagnóstico corporal
        </h1>
      </div>

      {/* ── CARD DE STATUS / CTA ── */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-2xl p-5 animate-pulse h-28" />
      ) : !ultimaFuncional ? (
        /* Sem nenhuma avaliação */
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                Você ainda não tem avaliação funcional
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A avaliação funcional identifica suas limitações de mobilidade, assimetrias e força — o ponto de partida para um treino realmente personalizado.
              </p>
            </div>
          </div>
          <Link to="/portal/agenda">
            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold" style={{fontFamily:'Archivo,sans-serif'}}>
              Agendar avaliação funcional <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      ) : precisaReavaliar ? (
        /* Hora de reavaliar */
        <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                Hora de comparar sua evolução!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sua última avaliação foi há <strong className="text-foreground">{mesesDesde} {mesesDesde === 1 ? 'mês' : 'meses'}</strong>. 
                Reavalie e veja o quanto você evoluiu desde então.
              </p>
            </div>
          </div>
          <Link to="/portal/agenda">
            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold" style={{fontFamily:'Archivo,sans-serif'}}>
              Agendar reavaliação <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        /* Em dia */
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
              Avaliação em dia
            </p>
            <p className="text-xs text-muted-foreground">
              Próxima reavaliação em aproximadamente <strong className="text-foreground">{proximaReavaliacao} {proximaReavaliacao === 1 ? 'mês' : 'meses'}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── AVALIAÇÃO FUNCIONAL V2 ── */}
      {ultimaFuncional && (() => {
        // Encontrar o row raw da avaliação funcional mais recente
        const rowFuncional = avaliacoes.find(a => 
          (a.tipo === 'funcional_v2' || a.tipo === 'funcional') && 
          a.data === ultimaFuncional.data
        );
        if (!rowFuncional) return null;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Última avaliação · {format(parseISO(ultimaFuncional.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto -mx-3">
                <div className="min-w-[320px] px-3">
                  <FuncionalV2Viewer avaliacao={rowFuncional} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── COMPOSIÇÃO CORPORAL ── */}
      {ultimaComposicao && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Composição Corporal
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="% Gordura" value={`${ultimaComposicao.bf.toFixed(1)}%`} sub={ultimaComposicao.classificacao} tone="warn" />
            <MetricCard label="Massa Magra" value={ultimaComposicao.massaMagra ? `${ultimaComposicao.massaMagra.toFixed(1)} kg` : "—"} tone="good" />
            <MetricCard label="Peso" value={`${ultimaComposicao.peso} kg`} />
            <MetricCard label="IMC" value={ultimaComposicao.imc ? ultimaComposicao.imc.toFixed(1) : "—"} />
          </div>
          {composicao.history.length >= 2 && (
            <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                Você tem <strong className="text-foreground">{composicao.history.length} medições</strong> de composição corporal registradas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── HISTÓRICO COMPLETO ── */}
      {avaliacoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Histórico de avaliações
          </p>
          {avaliacoes.map((a) => {
            const isExpanded = expandedId === a.id;
            const isFuncionalV2 = a.tipo === 'funcional_v2' || a.tipo === 'funcional';
            const tipoLabel: Record<string, string> = {
              funcional_v2: 'Avaliação Funcional',
              funcional: 'Avaliação Funcional',
              composicao_corporal: 'Composição Corporal',
              pliometria: 'Pliometria',
              forca: 'Força',
            };
            return (
              <div key={a.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate" style={{fontFamily:'Archivo,sans-serif'}}>
                      {tipoLabel[a.tipo] || a.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(a.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {isFuncionalV2 ? (
                    isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )
                  ) : null}
                </button>
                {isExpanded && isFuncionalV2 && (
                  <div className="border-t border-border p-3">
                    <div className="overflow-x-auto -mx-3">
                      <div className="min-w-[320px] px-3">
                        <FuncionalV2Viewer avaliacao={a} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CTA FINAL ── */}
      <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-3">
        <p className="text-sm font-bold text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
          Avaliações periódicas = treino mais eficiente
        </p>
        <p className="text-xs text-muted-foreground">
          Recomendamos reavaliar a cada 4 a 6 meses para ajustar seu programa e celebrar sua evolução.
        </p>
        <Link to="/portal/agenda">
          <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 font-semibold text-sm w-full" style={{fontFamily:'Archivo,sans-serif'}}>
            Agendar avaliação <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'risk' }) {
  const valueColor = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'risk' ? 'text-rose-400' : 'text-foreground';
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-black ${valueColor}`} style={{fontFamily:'Archivo,sans-serif'}}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
