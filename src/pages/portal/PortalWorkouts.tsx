import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dumbbell, Play, CheckCircle2, RefreshCw, History,
  ChevronDown, ChevronUp, X, Loader2, Calendar
} from "lucide-react";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";

// ── Tipos ──────────────────────────────────────────────────────────────
interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

// ── Helper: calcular variação atual ───────────────────────────────────
function calcVariacaoAtual(
  totalSessoes: number,
  numVariacoes: number,
  semanas: number
): { variacaoIdx: number; variacaoLabel: string; sessoesNestaVariacao: number; sessoesRestantes: number } {
  // Cada variação se repete `semanas` vezes
  // Progresso linear: T1(semanas vezes) → T2(semanas vezes) → ...
  const cicloTotal = numVariacoes * semanas;
  const posNoCiclo = totalSessoes % cicloTotal;
  const variacaoIdx = Math.floor(posNoCiclo / semanas);
  const sessoesNestaVariacao = posNoCiclo % semanas;
  const sessoesRestantes = semanas - sessoesNestaVariacao;

  return {
    variacaoIdx,
    variacaoLabel: `T${variacaoIdx + 1}`,
    sessoesNestaVariacao,
    sessoesRestantes,
  };
}

// ── Helper: filtrar aquecimento pelo dia ──────────────────────────────
function filterAquecimento(exercises: WorkoutExercise[], dia: string): WorkoutExercise[] {
  return exercises.filter(ex => !ex.dias || ex.dias.length === 0 || ex.dias.includes(dia));
}

