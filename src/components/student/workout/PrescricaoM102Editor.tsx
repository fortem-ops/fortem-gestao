import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle2, Sparkles, PlayCircle, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import {
  type M102Conteudo,
  type M102Acessorio,
  type M102Slot,
  emptyM102,
  M102_SLOT_LEVANTAMENTOS,
  M102_LEV_BASE,
  slotStatus,
  testSession,
  rmForLevantamento,
  kgFor,
  pairOf,
} from "@/lib/m102";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import { CATEGORY_LABELS } from "@/components/student/workout/workoutTemplates";
import { SUBCATEGORIA_TO_CODE } from "@/lib/exerciseMapping";
import { exportM102PDF } from "./exportM102PDF";
import type { Tables } from "@/integrations/supabase/types";



interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: M102Conteudo;
  onSaved?: () => void;
}

export function PrescricaoM102Editor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<M102Conteudo>(initial ?? emptyM102(65));
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNext = useRef(true);

  const { blocosAquecimento, categoriasForca } = useExerciseCategories();
  const forcaCategories = categoriasForca;
  const AQUECIMENTO_BLOCOS = useMemo(
    () =>
      blocosAquecimento.map((b) => ({
        key: b.sigla,
        label: `${b.categoria} (${b.sigla})`,
        categoria: b.categoria,
        subcategorias: b.subcategorias,
      })),
    [blocosAquecimento],
  );
  const siglasAq = useMemo(() => AQUECIMENTO_BLOCOS.map((b) => b.key), [AQUECIMENTO_BLOCOS]);


  // Contagem de sessões concluídas por slot (para preview ao vivo)
  const { data: sessionCounts = { T1: 0, T2: 0, T3: 0, T4: 0 } } = useQuery({
    queryKey: ["m102-session-counts", treinoId],
    enabled: !!treinoId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("treino_sessoes")
        .select("variacao")
        .eq("treino_id", treinoId!)
        .not("concluido_em", "is", null);
      const counts: Record<M102Slot, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
      (rows || []).forEach((r: { variacao: string }) => {
        if (r.variacao === "T1" || r.variacao === "T2" || r.variacao === "T3" || r.variacao === "T4") {
          counts[r.variacao as M102Slot]++;
        }
      });
      return counts;
    },
  });

  // Autosave
  const saveDraft = useCallback(
    async (next: M102Conteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = "M102 — 11 semanas + teste";
        if (treinoId) {
          const { error } = await supabase
            .from("treinos")
            .update({ conteudo, descricao, updated_at: new Date().toISOString() })
            .eq("id", treinoId);
          if (error) throw error;
        } else {
          const { data: ultimo } = await supabase
            .from("treinos")
            .select("versao")
            .eq("aluno_id", alunoId)
            .order("versao", { ascending: false })
            .limit(1)
            .maybeSingle();
          const versao = (ultimo?.versao || 0) + 1;
          const { data: inserted, error } = await supabase
            .from("treinos")
            .insert({
              aluno_id: alunoId,
              autor_id: user.id,
              descricao,
              conteudo,
              status: "rascunho",
              versao,
              template_fase: "M102",
              semanas: 12,
            } as never)
            .select("id")
            .single();
          if (error) throw error;
          if (inserted?.id) setTreinoId(inserted.id as string);
        }
        setSavingLabel("Rascunho salvo");
        setDirty(false);
        onSaved?.();
        setTimeout(() => setSavingLabel(""), 1500);
      } catch (e) {
        setSavingLabel("");
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("Erro ao salvar: " + msg);
      }
    },
    [alunoId, treinoId, user, onSaved],
  );

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    setDirty(true);
    const t = setTimeout(() => saveDraft(data), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Aquecimento ─────────────────────────────────────────────
  const ensureAq = (
    aq: M102Conteudo["aquecimento"] | undefined,
  ): Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]> =>
    ensureAquecimentoRecord(aq, siglasAq);
  const addAq = (b: AquecimentoBloco) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return {
        ...p,
        aquecimento: {
          ...aq,
          [b]: [...aq[b], { exercicio: "", repeticoes: "10", dias: ["T1", "T2", "T3", "T4"] }],
        },
      };
    });
  const updateAq = (b: AquecimentoBloco, i: number, patch: Partial<PersonalizadoAquecimentoEx>) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return {
        ...p,
        aquecimento: {
          ...aq,
          [b]: aq[b].map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)),
        },
      };
    });
  const removeAq = (b: AquecimentoBloco, i: number) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return { ...p, aquecimento: { ...aq, [b]: aq[b].filter((_, idx) => idx !== i) } };
    });
  const toggleDiaAq = (b: AquecimentoBloco, i: number, dia: string) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return {
        ...p,
        aquecimento: {
          ...aq,
          [b]: aq[b].map((ex, idx) => {
            if (idx !== i) return ex;
            const has = ex.dias.includes(dia);
            return { ...ex, dias: has ? ex.dias.filter((d) => d !== dia) : [...ex.dias, dia] };
          }),
        },
      };
    });

  // ── Acessórios ──────────────────────────────────────────────
  const addAcc = (ti: number) =>
    setData((p) => {
      if (p.treinos[ti].acessorios.length >= 3) {
        toast.info("Máx. 3 acessórios por treino.");
        return p;
      }
      const novo: M102Acessorio = {
        categoria: "",
        exercicio: "",
        exercicio_id: null,
        video_url: null,
        series: 3,
        reps: "10",
        kg: "",
      };
      return {
        ...p,
        treinos: p.treinos.map((t, i) =>
          i === ti ? { ...t, acessorios: [...t.acessorios, novo] } : t,
        ),
      };
    });
  const updateAcc = (ti: number, ai: number, patch: Partial<M102Acessorio>) =>
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti
          ? {
              ...t,
              acessorios: t.acessorios.map((a, j) => (j === ai ? { ...a, ...patch } : a)),
            }
          : t,
      ),
    }));
  const removeAcc = (ti: number, ai: number) =>
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti ? { ...t, acessorios: t.acessorios.filter((_, j) => j !== ai) } : t,
      ),
    }));

  const setRm = (k: keyof M102Conteudo["rm"], val: number) =>
    setData((p) => ({ ...p, rm: { ...p.rm, [k]: val } }));
  const setPctInicial = (v: 65 | 70) =>
    setData((p) => ({ ...p, percentualInicial: v }));

  // ── Publicar ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    const r = data.rm;
    if (!r.terra || !r.agachamento || !r.remada || !r.supino) {
      toast.error("Informe o 1RM dos 4 levantamentos.");
      return;
    }
    setPublishing(true);
    try {
      if (dirty) await saveDraft(data);
      if (!treinoId) {
        toast.error("Rascunho ainda não criado. Aguarde 1s e tente de novo.");
        return;
      }
      await supabase
        .from("treinos")
        .update({ status: "arquivado", updated_at: new Date().toISOString() })
        .eq("aluno_id", alunoId)
        .eq("status", "atual");
      const hoje = new Date();
      const dataInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
      const { error } = await supabase
        .from("treinos")
        .update({
          status: "atual",
          data_inicio: dataInicio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", treinoId);
      if (error) throw error;
      toast.success("Prescrição M102 enviada ao aluno.");
      onSaved?.();
      onBack();
    } catch (e) {
      toast.error("Erro ao concluir: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPublishing(false);
    }
  };

  // ── Exportar PDF / Imprimir ────────────────────────────────
  const handleExport = async (mode: "download" | "print") => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", alunoId)
        .maybeSingle();
      const student = (aluno ?? { id: alunoId, nome: alunoNome }) as Tables<"alunos">;
      await exportM102PDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Preview ao vivo por slot ────────────────────────────────

  const renderPreviewSlot = (slot: M102Slot) => {
    const done = sessionCounts[slot];
    const pairDone = sessionCounts[pairOf(slot)];
    const st = slotStatus(data.percentualInicial, done, pairDone);
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Sessão atual · <strong className="text-foreground">{done}/11</strong> concluídas</span>
          {st.phase === "regular" && (
            <span>
              Tier {st.next.tier} · Semana {st.next.semanaNoTier}
            </span>
          )}
        </div>
        {st.phase === "regular" && (
          <div className="space-y-1">
            {M102_SLOT_LEVANTAMENTOS[slot].map(({ levantamento, slotAB }) => {
              const rm = rmForLevantamento(data.rm, levantamento);
              const reps = slotAB === "A" ? st.next.repsA : st.next.repsB;
              const kg = kgFor(rm, st.next.pct);
              return (
                <div
                  key={levantamento}
                  className="text-xs flex items-center justify-between gap-2"
                >
                  <span className="font-medium">{levantamento}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {st.next.series} × {reps} @ {st.next.pct}% ·{" "}
                    <strong className="text-foreground">{kg} kg</strong>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {st.phase === "waitingPair" && (
          <p className="text-xs text-muted-foreground italic">
            Aguardando slot par ({pairOf(slot)}) completar 11 sessões ({st.pairDone}/11) para liberar o teste.
          </p>
        )}
        {st.phase === "readyForTest" && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-warning">🎯 Sessão de teste disponível</p>
            {M102_SLOT_LEVANTAMENTOS[slot].map(({ levantamento }) => {
              const rm = rmForLevantamento(data.rm, levantamento);
              return (
                <div key={levantamento} className="text-xs">
                  <span className="font-medium">{levantamento}: </span>
                  {testSession(rm).map((s, i) => (
                    <span key={i} className="tabular-nums text-muted-foreground">
                      {i > 0 && " + "}
                      {s.reps} × {s.pct}% ({s.kg} kg)
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {st.phase === "concluded" && (
          <p className="text-xs text-success italic">
            Programa concluído neste par — procure o professor.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> M102 · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              11 semanas + sessão de teste — carga por tier em % do 1RM.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savingLabel && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {savingLabel === "Salvando…" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-primary" />
              )}
              {savingLabel}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => handleExport("download")}>
            <FileDown className="w-3 h-3 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("print")}>
            <Printer className="w-3 h-3 mr-1" /> Imprimir
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1" />
            )}
            Concluir prescrição
          </Button>
        </div>
      </div>



      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>% Inicial</Label>
            <Select
              value={String(data.percentualInicial)}
              onValueChange={(v) => setPctInicial(Number(v) as 65 | 70)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="65">65% (tiers 65→90)</SelectItem>
                <SelectItem value="70">70% (tiers 70→95)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(["terra", "agachamento", "remada", "supino"] as const).map((k) => (
            <div key={k}>
              <Label className="capitalize">1RM {k} (kg)</Label>
              <Input
                type="number"
                value={data.rm[k] || ""}
                onChange={(e) => setRm(k, Number(e.target.value) || 0)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Aquecimento global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aquecimento (global)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {AQUECIMENTO_BLOCOS.map((b) => {
            const items = ensureAq(data.aquecimento)[b.key];
            const subs = b.subcategorias;
            return (
              <div key={b.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {b.key}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {b.label}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 ml-auto"
                    onClick={() => addAq(b.key)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Exercício
                  </Button>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    Nenhum exercício neste bloco.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((ex, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded border border-border/50 bg-card/50"
                      >
                        <span className="text-[10px] text-muted-foreground mt-2 w-4">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Select
                              value={ex.subcategoria ?? ""}
                              onValueChange={(val) =>
                                updateAq(b.key, i, {
                                  subcategoria: val,
                                  exercicio: "",
                                  exercicio_id: null,
                                  video_url: null,
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-[180px] shrink-0">
                                <SelectValue placeholder="Subcategoria..." />
                              </SelectTrigger>
                              <SelectContent>
                                {subs.map((sub) => (
                                  <SelectItem key={sub} value={sub} className="text-xs">
                                    {sub}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex-1 min-w-0">
                              <ExerciseSelector
                                categoria={b.categoria}
                                grupoPreferido={GRUPO_AQUECIMENTO}
                                subcategoria={ex.subcategoria}
                                value={ex.exercicio}
                                disabled={!ex.subcategoria}
                                placeholder={
                                  ex.subcategoria
                                    ? `Buscar em ${ex.subcategoria}...`
                                    : "Selecione a subcategoria primeiro"
                                }
                                onChange={(val, video) =>
                                  updateAq(b.key, i, { exercicio: val, video_url: video })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label className="text-[10px] text-muted-foreground">Reps</Label>
                            <Input
                              value={ex.repeticoes}
                              onChange={(e) => updateAq(b.key, i, { repeticoes: e.target.value })}
                              className="h-6 w-24 text-xs"
                              placeholder='10 ou 60"'
                            />
                            <Label className="text-[10px] text-muted-foreground ml-2">
                              Dias
                            </Label>
                            <div className="flex gap-1">
                              {(["T1", "T2", "T3", "T4"] as const).map((d) => {
                                const on = ex.dias.includes(d);
                                return (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => toggleDiaAq(b.key, i, d)}
                                    className={
                                      "h-6 px-2 rounded text-[10px] font-semibold border transition-colors " +
                                      (on
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-card text-muted-foreground border-border hover:border-primary/40")
                                    }
                                  >
                                    {d}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeAq(b.key, i)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 4 Treinos fixos */}
      {data.treinos.map((tr, ti) => {
        const slot = `T${tr.ordem}` as M102Slot;
        const lifts = M102_SLOT_LEVANTAMENTOS[slot];
        return (
          <Card key={tr.ordem}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>{slot}</Badge>
                <span>Treino {tr.ordem}</span>
                <span className="text-muted-foreground font-normal">
                  — {lifts.map((l) => l.levantamento).join(" + ")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Levantamentos base
                </p>
                {renderPreviewSlot(slot)}
                <div className="mt-2 space-y-1">
                  {lifts.map(({ levantamento }) => {
                    const base = M102_LEV_BASE[levantamento];
                    return (
                      <div
                        key={levantamento}
                        className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap"
                      >
                        <span className="font-medium text-foreground">{levantamento}:</span>
                        <span>{base.nome}</span>
                        {base.video_url && (
                          <a
                            href={base.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1"
                          >
                            <PlayCircle className="w-3 h-3" /> Vídeo
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Acessórios ({tr.acessorios.length}/3)
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addAcc(ti)}
                    disabled={tr.acessorios.length >= 3}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Acessório
                  </Button>
                </div>
                {tr.acessorios.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum acessório. Máx. 3 por treino.
                  </p>
                )}
                {tr.acessorios.map((acc, ai) => (
                  <div
                    key={ai}
                    className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-[180px_1fr_80px_100px_100px_auto] gap-2 items-end"
                  >
                    <div>
                      <Label className="text-xs">Categoria</Label>
                      <Select
                        value={acc.categoria}
                        onValueChange={(v) =>
                          updateAcc(ti, ai, {
                            categoria: v,
                            exercicio: "",
                            exercicio_id: null,
                            video_url: null,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {forcaCategories.map((g) => (
                            <SelectGroup key={g.name}>
                              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {g.name}
                              </SelectLabel>
                              {g.subcategories.map((sub) => {
                                const code = SUBCATEGORIA_TO_CODE[sub];
                                const val = code ?? sub;
                                const display = code
                                  ? `${code} — ${CATEGORY_LABELS[code] ?? sub}`
                                  : sub;
                                return (
                                  <SelectItem key={val} value={val} className="text-xs">
                                    {display}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Exercício</Label>
                      <ExerciseSelector
                        categoria={acc.categoria || "AUX"}
                        value={acc.exercicio}
                        disabled={!acc.categoria}
                        onChange={(val, video) =>
                          updateAcc(ti, ai, { exercicio: val, video_url: video })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Séries</Label>
                      <Input
                        type="number"
                        value={acc.series || ""}
                        onChange={(e) =>
                          updateAcc(ti, ai, { series: Number(e.target.value) || 0 })
                        }
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Reps</Label>
                      <Input
                        value={acc.reps}
                        onChange={(e) => updateAcc(ti, ai, { reps: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Kg (opcional)</Label>
                      <Input
                        value={acc.kg ?? ""}
                        onChange={(e) => updateAcc(ti, ai, { kg: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeAcc(ti, ai)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
