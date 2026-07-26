import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  computeWave as compute531Wave,
  trainingMax as tm531,
  acessorioKg as accKg531,
  roundToNearest2_5 as round531,
  LEVANTAMENTO_EXERCICIO_BASE,
  type Wendler531Conteudo,
} from "@/lib/wendler531";
import {
  isM102,
  slotStatus,
  testSession,
  rmForLevantamento,
  kgFor,
  pairOf,
  M102_SLOT_LEVANTAMENTOS,
  M102_LEV_BASE,
  type M102Conteudo,
  type M102Slot,
} from "@/lib/m102";
import {
  Play, CheckCircle2, ChevronDown, ChevronUp, History,
  AlertCircle, Loader2, RefreshCw, X, PlayCircle
} from "lucide-react";

// Helper: limpar nome do exercício (remove prefixos numéricos)
function cleanName(name: string): string {
  return (name ?? "").replace(/^\s*\d+\s*[-–—.)]\s*/, "").trim();
}

// Helper: label da categoria do aquecimento
function catLabel(cat: string): string {
  const map: Record<string, string> = {
    LIB: "Liberação", MOB: "Mobilidade", ATI: "Ativação", PREV: "Preventivo"
  };
  return map[cat] ?? cat;
}

// Helper: dividir exercícios em blocos usando a marcação blocoStart
function dividirEmBlocos(exercicios: any[]): { label: string; items: any[] }[] {
  if (exercicios.length === 0) return [];

  const blocos: { label: string; items: any[] }[] = [];
  let blocoAtual: any[] = [];
  let letraIdx = 0;
  const letras = ["A", "B", "C", "D", "E"];

  exercicios.forEach((ex, i) => {
    if (i > 0 && ex.blocoStart) {
      if (blocoAtual.length > 0) {
        blocos.push({ label: letras[letraIdx] ?? String(letraIdx + 1), items: blocoAtual });
        letraIdx++;
        blocoAtual = [];
      }
    }
    blocoAtual.push(ex);
  });

  if (blocoAtual.length > 0) {
    blocos.push({ label: letras[letraIdx] ?? String(letraIdx + 1), items: blocoAtual });
  }

  // Fallback: se não há blocoStart definido, dividir em A (0-1) e B (2+)
  if (blocos.length === 1 && exercicios.length > 2) {
    return [
      { label: "A", items: exercicios.slice(0, 2) },
      { label: "B", items: exercicios.slice(2) },
    ];
  }

  return blocos;
}


