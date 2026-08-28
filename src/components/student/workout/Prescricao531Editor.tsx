import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle2, Sparkles, PlayCircle, FileDown, Printer } from "lucide-react";
import { exportWendler531PDF } from "./exportWendler531PDF";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import {
  type Wendler531Conteudo,
  type Levantamento531,
  type Dia531,
  type Acessorio531,
  type Auxiliar531,
  emptyWendler531,
  levantamentosDisponiveis,
  computeWave,
  trainingMax,
  acessorioKg,
  roundToNearest2_5,
  LEVANTAMENTO_EXERCICIO_BASE,
} from "@/lib/wendler531";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { useExerciseCategories, GRUPO_AQUECIMENTO, type ExerciseCategory } from "@/hooks/useExerciseCategories";
import { CATEGORY_LABELS } from "@/components/student/workout/workoutTemplates";
import { SUBCATEGORIA_TO_CODE } from "@/lib/exerciseMapping";
import {
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

function CategoriaSelectForca({
  value,
  onChange,
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: ExerciseCategory[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Categoria" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map((g) => (
          <SelectGroup key={g.name}>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {g.name}
            </SelectLabel>
            {g.subcategories.map((sub) => {
              const code = SUBCATEGORIA_TO_CODE[sub];
              const itemValue = code ?? sub;
              const display = code ? `${code} — ${CATEGORY_LABELS[code] ?? sub}` : sub;
              return (
                <SelectItem key={itemValue} value={itemValue} className="text-xs">
                  {display}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}


interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: Wendler531Conteudo;
  onSaved?: () => void;
}

const FREQ_OPTIONS: Array<2 | 3 | 4 | 5> = [2, 3, 4, 5];

export function Prescricao531Editor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<Wendler531Conteudo>(
    initial ?? emptyWendler531(4, 90),
  );
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNextSave = useRef(true);

  const disponiveis = useMemo(
    () => levantamentosDisponiveis(data.frequencia),
    [data.frequencia],
  );
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



  // ── Autosave (debounce 800ms) ─────────────────────────────────
  const saveDraft = useCallback(async (next: Wendler531Conteudo) => {
    if (!user) return;
    setSavingLabel("Salvando…");
    try {
      const conteudo = next as unknown as Json;
      const descricao = "5-3-1 — Onda 4 semanas";
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
        const proximaVersao = (ultimo?.versao || 0) + 1;
        const { data: inserted, error } = await supabase
          .from("treinos")
          .insert({
            aluno_id: alunoId,
            autor_id: user.id,
            descricao,
            conteudo,
            status: "rascunho",
            versao: proximaVersao,
            template_fase: "5-3-1",
            semanas: 4,
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
      console.error("[5-3-1 autosave] erro completo:", e);
      const err = e as { message?: string; details?: string; hint?: string; code?: string } | null;
      let msg = "";
      if (e instanceof Error) msg = e.message;
      else if (err?.message) msg = [err.message, err.details, err.hint, err.code].filter(Boolean).join(" | ");
      else {
        try { msg = JSON.stringify(e); } catch { msg = String(e); }
      }
      toast.error("Erro ao salvar: " + (msg || "desconhecido"));
    }
  }, [alunoId, treinoId, user, onSaved]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setDirty(true);
    const t = setTimeout(() => {
      saveDraft(data);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Mutações no estado ────────────────────────────────────────
  const setFrequencia = (freq: 2 | 3 | 4 | 5) => {
    setData((prev) => {
      const dias: Dia531[] = Array.from({ length: freq }, (_, i) =>
        prev.dias[i] ?? {
          ordem: i + 1,
          levantamentos: [],
          acessorios: [],
          auxiliares: [],
        },
      );
      // se reduziu, remover Press dos dias caso freq < 5
      if (freq < 5) {
        for (const d of dias) {
          d.levantamentos = d.levantamentos.filter((l) => l.levantamento !== "Press");
          d.acessorios = d.acessorios.filter((a) => a.vinculado_a !== "Press");
        }
      }
      // Poda dias do aquecimento global para T1..T{freq}
      const validos = new Set(Array.from({ length: freq }, (_, i) => `T${i + 1}`));
      const aq = ensureAquecimento(prev.aquecimento);
      const aquecimentoPodado = Object.fromEntries(
        (Object.keys(aq) as AquecimentoBloco[]).map((k) => [
          k,
          aq[k].map((ex) => ({ ...ex, dias: ex.dias.filter((d) => validos.has(d)) })),
        ]),
      ) as Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
      return { ...prev, frequencia: freq, dias, aquecimento: aquecimentoPodado };
    });
  };

  const setPctTM = (pct: number) =>
    setData((prev) => ({ ...prev, percentual_training_max: pct }));

  const updateDia = (idx: number, patch: Partial<Dia531>) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => (i === idx ? { ...d, ...patch } : d));
      return { ...prev, dias };
    });

  const addLevantamento = (idx: number, lev: Levantamento531) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => {
        if (i !== idx) return d;
        if (d.levantamentos.some((l) => l.levantamento === lev)) return d;
        return {
          ...d,
          levantamentos: [...d.levantamentos, { levantamento: lev, rm_1: 0 }],
        };
      });
      return { ...prev, dias };
    });

  const removeLevantamento = (idx: number, lev: Levantamento531) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => {
        if (i !== idx) return d;
        return {
          ...d,
          levantamentos: d.levantamentos.filter((l) => l.levantamento !== lev),
          acessorios: d.acessorios.filter((a) => a.vinculado_a !== lev),
        };
      });
      return { ...prev, dias };
    });

  const setRm1 = (idx: number, lev: Levantamento531, rm_1: number) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => {
        if (i !== idx) return d;
        return {
          ...d,
          levantamentos: d.levantamentos.map((l) =>
            l.levantamento === lev ? { ...l, rm_1 } : l,
          ),
        };
      });
      return { ...prev, dias };
    });

  const addAcessorio = (idx: number) =>
    setData((prev) => {
      const dia = prev.dias[idx];
      const primeiro = dia.levantamentos[0]?.levantamento;
      if (!primeiro) {
        toast.info("Adicione um levantamento principal antes de vincular acessórios.");
        return prev;
      }
      const novo: Acessorio531 = {
        vinculado_a: primeiro,
        categoria: "",
        exercicio: "",
        exercicio_id: null,
        video_url: null,
        semanas: [
          { semana: 1, series: 3, reps: "10", percentual: 50 },
          { semana: 2, series: 3, reps: "10", percentual: 55 },
          { semana: 3, series: 3, reps: "10", percentual: 60 },
        ],
      };

      const dias = prev.dias.map((d, i) =>
        i === idx ? { ...d, acessorios: [...d.acessorios, novo] } : d,
      );
      return { ...prev, dias };
    });

  const updateAcessorio = (
    idxDia: number,
    idxAcc: number,
    patch: Partial<Acessorio531>,
  ) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => {
        if (i !== idxDia) return d;
        const acessorios = d.acessorios.map((a, j) =>
          j === idxAcc ? { ...a, ...patch } : a,
        );
        return { ...d, acessorios };
      });
      return { ...prev, dias };
    });

  const updateAcessorioSemana = (
    idxDia: number,
    idxAcc: number,
    semana: 1 | 2 | 3,
    patch: Partial<{ series: number; reps: string; percentual: number }>,
  ) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => {
        if (i !== idxDia) return d;
        const acessorios = d.acessorios.map((a, j) => {
          if (j !== idxAcc) return a;
          return {
            ...a,
            semanas: a.semanas.map((s) =>
              s.semana === semana ? { ...s, ...patch } : s,
            ),
          };
        });
        return { ...d, acessorios };
      });
      return { ...prev, dias };
    });

  const removeAcessorio = (idxDia: number, idxAcc: number) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) =>
        i !== idxDia
          ? d
          : { ...d, acessorios: d.acessorios.filter((_, j) => j !== idxAcc) },
      );
      return { ...prev, dias };
    });

  const addAuxiliar = (idx: number) =>
    setData((prev) => {
      const novo: Auxiliar531 = { categoria: "", exercicio: "", exercicio_id: null, video_url: null, series: 3, reps: "10", kg: "" };
      const dias = prev.dias.map((d, i) =>
        i === idx ? { ...d, auxiliares: [...d.auxiliares, novo] } : d,
      );
      return { ...prev, dias };
    });

  const updateAuxiliar = (
    idxDia: number,
    idxAux: number,
    patch: Partial<Auxiliar531>,
  ) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) => {
        if (i !== idxDia) return d;
        const auxiliares = d.auxiliares.map((a, j) =>
          j === idxAux ? { ...a, ...patch } : a,
        );
        return { ...d, auxiliares };
      });
      return { ...prev, dias };
    });

  const removeAuxiliar = (idxDia: number, idxAux: number) =>
    setData((prev) => {
      const dias = prev.dias.map((d, i) =>
        i !== idxDia
          ? d
          : { ...d, auxiliares: d.auxiliares.filter((_, j) => j !== idxAux) },
      );
      return { ...prev, dias };
    });

  // ── Aquecimento (bloco global) ────────────────────────────────
  const ensureAquecimento = (
    aq: Wendler531Conteudo["aquecimento"] | undefined,
  ): Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]> =>
    ensureAquecimentoRecord(aq, siglasAq);

  const addAquecimento = (bloco: AquecimentoBloco) =>
    setData((prev) => {
      const aq = ensureAquecimento(prev.aquecimento);
      const diasDefault = Array.from({ length: prev.frequencia }, (_, i) => `T${i + 1}`);
      return {
        ...prev,
        aquecimento: {
          ...aq,
          [bloco]: [
            ...aq[bloco],
            { exercicio: "", repeticoes: "10", dias: diasDefault },
          ],
        },
      };
    });

  const toggleDiaAquecimento = (bloco: AquecimentoBloco, i: number, dia: string) =>
    setData((prev) => {
      const aq = ensureAquecimento(prev.aquecimento);
      return {
        ...prev,
        aquecimento: {
          ...aq,
          [bloco]: aq[bloco].map((ex, idx) => {
            if (idx !== i) return ex;
            const has = ex.dias.includes(dia);
            return {
              ...ex,
              dias: has ? ex.dias.filter((d) => d !== dia) : [...ex.dias, dia],
            };
          }),
        },
      };
    });

  const removeAquecimento = (bloco: AquecimentoBloco, i: number) =>
    setData((prev) => {
      const aq = ensureAquecimento(prev.aquecimento);
      return {
        ...prev,
        aquecimento: { ...aq, [bloco]: aq[bloco].filter((_, idx) => idx !== i) },
      };
    });

  const updateAquecimento = (
    bloco: AquecimentoBloco,
    i: number,
    patch: Partial<PersonalizadoAquecimentoEx>,
  ) =>
    setData((prev) => {
      const aq = ensureAquecimento(prev.aquecimento);
      return {
        ...prev,
        aquecimento: {
          ...aq,
          [bloco]: aq[bloco].map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)),
        },
      };
    });

  // ── Exportar PDF / Imprimir ──────────────────────────────────
  const handleExport = async (mode: "download" | "print") => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", alunoId)
        .maybeSingle();
      const student = (aluno ?? { id: alunoId, nome: alunoNome }) as Tables<"alunos">;
      await exportWendler531PDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Concluir prescrição ──────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    // Validações mínimas
    const totalLev = data.dias.reduce((acc, d) => acc + d.levantamentos.length, 0);
    if (totalLev === 0) {
      toast.error("Adicione ao menos um levantamento principal.");
      return;
    }
    for (const d of data.dias) {
      for (const l of d.levantamentos) {
        if (!l.rm_1 || l.rm_1 <= 0) {
          toast.error(`Informe o 1RM de ${l.levantamento} no Treino ${d.ordem}.`);
          return;
        }
      }
    }
    setPublishing(true);
    try {
      // Salva o estado corrente antes de publicar
      if (dirty) await saveDraft(data);
      if (!treinoId) {
        // saveDraft acima deveria ter criado o id, mas garantia:
        toast.error("Rascunho não foi salvo ainda. Tente novamente em 1s.");
        return;
      }

      // Arquiva treino "atual" atual do aluno
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

      toast.success("Prescrição 5-3-1 enviada ao aluno.");
      onSaved?.();
      onBack();
    } catch (e) {
      toast.error(
        "Erro ao concluir: " + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setPublishing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 max-w-6xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              5-3-1 · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Onda de 4 semanas — carga calculada a partir do 1RM e Training Max.
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
            {publishing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Concluir prescrição
          </Button>
        </div>
      </div>

      {/* Configuração global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Frequência semanal</Label>
            <Select
              value={String(data.frequencia)}
              onValueChange={(v) => setFrequencia(Number(v) as 2 | 3 | 4 | 5)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQ_OPTIONS.map((f) => (
                  <SelectItem key={f} value={String(f)}>{f}x por semana</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>% Training Max</Label>
            <Input
              type="number"
              min={70}
              max={100}
              value={data.percentual_training_max}
              onChange={(e) => setPctTM(Number(e.target.value) || 0)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Padrão Wendler: 90%. Aplicado a todos os levantamentos.
            </p>
          </div>
          <div className="text-xs text-muted-foreground self-end">
            Arredondamento automático para múltiplos de <strong>2,5kg</strong>.
            Semana 4 é <strong>deload</strong>.
          </div>
        </CardContent>
      </Card>

      {/* Aquecimento global (aplicado antes de qualquer dia) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aquecimento (global)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {AQUECIMENTO_BLOCOS.map((b) => {
            const items = ensureAquecimento(data.aquecimento)[b.key];
            const subs = b.subcategorias;
            return (
              <div key={b.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold">{b.key}</Badge>
                  <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
                  <Button size="sm" variant="ghost" className="h-6 ml-auto" onClick={() => addAquecimento(b.key)}>
                    <Plus className="w-3 h-3 mr-1" /> Exercício
                  </Button>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Nenhum exercício neste bloco.</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((ex, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded border border-border/50 bg-card/50">
                        <span className="text-[10px] text-muted-foreground mt-2 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Select
                              value={ex.subcategoria ?? ""}
                              onValueChange={(val) =>
                                updateAquecimento(b.key, i, {
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
                                  <SelectItem key={sub} value={sub} className="text-xs">{sub}</SelectItem>
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
                                  updateAquecimento(b.key, i, { exercicio: val, video_url: video })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label className="text-[10px] text-muted-foreground">Reps</Label>
                            <Input
                              value={ex.repeticoes}
                              onChange={(e) => updateAquecimento(b.key, i, { repeticoes: e.target.value })}
                              className="h-6 w-24 text-xs"
                              placeholder='10 ou 60"'
                            />
                            <Label className="text-[10px] text-muted-foreground ml-2">Dias</Label>
                            <div className="flex gap-1">
                              {Array.from({ length: data.frequencia }, (_, di) => `T${di + 1}`).map((d) => {
                                const on = ex.dias.includes(d);
                                return (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => toggleDiaAquecimento(b.key, i, d)}
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
                          onClick={() => removeAquecimento(b.key, i)}
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

      {/* Dias */}
      {data.dias.map((dia, idxDia) => (
        <Card key={dia.ordem}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Treino {dia.ordem}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value=""
                onValueChange={(v) => addLevantamento(idxDia, v as Levantamento531)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="+ Adicionar levantamento" />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis
                    .filter((l) => !dia.levantamentos.some((x) => x.levantamento === l))
                    .map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {dia.levantamentos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum levantamento principal. Adicione ao menos um para gerar a onda.
              </p>
            )}

            {dia.levantamentos.map((lev) => {
              const wave = computeWave(lev.rm_1, data.percentual_training_max);
              const tm = roundToNearest2_5(
                trainingMax(lev.rm_1, data.percentual_training_max),
              );
              return (
                <div key={lev.levantamento} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge>{lev.levantamento}</Badge>
                      <span className="text-xs font-medium text-foreground">
                        {LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].nome}
                      </span>
                      {LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].video_url && (
                        <a
                          href={LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].video_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          aria-label={`Vídeo de ${LEVANTAMENTO_EXERCICIO_BASE[lev.levantamento].nome}`}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Vídeo
                        </a>
                      )}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">1RM (kg)</Label>
                        <Input
                          type="number"
                          className="w-24 h-8"
                          value={lev.rm_1 || ""}
                          onChange={(e) =>
                            setRm1(idxDia, lev.levantamento, Number(e.target.value) || 0)
                          }
                        />
                      </div>
                      {lev.rm_1 > 0 && (
                        <span className="text-xs text-muted-foreground">
                          TM: <strong>{tm}kg</strong>
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeLevantamento(idxDia, lev.levantamento)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>


                  {lev.rm_1 > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {wave.map((sem) => (
                        <div key={sem.semana} className="border rounded-md p-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Semana {sem.semana}
                            {sem.semana === 4 && " · Deload"}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {sem.series.map((s, i) => (
                              <li
                                key={i}
                                className={`text-xs tabular-nums flex justify-between ${
                                  s.tipo === "aquecimento"
                                    ? "text-muted-foreground"
                                    : "font-medium"
                                }`}
                              >
                                <span>{s.reps} × {s.pct}%</span>
                                <span>{s.kg}kg</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Acessórios */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Acessórios</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addAcessorio(idxDia)}
                  disabled={dia.levantamentos.length === 0}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Acessório
                </Button>
              </div>
              {dia.acessorios.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sem acessórios. Semana 4 (deload) não tem acessórios.
                </p>
              )}
              {dia.acessorios.map((acc, idxAcc) => {
                const rmVinculado =
                  dia.levantamentos.find((l) => l.levantamento === acc.vinculado_a)?.rm_1 ?? 0;
                return (
                  <div key={idxAcc} className="border rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-[140px_180px_1fr_auto] gap-2 items-end">
                      <div>
                        <Label className="text-xs">Vinculado a</Label>
                        <Select
                          value={acc.vinculado_a}
                          onValueChange={(v) =>
                            updateAcessorio(idxDia, idxAcc, {
                              vinculado_a: v as Levantamento531,
                            })
                          }
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {dia.levantamentos.map((l) => (
                              <SelectItem key={l.levantamento} value={l.levantamento}>
                                {l.levantamento}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Categoria</Label>
                        <CategoriaSelectForca
                          value={acc.categoria}
                          groups={forcaCategories}
                          onChange={(v) =>
                            updateAcessorio(idxDia, idxAcc, {
                              categoria: v,
                              exercicio: "",
                              exercicio_id: null,
                              video_url: null,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Exercício</Label>
                        <div className="border border-input rounded-md">
                          <ExerciseSelector
                            categoria={acc.categoria || "DJS"}
                            value={acc.exercicio}
                            disabled={!acc.categoria}
                            placeholder={acc.categoria ? "Buscar exercício..." : "Escolha a categoria"}
                            onChange={(val, video) =>
                              updateAcessorio(idxDia, idxAcc, { exercicio: val, video_url: video })
                            }
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeAcessorio(idxDia, idxAcc)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>


                    <div className="grid grid-cols-3 gap-2">
                      {acc.semanas.map((s) => {
                        const kg = acessorioKg(
                          rmVinculado,
                          data.percentual_training_max,
                          s.percentual,
                        );
                        return (
                          <div key={s.semana} className="border rounded p-2 space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground">
                              SEM {s.semana}
                            </p>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="h-7 text-xs"
                                value={s.series}
                                onChange={(e) =>
                                  updateAcessorioSemana(idxDia, idxAcc, s.semana, {
                                    series: Number(e.target.value) || 0,
                                  })
                                }
                              />
                              <span className="text-xs text-muted-foreground">×</span>
                              <Input
                                className="h-7 text-xs"
                                value={s.reps}
                                onChange={(e) =>
                                  updateAcessorioSemana(idxDia, idxAcc, s.semana, {
                                    reps: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                className="h-7 text-xs"
                                value={s.percentual}
                                onChange={(e) =>
                                  updateAcessorioSemana(idxDia, idxAcc, s.semana, {
                                    percentual: Number(e.target.value) || 0,
                                  })
                                }
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            <p className="text-[11px] tabular-nums text-right font-medium">
                              {kg > 0 ? `${kg}kg` : "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auxiliares */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Auxiliares</h3>
                <Button variant="outline" size="sm" onClick={() => addAuxiliar(idxDia)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Auxiliar
                </Button>
              </div>
              {dia.auxiliares.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sem auxiliares. Iguais nas 4 semanas.
                </p>
              )}
              {dia.auxiliares.map((aux, idxAux) => (
                <div
                  key={idxAux}
                  className="grid grid-cols-[160px_1fr_70px_80px_90px_auto] gap-2 items-end"
                >
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <CategoriaSelectForca
                      value={aux.categoria}
                      groups={forcaCategories}
                      onChange={(v) =>
                        updateAuxiliar(idxDia, idxAux, {
                          categoria: v,
                          exercicio: "",
                          exercicio_id: null,
                          video_url: null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Exercício</Label>
                    <div className="border border-input rounded-md">
                      <ExerciseSelector
                        categoria={aux.categoria || "DJS"}
                        value={aux.exercicio}
                        disabled={!aux.categoria}
                        placeholder={aux.categoria ? "Buscar exercício..." : "Escolha a categoria"}
                        onChange={(val, video) =>
                          updateAuxiliar(idxDia, idxAux, { exercicio: val, video_url: video })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Séries</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={aux.series}
                      onChange={(e) =>
                        updateAuxiliar(idxDia, idxAux, {
                          series: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Reps</Label>
                    <Input
                      className="h-8"
                      value={aux.reps}
                      onChange={(e) =>
                        updateAuxiliar(idxDia, idxAux, { reps: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kg</Label>
                    <Input
                      className="h-8"
                      value={aux.kg ?? ""}
                      onChange={(e) =>
                        updateAuxiliar(idxDia, idxAux, { kg: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeAuxiliar(idxDia, idxAux)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