// ── Componente principal ───────────────────────────────────────────────
export default function PortalWorkouts() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();

  const [expandedBloco, setExpandedBloco] = useState<string | null>("aquecimento");
  const [exModal, setExModal] = useState<WorkoutExercise | null>(null);
  const [showTrocar, setShowTrocar] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showConcluir, setShowConcluir] = useState(false);
  const [cargas, setCargas] = useState<Record<string, string>>({});
  const [variacaoTrocada, setVariacaoTrocada] = useState<string | null>(null);

  // Query: treino ativo
  const { data: treino, isLoading: loadingTreino } = useQuery({
    queryKey: ["portal-treino-ativo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("treinos")
        .select("id, descricao, versao, conteudo, semanas, status")
        .eq("aluno_id", student!.id)
        .eq("status", "atual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Query: agendamento de hoje
  const { data: agendamentoHoje } = useQuery({
    queryKey: ["portal-agendamento-hoje", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("treino_agendamentos")
        .select("id, horario_inicio, horario_fim, status")
        .eq("aluno_id", student!.id)
        .eq("data", hoje)
        .in("status", ["agendado", "confirmado", "realizado"])
        .order("horario_inicio")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Query: sessões realizadas deste treino
  const { data: sessoes = [] } = useQuery({
    queryKey: ["portal-treino-sessoes", student?.id, treino?.id],
    enabled: !!student && !!treino?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_sessoes")
        .select("id, variacao, variacao_original, foi_troca, data, concluido_em")
        .eq("aluno_id", student!.id)
        .eq("treino_id", treino!.id)
        .not("concluido_em", "is", null)
        .order("concluido_em", { ascending: false });
      return data || [];
    },
  });

  // Query: cargas salvas
  const { data: cargasSalvas = [] } = useQuery({
    queryKey: ["portal-treino-cargas", student?.id, treino?.id],
    enabled: !!student && !!treino?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_cargas")
        .select("exercicio_nome, kg")
        .eq("aluno_id", student!.id)
        .eq("treino_id", treino!.id);
      return data || [];
    },
  });

  // Popular estado de cargas com valores salvos
  useEffect(() => {
    const initial: Record<string, string> = {};
    cargasSalvas.forEach((c: any) => { initial[c.exercicio_nome] = c.kg || ""; });
    setCargas(prev => ({ ...initial, ...prev }));
  }, [cargasSalvas]);

  // Calcular dados derivados
  const workout = useMemo((): WorkoutData | null => {
    if (!treino?.conteudo) return null;
    return treino.conteudo as unknown as WorkoutData;
  }, [treino]);

  const numVariacoes = workout?.treinos.length ?? 4;
  const semanas = (treino as any)?.semanas ?? 4;
  const totalSessoes = sessoes.length;

  const { variacaoIdx, variacaoLabel, sessoesNestaVariacao, sessoesRestantes } = useMemo(
    () => calcVariacaoAtual(totalSessoes, numVariacoes, semanas),
    [totalSessoes, numVariacoes, semanas]
  );

  const variacaoAtual = variacaoTrocada ?? variacaoLabel;
  const isTrocada = !!variacaoTrocada && variacaoTrocada !== variacaoLabel;

  // Treino do dia filtrado
  const treinoIdx = parseInt(variacaoAtual.replace("T", "")) - 1;
  const treinoHoje = workout?.treinos[treinoIdx] ?? workout?.treinos[0];
  const aquecimentoHoje = useMemo(
    () => filterAquecimento(workout?.aquecimento || [], variacaoAtual),
    [workout?.aquecimento, variacaoAtual]
  );

  // Verificar se já fez treino hoje
  const hoje = format(new Date(), "yyyy-MM-dd");
  const jaConcluiuHoje = sessoes.some((s: any) => s.data === hoje);

  // Mutation: salvar carga
  const salvarCarga = useMutation({
    mutationFn: async ({ exercicio, kg }: { exercicio: string; kg: string }) => {
      const { error } = await (supabase as any)
        .from("treino_cargas")
        .upsert({
          aluno_id: student!.id,
          treino_id: treino!.id,
          exercicio_nome: exercicio,
          kg,
          updated_at: new Date().toISOString(),
        }, { onConflict: "aluno_id,treino_id,exercicio_nome" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-treino-cargas"] }),
  });

  // Mutation: concluir treino
  const concluir = useMutation({
    mutationFn: async () => {
      if (!student || !treino) throw new Error("Dados inválidos");

      // Salvar todas as cargas alteradas
      const cargasEntries = Object.entries(cargas).filter(([, v]) => v);
      await Promise.all(
        cargasEntries.map(([exercicio, kg]) =>
          (supabase as any).from("treino_cargas").upsert({
            aluno_id: student.id,
            treino_id: treino.id,
            exercicio_nome: exercicio,
            kg,
            updated_at: new Date().toISOString(),
          }, { onConflict: "aluno_id,treino_id,exercicio_nome" })
        )
      );

      // Registrar sessão
      const { error } = await (supabase as any).from("treino_sessoes").insert({
        aluno_id: student.id,
        treino_id: treino.id,
        variacao: variacaoAtual,
        variacao_original: isTrocada ? variacaoLabel : null,
        foi_troca: isTrocada,
        agendamento_id: agendamentoHoje?.id ?? null,
        data: hoje,
        concluido_em: new Date().toISOString(),
      });
      if (error) throw error;

      // Confirmar presença no agendamento se existir
      if (agendamentoHoje?.id && agendamentoHoje.status !== "realizado") {
        await supabase
          .from("treino_agendamentos")
          .update({ status: "realizado", updated_at: new Date().toISOString() })
          .eq("id", agendamentoHoje.id);
      }
    },
    onSuccess: () => {
      toast.success("Treino concluído! 💪 Continue assim!");
      setShowConcluir(false);
      setVariacaoTrocada(null);
      qc.invalidateQueries({ queryKey: ["portal-treino-sessoes"] });
      qc.invalidateQueries({ queryKey: ["portal-agendamento-hoje"] });
      qc.invalidateQueries({ queryKey: ["portal-streak-real"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao concluir treino"),
  });

  if (!student) return null;

  if (loadingTreino) {
    return (
      <div className="space-y-4 pb-28 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="h-32 bg-muted rounded-2xl animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!treino || !workout) {
    return (
      <div className="space-y-5 pb-28 animate-fade-in">
        <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Meu Treino</h1>
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#2C2C2C] flex items-center justify-center mx-auto">
            <Dumbbell className="w-7 h-7 text-primary" />
          </div>
          <p className="font-bold text-sm text-foreground">Nenhum treino prescrito</p>
          <p className="text-xs text-muted-foreground">Fale com seu professor para liberar seu treino personalizado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Treino Personalizado</p>
          <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
            {variacaoAtual}
            {isTrocada && <span className="text-xs font-normal text-warning ml-2">(trocado)</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistorico(true)}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center"
          >
            <History className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowTrocar(true)}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center"
            title="Trocar treino do dia"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── CARD DE STATUS ── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
              {treino.descricao?.trim() || "Treino Personalizado"}
            </p>
            <p className="text-xs text-muted-foreground">v{treino.versao}</p>
          </div>
          {agendamentoHoje && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
              <Calendar className="w-3 h-3" />
              {agendamentoHoje.horario_inicio?.slice(0,5)}
            </div>
          )}
        </div>

        {/* Progresso desta variação */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{variacaoAtual} — {sessoesNestaVariacao} de {semanas} sessões</span>
            <span>{sessoesRestantes} restante{sessoesRestantes !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(sessoesNestaVariacao / semanas) * 100}%` }}
            />
          </div>
        </div>

        {/* Botão concluir */}
        {jaConcluiuHoje ? (
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Treino concluído hoje!
          </div>
        ) : (
          <button
            onClick={() => setShowConcluir(true)}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2"
            style={{fontFamily:'Archivo,sans-serif'}}
          >
            <CheckCircle2 className="w-4 h-4" />
            Concluir treino
          </button>
        )}
      </div>

      {/* ── AQUECIMENTO ── */}
      {aquecimentoHoje.length > 0 && (
        <BlocoCard
          titulo="Aquecimento"
          subtitulo={`${aquecimentoHoje.length} exercícios · ${variacaoAtual}`}
          exercicios={aquecimentoHoje}
          cargas={cargas}
          onCargaChange={(nome, kg) => setCargas(prev => ({ ...prev, [nome]: kg }))}
          onCargaBlur={(nome, kg) => salvarCarga.mutate({ exercicio: nome, kg })}
          onExercicioClick={setExModal}
          expanded={expandedBloco === "aquecimento"}
          onToggle={() => setExpandedBloco(expandedBloco === "aquecimento" ? null : "aquecimento")}
          isAquecimento
        />
      )}

      {/* ── BLOCOS DO TREINO ── */}
      {treinoHoje && (
        <TreinoBlocos
          treino={treinoHoje}
          cargas={cargas}
          onCargaChange={(nome, kg) => setCargas(prev => ({ ...prev, [nome]: kg }))}
          onCargaBlur={(nome, kg) => salvarCarga.mutate({ exercicio: nome, kg })}
          onExercicioClick={setExModal}
          expandedBloco={expandedBloco}
          onToggleBloco={setExpandedBloco}
        />
      )}

      {/* ── MODAL: EXERCÍCIO ── */}
      {exModal && (
        <ExerciseModal exercise={exModal} onClose={() => setExModal(null)} />
      )}

      {/* ── BOTTOM SHEET: TROCAR TREINO ── */}
      {showTrocar && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowTrocar(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-2" />
            <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
              Trocar treino do dia
            </p>
            <p className="text-xs text-muted-foreground">
              Selecione outra variação. O treino será registrado com a variação escolhida e a sequência continuará normalmente.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {workout.treinos.map((_, i) => {
                const label = `T${i + 1}`;
                const isAtual = label === variacaoLabel;
                const isSelecionado = label === (variacaoTrocada ?? variacaoLabel);
                return (
                  <button
                    key={label}
                    onClick={() => { setVariacaoTrocada(label === variacaoLabel ? null : label); setShowTrocar(false); }}
                    className={`py-3 rounded-xl font-bold text-sm transition-colors ${
                      isSelecionado
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {label}
                    {isAtual && <span className="block text-[9px] font-normal opacity-70">sugerido</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowTrocar(false)} className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET: CONCLUIR ── */}
      {showConcluir && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowConcluir(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-2" />
            <p className="font-black text-lg text-foreground text-center" style={{fontFamily:'Archivo,sans-serif'}}>
              Concluir {variacaoAtual}?
            </p>
            {isTrocada && (
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 text-xs text-warning text-center">
                Você está concluindo {variacaoAtual} (trocado de {variacaoLabel})
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Suas cargas serão salvas e a presença confirmada automaticamente.
            </p>
            {agendamentoHoje && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400 text-center">
                ✓ Presença confirmada no agendamento das {agendamentoHoje.horario_inicio?.slice(0,5)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowConcluir(false)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">
                Cancelar
              </button>
              <button
                onClick={() => concluir.mutate()}
                disabled={concluir.isPending}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {concluir.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar 💪"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET: HISTÓRICO ── */}
      {showHistorico && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowHistorico(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Histórico de Treinos</p>
              <button onClick={() => setShowHistorico(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Grade por variação */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {workout.treinos.map((_, i) => {
                const label = `T${i + 1}`;
                const sessoesVariacao = sessoes.filter((s: any) => s.variacao === label);
                const pct = Math.round((sessoesVariacao.length / semanas) * 100);
                return (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${label === variacaoLabel ? "text-primary" : "text-foreground"}`} style={{fontFamily:'Archivo,sans-serif'}}>{label}</span>
                        {label === variacaoLabel && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Atual</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{sessoesVariacao.length}/{semanas}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${label === variacaoLabel ? "bg-primary" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: semanas }).map((_, j) => {
                        const sessao = sessoesVariacao[j];
                        return (
                          <div
                            key={j}
                            className={`flex-1 min-w-[60px] py-2 px-1 rounded-xl border text-center ${
                              sessao
                                ? "bg-emerald-500/10 border-emerald-500/20"
                                : label === variacaoLabel && j === sessoesVariacao.length
                                ? "bg-primary/10 border-primary/30"
                                : "bg-muted/30 border-border"
                            }`}
                          >
                            {sessao ? (
                              <>
                                <p className="text-[10px] font-bold text-emerald-400">✓</p>
                                <p className="text-[9px] text-muted-foreground">{format(parseISO(sessao.data + "T12:00:00"), "dd/MM", {locale: ptBR})}</p>
                                {sessao.foi_troca && <p className="text-[8px] text-warning">↕ {sessao.variacao_original}</p>}
                              </>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">{label === variacaoLabel && j === sessoesVariacao.length ? "→" : "○"}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Componente: BlocoCard ─────────────────────────────────────────────
function BlocoCard({
  titulo, subtitulo, exercicios, cargas, onCargaChange, onCargaBlur, onExercicioClick, expanded, onToggle, isAquecimento = false
}: {
  titulo: string; subtitulo?: string;
  exercicios: WorkoutExercise[];
  cargas: Record<string, string>;
  onCargaChange: (nome: string, kg: string) => void;
  onCargaBlur: (nome: string, kg: string) => void;
  onExercicioClick: (ex: WorkoutExercise) => void;
  expanded: boolean; onToggle: () => void;
  isAquecimento?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={onToggle}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isAquecimento ? "bg-amber-500/10" : "bg-primary/10"}`}>
          <Dumbbell className={`w-4 h-4 ${isAquecimento ? "text-amber-400" : "text-primary"}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{titulo}</p>
          {subtitulo && <p className="text-[11px] text-muted-foreground">{subtitulo}</p>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {exercicios.map((ex, idx) => (
            <ExercicioRow
              key={idx}
              ex={ex}
              carga={cargas[ex.exercicio] || ""}
              onCargaChange={(kg) => onCargaChange(ex.exercicio, kg)}
              onCargaBlur={(kg) => onCargaBlur(ex.exercicio, kg)}
              onClick={() => onExercicioClick(ex)}
              isAquecimento={isAquecimento}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente: TreinoBlocos ──────────────────────────────────────────
function TreinoBlocos({ treino, cargas, onCargaChange, onCargaBlur, onExercicioClick, expandedBloco, onToggleBloco }: {
  treino: { nome: string; exercicios: WorkoutExercise[] };
  cargas: Record<string, string>;
  onCargaChange: (nome: string, kg: string) => void;
  onCargaBlur: (nome: string, kg: string) => void;
  onExercicioClick: (ex: WorkoutExercise) => void;
  expandedBloco: string | null;
  onToggleBloco: (key: string | null) => void;
}) {
  // Dividir em blocos A e B (0-1 = A, 2+ = B)
  const blocoA = treino.exercicios.slice(0, 2);
  const blocoB = treino.exercicios.slice(2);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{treino.nome}</p>
      {blocoA.length > 0 && (
        <BlocoCard
          titulo="Bloco A"
          subtitulo={`${blocoA.length} exercícios`}
          exercicios={blocoA}
          cargas={cargas}
          onCargaChange={onCargaChange}
          onCargaBlur={onCargaBlur}
          onExercicioClick={onExercicioClick}
          expanded={expandedBloco === "blocoA"}
          onToggle={() => onToggleBloco(expandedBloco === "blocoA" ? null : "blocoA")}
        />
      )}
      {blocoB.length > 0 && (
        <BlocoCard
          titulo="Bloco B"
          subtitulo={`${blocoB.length} exercícios`}
          exercicios={blocoB}
          cargas={cargas}
          onCargaChange={onCargaChange}
          onCargaBlur={onCargaBlur}
          onExercicioClick={onExercicioClick}
          expanded={expandedBloco === "blocoB"}
          onToggle={() => onToggleBloco(expandedBloco === "blocoB" ? null : "blocoB")}
        />
      )}
    </div>
  );
}

// ── Componente: ExercicioRow ──────────────────────────────────────────
function ExercicioRow({ ex, carga, onCargaChange, onCargaBlur, onClick, isAquecimento }: {
  ex: WorkoutExercise;
  carga: string;
  onCargaChange: (kg: string) => void;
  onCargaBlur: (kg: string) => void;
  onClick: () => void;
  isAquecimento?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onClick}
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ex.video_url ? "bg-primary/10" : "bg-muted"}`}
      >
        <Play className={`w-4 h-4 ${ex.video_url ? "text-primary" : "text-muted-foreground"}`} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{ex.exercicio}</p>
        <p className="text-[11px] text-muted-foreground">
          {ex.categoria && `${ex.categoria} · `}{ex.series}×{ex.repeticoes}
        </p>
      </div>
      {!isAquecimento && (
        <div className="shrink-0">
          <input
            type="text"
            value={carga}
            onChange={e => onCargaChange(e.target.value)}
            onBlur={e => onCargaBlur(e.target.value)}
            placeholder="kg"
            className="w-14 text-center text-xs font-bold bg-muted border border-border rounded-lg px-1 py-1.5 text-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
      )}
    </div>
  );
}

// ── Componente: ExerciseModal ─────────────────────────────────────────
function ExerciseModal({ exercise, onClose }: { exercise: WorkoutExercise; onClose: () => void }) {
  const embed = exercise.video_url ? getYouTubeEmbedUrl(exercise.video_url) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div className="bg-card border-t border-border rounded-t-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4" />
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{exercise.exercicio}</p>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {embed ? (
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
              <iframe src={embed} title={exercise.exercicio} allowFullScreen className="w-full h-full" />
            </div>
          ) : exercise.video_url ? (
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
              <video src={exercise.video_url} controls className="w-full h-full" />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-2">
              <Play className="w-8 h-8 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">Sem vídeo disponível</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Séries</p>
              <p className="text-lg font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{exercise.series || "—"}</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Reps</p>
              <p className="text-lg font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{exercise.repeticoes || "—"}</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cat.</p>
              <p className="text-sm font-bold text-foreground">{exercise.categoria || "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