export default function PortalWorkouts() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────
  const { data: treino, isLoading: treinoLoading } = useQuery({
    queryKey: ["portal-treino-ativo", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("treinos")
        .select("id, descricao, versao, semanas, conteudo, status, template_fase")
        .eq("aluno_id", student!.id)
        .eq("status", "atual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

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
        .order("data", { ascending: true });
      return data || [];
    },
  });

  const { data: cargas = [] } = useQuery({
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

  const { data: agendamentoHoje } = useQuery({
    queryKey: ["portal-treino-agendamento-hoje", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("treino_agendamentos")
        .select("id, horario_inicio, horario_fim, status")
        .eq("aluno_id", student!.id)
        .eq("data", hoje)
        .in("status", ["agendado", "confirmado"])
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ── Estado local ─────────────────────────────────────────────
  const [variacaoSelecionada, setVariacaoSelecionada] = useState<string | null>(null);
  const [mostrarTrocar, setMostrarTrocar] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [cargasEditaveis, setCargasEditaveis] = useState<Record<string, string>>({});
  const [concluindo, setConcluindo] = useState(false);
  const [concluido, setConcluido] = useState(false);

  // Popular cargas ao carregar
  useEffect(() => {
    if (cargas.length > 0) {
      const mapa: Record<string, string> = {};
      cargas.forEach((c: any) => { mapa[c.exercicio_nome] = c.kg ?? ""; });
      setCargasEditaveis(mapa);
    }
  }, [cargas]);

  if (!student) return null;

  // ── 5-3-1 (Wendler): renderização dedicada ─────────────────
  if (
    treino &&
    ((treino as any).template_fase === "5-3-1" || (treino.conteudo as any)?.variante === "531")
  ) {
    return <Portal531View treino={treino} />;
  }

  // ── M102: renderização dedicada ─────────────────────────────
  if (
    treino &&
    ((treino as any).template_fase === "M102" || isM102(treino.conteudo))
  ) {
    return <PortalM102View treino={treino} sessoes={sessoes} />;
  }

  // ── Cálculos de progressão ───────────────────────────────────
  const conteudo = (treino?.conteudo as any) ?? null;
  const numVariacoes = conteudo?.treinos?.length ?? 4;
  const semanas = (treino as any)?.semanas ?? 4;
  const totalSessoes = sessoes.length;
  const sessaoAtual = totalSessoes + 1;
  const variacaoIdx = totalSessoes % numVariacoes; // rotação simples: T1→T2→T3→T4→T1→...
  const variacaoAtual = `T${variacaoIdx + 1}`;
  const totalSessoesPrevistas = numVariacoes * semanas; // 4 × 5 = 20 sessões
  const variacaoExibida = variacaoSelecionada ?? variacaoAtual;
  const treinoIdx = parseInt(variacaoExibida.replace("T", "")) - 1;
  const treinoAtual = conteudo?.treinos?.[treinoIdx];
  const foiTrocado = variacaoSelecionada !== null && variacaoSelecionada !== variacaoAtual;

  // Aquecimento filtrado para a variação atual
  const aquecimentoFiltrado = (conteudo?.aquecimento ?? []).filter(
    (ex: any) => !ex.dias || ex.dias.length === 0 || ex.dias.includes(variacaoExibida)
  );

  // Blocos do treino atual
  const exercicios = treinoAtual?.exercicios ?? [];


  // Progresso por variação para o histórico
  const progressoPorVariacao = Array.from({ length: numVariacoes }, (_, i) => {
    const v = `T${i + 1}`;
    const realizados = sessoes.filter((s: any) => s.variacao === v);
    return { variacao: v, realizados, total: semanas };
  });

  // ── Salvar carga individual ──────────────────────────────────
  async function salvarCarga(exercicioNome: string, kg: string) {
    if (!treino || !student) return;
    await (supabase as any).from("treino_cargas").upsert({
      aluno_id: student.id,
      treino_id: treino.id,
      exercicio_nome: exercicioNome,
      kg,
      updated_at: new Date().toISOString(),
    }, { onConflict: "aluno_id,treino_id,exercicio_nome" });
  }

  // ── Concluir treino ──────────────────────────────────────────
  async function handleConcluir() {
    if (!treino || !student) return;
    if (!agendamentoHoje) {
      toast.error("Você precisa ter um treino agendado para hoje para concluir.");
      return;
    }
    setConcluindo(true);
    try {
      // Salvar todas as cargas editadas
      const promises = Object.entries(cargasEditaveis)
        .filter(([, kg]) => kg !== "")
        .map(([nome, kg]) => salvarCarga(nome, kg));
      await Promise.all(promises);

      // Registrar sessão
      const { error } = await (supabase as any).from("treino_sessoes").insert({
        aluno_id: student.id,
        treino_id: treino.id,
        variacao: variacaoExibida,
        variacao_original: foiTrocado ? variacaoAtual : null,
        foi_troca: foiTrocado,
        agendamento_id: agendamentoHoje.id,
        data: format(new Date(), "yyyy-MM-dd"),
        concluido_em: new Date().toISOString(),
      });
      if (error) throw error;

      // Confirmar presença no agendamento
      await supabase.from("treino_agendamentos")
        .update({ status: "realizado", updated_at: new Date().toISOString() })
        .eq("id", agendamentoHoje.id);

      // Invalidar queries
      qc.invalidateQueries({ queryKey: ["portal-treino-sessoes"] });
      qc.invalidateQueries({ queryKey: ["portal-treino-agendamento-hoje"] });
      qc.invalidateQueries({ queryKey: ["portal-streak-real"] });
      qc.invalidateQueries({ queryKey: ["portal-meus-agendamentos"] });

      setVariacaoSelecionada(null);
      setConcluido(true);
      toast.success(`${variacaoExibida} concluído! ${foiTrocado ? "(troca registrada)" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao concluir treino.");
    } finally {
      setConcluindo(false);
    }
  }

  // ── LOADING ──────────────────────────────────────────────────
  if (treinoLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!treino || !conteudo) {
    return (
      <div className="space-y-4 pb-32 animate-fade-in px-1 pt-4">
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <p className="text-2xl">🏋️</p>
          <p className="font-bold text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
            Nenhum treino ativo
          </p>
          <p className="text-xs text-muted-foreground">
            Seu professor ainda não prescreveu um treino. Em breve ele estará disponível aqui!
          </p>
        </div>
      </div>
    );
  }

  // ── TELA DE PARABÉNS ─────────────────────────────────────────
  if (concluido) {
    // Após concluir, total de sessões agora é totalSessoes + 1
    const novaTotalSessoes = totalSessoes + 1;
    const novoVarIdx = novaTotalSessoes % numVariacoes; // próxima variação na rotação
    const novaVariacao = `T${novoVarIdx + 1}`;
    const novoTreinoIdx = novoVarIdx;
    const novoTreino = conteudo?.treinos?.[novoTreinoIdx];

    // Ciclo atual (1-based)
    const cicloAtual = Math.floor(novaTotalSessoes / numVariacoes) + 1;
    const cicloTotal = semanas;

    return (
      <div className="space-y-5 pb-32 animate-fade-in px-1 pt-4">
        <div className="bg-card border border-primary/30 rounded-2xl p-6 text-center space-y-3">
          <p className="text-4xl">🎉</p>
          <p className="font-black text-xl text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
            {variacaoExibida} concluído!
          </p>
          <p className="text-sm text-muted-foreground">
            Sessão {novaTotalSessoes} de {totalSessoesPrevistas} · Presença confirmada ✓
          </p>
          {foiTrocado && (
            <p className="text-xs text-warning">↕ Realizado fora de ordem (original: {variacaoAtual})</p>
          )}
        </div>

        {novoTreino && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próxima sessão</p>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                {novaVariacao}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  · ciclo {Math.min(cicloAtual, cicloTotal)} de {cicloTotal}
                </span>
              </p>
              <span className="text-xs text-muted-foreground">{novoTreino.nome}</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(novoTreino.exercicios ?? []).slice(0, 4).map((ex: any, i: number) => (
                <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {cleanName(ex.exercicio)}
                </span>
              ))}
              {(novoTreino.exercicios ?? []).length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{(novoTreino.exercicios ?? []).length - 4}</span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setConcluido(false)}
          className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm"
          style={{fontFamily:'Archivo,sans-serif'}}
        >
          Ver treino completo →
        </button>
      </div>
    );
  }

  // ── TELA PRINCIPAL ───────────────────────────────────────────
  return (
    <div className="space-y-4 pb-32 animate-fade-in px-1 pt-2">

      {/* Header do treino */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Treino do dia</p>
            <p className="text-2xl font-black text-foreground mt-0.5" style={{fontFamily:'Archivo,sans-serif'}}>
              {variacaoExibida}
              {foiTrocado && (
                <span className="text-sm font-normal text-warning ml-2">⚠ trocado</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Sessão {sessaoAtual} de {totalSessoesPrevistas}
              {foiTrocado && ` · original: ${variacaoAtual}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-primary" style={{fontFamily:'Archivo,sans-serif'}}>
              {Math.round((totalSessoes / totalSessoesPrevistas) * 100)}%
            </div>
            <p className="text-[10px] text-muted-foreground">concluído</p>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${Math.min(100, (totalSessoes / totalSessoesPrevistas) * 100)}%` }}
          />
        </div>

        {/* Botão trocar treino */}
        {!agendamentoHoje && (
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl p-2.5">
            <AlertCircle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning">Você precisa ter um treino agendado para hoje para concluir.</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setMostrarTrocar(!mostrarTrocar)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-semibold text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Trocar treino
            {mostrarTrocar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setMostrarHistorico(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-xs font-semibold text-foreground"
          >
            <History className="w-3.5 h-3.5" />
            Histórico
          </button>
        </div>

        {/* Seletor de variação */}
        {mostrarTrocar && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {Array.from({ length: numVariacoes }, (_, i) => {
              const v = `T${i + 1}`;
              const isAtual = v === variacaoAtual;
              const isSelecionado = v === variacaoExibida;
              const qtdRealizados = sessoes.filter((s: any) => s.variacao === v).length;
              return (
                <button
                  key={v}
                  onClick={() => { setVariacaoSelecionada(v === variacaoAtual ? null : v); setMostrarTrocar(false); }}
                  className={`flex flex-col items-center py-2 rounded-xl border text-center transition-colors ${
                    isSelecionado
                      ? "bg-primary border-primary text-white"
                      : "bg-card border-border text-foreground"
                  }`}
                >
                  <span className="text-sm font-black" style={{fontFamily:'Archivo,sans-serif'}}>{v}</span>
                  <span className="text-[9px] mt-0.5 opacity-70">{qtdRealizados}/{semanas}</span>
                  {isAtual && <span className="text-[8px] font-bold opacity-70">hoje</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* AQUECIMENTO */}
      {aquecimentoFiltrado.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
            Aquecimento
          </p>
          {(["LIB", "MOB", "ATI", "PREV"] as const).map(cat => {
            const items = aquecimentoFiltrado.filter((ex: any) => ex.categoria === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/30 border-b border-border">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {catLabel(cat)}
                  </p>
                </div>
                {items.map((ex: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{cleanName(ex.exercicio)}</p>
                      <p className="text-xs text-muted-foreground">
                        {ex.subcategoria && `${ex.subcategoria} · `}
                        {ex.series}×{ex.repeticoes}
                      </p>
                    </div>
                    {ex.video_url && (
                      <a
                        href={ex.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 text-primary" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {/* TREINO PRINCIPAL — em blocos */}
      {treinoAtual && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
            {treinoAtual.nome ?? variacaoExibida} — Força
          </p>

          {dividirEmBlocos(exercicios).map(bloco => (

            <div key={bloco.label} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Bloco {bloco.label}
                </p>
              </div>
              {bloco.items.map((ex: any, i: number) => {
                const nome = cleanName(ex.exercicio);
                const cargaAtual = cargasEditaveis[nome] ?? cargasEditaveis[ex.exercicio] ?? "";
                return (
                  <div key={i} className="px-4 py-3.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                            {ex.categoria}
                          </span>
                          <p className="text-sm font-bold text-foreground truncate">{nome}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ex.series} séries × {ex.repeticoes} reps
                        </p>
                      </div>
                      {ex.video_url && (
                        <a
                          href={ex.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
                        >
                          <Play className="w-3.5 h-3.5 text-primary" />
                        </a>
                      )}
                    </div>
                    {/* Campo de carga */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-semibold w-8">KG</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cargaAtual}
                        onChange={e => setCargasEditaveis(prev => ({ ...prev, [nome]: e.target.value }))}
                        onBlur={e => salvarCarga(nome, e.target.value)}
                        placeholder="— kg"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {/* Botão concluir */}
      <div className="pt-2">
        <button
          onClick={handleConcluir}
          disabled={concluindo || !agendamentoHoje}
          className="w-full py-4 rounded-2xl bg-primary text-white font-black text-base flex items-center justify-center gap-3 disabled:opacity-40 transition-opacity"
          style={{fontFamily:'Archivo,sans-serif'}}
        >
          {concluindo
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Concluindo...</>
            : <><CheckCircle2 className="w-5 h-5" /> Concluir {variacaoExibida}</>
          }
        </button>
        {!agendamentoHoje && (
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Agende um treino para hoje na aba Agenda para liberar este botão.
          </p>
        )}
      </div>

      {/* Bottom sheet: Histórico */}
      {mostrarHistorico && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setMostrarHistorico(false)}>
          <div className="bg-card border-t border-border rounded-t-3xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-2" />
            <div className="flex items-center justify-between">
              <p className="font-black text-base text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                Histórico de Treinos
              </p>
              <button onClick={() => setMostrarHistorico(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {progressoPorVariacao.map(({ variacao, realizados, total }) => (
              <div key={variacao} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-foreground">{variacao}</p>
                  <p className="text-xs text-muted-foreground">{realizados.length}/{total} realizados</p>
                </div>
                {/* Grade de sessões */}
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(total, 8)}, 1fr)` }}>
                  {Array.from({ length: total }, (_, i) => {
                    const sessao = realizados[i];
                    const foiTroca = sessao?.foi_troca;
                    return (
                      <div
                        key={i}
                        title={sessao ? format(parseISO(sessao.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : ""}
                        className={`h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-colors ${
                          sessao
                            ? foiTroca
                              ? "bg-warning/20 border-warning/30 text-warning"
                              : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        {sessao
                          ? format(parseISO(sessao.data + "T12:00:00"), "dd/MM", { locale: ptBR })
                          : "—"
                        }
                      </div>
                    );
                  })}
                </div>
                {/* Indicador de troca */}
                {realizados.some((s: any) => s.foi_troca) && (
                  <p className="text-[10px] text-warning">
                    ⚠ Sessões em amarelo foram realizadas fora da ordem original.
                  </p>
                )}
              </div>
            ))}

            <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30 inline-block"></span> Realizado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/20 border border-warning/30 inline-block"></span> Troca</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted border border-border inline-block"></span> Pendente</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Portal 5-3-1: visualização simplificada por dia × semana
// ─────────────────────────────────────────────────────────────


function Portal531View({ treino }: { treino: any }) {
  const data = (treino?.conteudo ?? null) as Wendler531Conteudo | null;
  const [semanaAtiva, setSemanaAtiva] = useState<1 | 2 | 3 | 4>(1);

  if (!data) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Treino indisponível.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto pb-16">
      <header className="space-y-1">
        <h1 className="text-lg font-bold">5-3-1 · Onda de 4 semanas</h1>
        <p className="text-xs text-muted-foreground">
          Frequência {data.frequencia}x · Training Max {data.percentual_training_max}%
        </p>
      </header>

      {/* Seletor de semana */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg">
        {([1, 2, 3, 4] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSemanaAtiva(s)}
            className={`text-xs font-semibold py-2 rounded-md transition-colors ${
              semanaAtiva === s
                ? "bg-background shadow"
                : "text-muted-foreground"
            }`}
          >
            Sem {s}
            {s === 4 && <span className="block text-[9px] opacity-70">deload</span>}
          </button>
        ))}
      </div>

      {/* Aquecimento global */}
      {data.aquecimento && (["LIB", "MOB", "ATI", "PREV"] as const).some(
        (k) => (data.aquecimento?.[k]?.length ?? 0) > 0,
      ) && (
        <section className="rounded-xl border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Aquecimento
            </p>
          </div>
          <div className="p-3 space-y-2">
            {(["LIB", "MOB", "ATI", "PREV"] as const).map((k) => {
              const items = data.aquecimento?.[k] ?? [];
              if (!items.length) return null;
              return (
                <div key={k}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {k}
                  </p>
                  <ul className="space-y-1">
                    {items.map((ex, i) => (
                      <li key={i} className="flex justify-between items-center text-xs border-l-2 border-primary/40 pl-2">
                        <span className="truncate flex items-center gap-1">
                          {ex.exercicio || "—"}
                          {ex.video_url && (
                            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <PlayCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{ex.repeticoes}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.dias.map((dia) => {
        const nome = dia.levantamentos.map((l) => l.levantamento).join(" + ") || "—";
        return (
          <section key={dia.ordem} className="rounded-xl border border-border overflow-hidden">
            <div className="px-3 py-2 bg-muted/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Treino {dia.ordem}
              </p>
              <p className="text-sm font-semibold">{nome}</p>
            </div>
            <div className="p-3 space-y-3">
              {dia.levantamentos.map((lev) => {
                const wave = compute531Wave(lev.rm_1, data.percentual_training_max);
                const semana = wave.find((w) => w.semana === semanaAtiva)!;
                const tm = round531(tm531(lev.rm_1, data.percentual_training_max));
                return (
                  <div key={lev.levantamento} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold shrink-0">{lev.levantamento}</span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].nome}
                        </span>
                        {LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].video_url && (
                          <a
                            href={LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].video_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary shrink-0"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        TM {tm}kg
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {semana.series.map((s, i) => (
                        <li
                          key={i}
                          className={`flex justify-between text-xs tabular-nums ${
                            s.tipo === "aquecimento"
                              ? "text-muted-foreground"
                              : "font-semibold"
                          }`}
                        >
                          <span>{s.tipo === "aquecimento" ? "Aquec." : "Trabalho"} · {s.reps} × {s.pct}%</span>
                          <span>{s.kg}kg</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* Acessórios (só semanas 1-3) */}
              {semanaAtiva !== 4 && dia.acessorios.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Acessórios
                  </p>
                  <ul className="space-y-1">
                    {dia.acessorios.map((acc, idx) => {
                      const rmVinc =
                        dia.levantamentos.find((l) => l.levantamento === acc.vinculado_a)?.rm_1 ?? 0;
                      const s = acc.semanas.find((x) => x.semana === semanaAtiva);
                      if (!s) return null;
                      const kg = accKg531(rmVinc, data.percentual_training_max, s.percentual);
                      return (
                        <li
                          key={idx}
                          className="flex justify-between text-xs border-l-2 border-primary/50 pl-2"
                        >
                          <span className="truncate flex items-center gap-1">
                            {acc.exercicio || "—"}
                            {acc.video_url && (
                              <a href={acc.video_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                                <PlayCircle className="w-3 h-3" />
                              </a>
                            )}
                            <span className="text-muted-foreground"> · {s.series}×{s.reps} · {s.percentual}%</span>
                          </span>
                          <span className="tabular-nums font-medium">{kg}kg</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Auxiliares */}
              {dia.auxiliares.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Auxiliares
                  </p>
                  <ul className="space-y-1">
                    {dia.auxiliares.map((aux, i) => (
                      <li key={i} className="flex justify-between text-xs">
                        <span className="truncate flex items-center gap-1">
                          {aux.exercicio || "—"}
                          {aux.video_url && (
                            <a href={aux.video_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <PlayCircle className="w-3 h-3" />
                            </a>
                          )}
                          <span className="text-muted-foreground"> · {aux.series}×{aux.reps}</span>
                        </span>
                        <span className="tabular-nums">{aux.kg || "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Portal M102: 4 slots com prescrição da sessão atual (ao vivo)
// ─────────────────────────────────────────────────────────────

function PortalM102View({
  treino,
  sessoes,
}: {
  treino: any;
  sessoes: Array<{ variacao: string; concluido_em: string | null }>;
}) {
  const data = (treino?.conteudo ?? null) as M102Conteudo | null;

  if (!data) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Treino indisponível.
      </div>
    );
  }

  const counts: Record<M102Slot, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  sessoes.forEach((s) => {
    if (
      (s.variacao === "T1" || s.variacao === "T2" || s.variacao === "T3" || s.variacao === "T4") &&
      s.concluido_em
    ) {
      counts[s.variacao as M102Slot]++;
    }
  });

  const slots: M102Slot[] = ["T1", "T2", "T3", "T4"];

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto pb-16">
      <header className="space-y-1">
        <h1 className="text-lg font-bold">M102 · 11 semanas + teste</h1>
        <p className="text-xs text-muted-foreground">
          % Inicial {data.percentualInicial}% · 4 treinos fixos
        </p>
      </header>

      {data.aquecimento && (["LIB", "MOB", "ATI", "PREV"] as const).some(
        (k) => (data.aquecimento?.[k]?.length ?? 0) > 0,
      ) && (
        <section className="rounded-xl border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Aquecimento
            </p>
          </div>
          <div className="p-3 space-y-2">
            {(["LIB", "MOB", "ATI", "PREV"] as const).map((k) => {
              const items = data.aquecimento?.[k] ?? [];
              if (!items.length) return null;
              return (
                <div key={k}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {k}
                  </p>
                  <ul className="space-y-1">
                    {items.map((ex, i) => (
                      <li key={i} className="flex justify-between items-center text-xs border-l-2 border-primary/40 pl-2">
                        <span className="truncate flex items-center gap-1">
                          {ex.exercicio || "—"}
                          {ex.video_url && (
                            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <PlayCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{ex.repeticoes}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {slots.map((slot) => {
        const done = counts[slot];
        const pairDone = counts[pairOf(slot)];
        const st = slotStatus(data.percentualInicial, done, pairDone);
        const lifts = M102_SLOT_LEVANTAMENTOS[slot];
        const treinoDia = data.treinos.find((t) => `T${t.ordem}` === slot);
        return (
          <section key={slot} className="rounded-xl border border-border overflow-hidden">
            <div className="px-3 py-2 bg-muted/60 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {slot} · Treino
                </p>
                <p className="text-sm font-semibold">
                  {lifts.map((l) => l.levantamento).join(" + ")}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{done}/11</span>
            </div>
            <div className="p-3 space-y-3">
              {st.phase === "concluded" && (
                <p className="text-xs text-success text-center py-2 italic">
                  Programa concluído neste par — procure o professor.
                </p>
              )}
              {st.phase === "waitingPair" && (
                <p className="text-xs text-muted-foreground text-center py-2 italic">
                  Aguardando slot par ({pairOf(slot)}) completar 11 sessões ({st.pairDone}/11) para liberar o teste.
                </p>
              )}
              {st.phase === "readyForTest" && (
                <div className="border rounded-lg p-3 space-y-2 bg-warning/5 border-warning/40">
                  <p className="text-xs font-bold uppercase tracking-wider text-warning">
                    🎯 Sessão de teste disponível
                  </p>
                  {lifts.map(({ levantamento }) => {
                    const rm = rmForLevantamento(data.rm, levantamento);
                    const base = M102_LEV_BASE[levantamento];
                    return (
                      <div key={levantamento} className="text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{levantamento}</span>
                          <span className="text-muted-foreground truncate">{base.nome}</span>
                        </div>
                        <ul className="space-y-0.5 pl-2">
                          {testSession(rm).map((s, i) => (
                            <li key={i} className="flex justify-between tabular-nums">
                              <span className="text-muted-foreground">{s.reps} × {s.pct}%</span>
                              <span className="font-medium">{s.kg} kg</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              {st.phase === "regular" && (
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Tier {st.next.tier} · Semana {st.next.semanaNoTier} · {st.next.pct}%
                  </p>
                  {lifts.map(({ levantamento, slotAB }) => {
                    const rm = rmForLevantamento(data.rm, levantamento);
                    const reps = slotAB === "A" ? st.next.repsA : st.next.repsB;
                    const kg = kgFor(rm, st.next.pct);
                    const base = M102_LEV_BASE[levantamento];
                    return (
                      <div key={levantamento} className="flex items-center justify-between text-xs gap-2">
                        <span className="truncate flex items-center gap-1 min-w-0">
                          <span className="font-semibold shrink-0">{levantamento}</span>
                          <span className="text-muted-foreground truncate">{base.nome}</span>
                          {base.video_url && (
                            <a href={base.video_url} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0">
                              <PlayCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground shrink-0">
                          {st.next.series} × {reps} · <span className="font-semibold text-foreground">{kg} kg</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {treinoDia && treinoDia.acessorios.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Acessórios
                  </p>
                  <ul className="space-y-1">
                    {treinoDia.acessorios.map((acc, i) => (
                      <li key={i} className="flex justify-between text-xs border-l-2 border-primary/50 pl-2 gap-2">
                        <span className="truncate flex items-center gap-1">
                          {acc.exercicio || "—"}
                          {acc.video_url && (
                            <a href={acc.video_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <PlayCircle className="w-3 h-3" />
                            </a>
                          )}
                          <span className="text-muted-foreground"> · {acc.series} × {acc.reps}</span>
                        </span>
                        <span className="tabular-nums">{acc.kg || "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
