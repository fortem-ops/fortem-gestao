import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlunoDeficitsAlert } from "./AlunoDeficitsAlert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  FileDown,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { useExerciseCategories, GRUPO_AQUECIMENTO, type ExerciseCategory } from "@/hooks/useExerciseCategories";
import { CATEGORY_LABELS } from "@/components/student/workout/workoutTemplates";
import { SUBCATEGORIA_TO_CODE } from "@/lib/exerciseMapping";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import {
  type Planilha5RMConteudo,
  type ExercicioPlanilha5RM,
  type Frequencia5RM,
  emptyPlanilha5RM,
  treinoVazio5RM,
  ajustarBloco5RM,
  PLANILHA5RM_FREQ_OPTIONS,
  PLANILHA5RM_QTD_BLOCO_PRINCIPAL,
  PLANILHA5RM_QTD_BLOCO_ACESSORIO,
  PLANILHA5RM_BLOCO_PRINCIPAL_LABEL,
  PLANILHA5RM_BLOCO_ACESSORIO_LABEL,
  PLANILHA5RM_VOLUME_PRINCIPAL,
  PLANILHA5RM_VOLUME_PRINCIPAL_NOTA,
  PLANILHA5RM_VOLUME_ACESSORIO,
} from "@/lib/planilha5rm";
import { exportPlanilha5RMPDF } from "./exportPlanilha5RMPDF";

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
  initial?: Planilha5RMConteudo;
  onSaved?: () => void;
}

type BlocoKey = "blocoPrincipal" | "blocoAcessorio";

export function PrescricaoPlanilha5RMEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<Planilha5RMConteudo>(initial ?? emptyPlanilha5RM(3));
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNextSave = useRef(true);

  const { blocosAquecimento, categoriasForca } = useExerciseCategories();
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

  const ensureAquecimento = useCallback(
    (aq: Planilha5RMConteudo["aquecimento"] | undefined) => ensureAquecimentoRecord(aq, siglasAq),
    [siglasAq],
  );

  // ── Autosave (debounce 800ms) ─────────────────────────────────
  const saveDraft = useCallback(
    async (next: Planilha5RMConteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = "Planilha 5RM — 4 semanas";
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
              template_fase: "Planilha 5RM",
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
        toast.error("Erro ao salvar: " + (e instanceof Error ? e.message : String(e)));
      }
    },
    [alunoId, treinoId, user, onSaved],
  );

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setDirty(true);
    const t = setTimeout(() => saveDraft(data), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Mutações ─────────────────────────────────────────────────
  const setFrequencia = (freq: Frequencia5RM) =>
    setData((prev) => {
      const treinos = Array.from({ length: freq }, (_, i) => {
        const atual = prev.treinos[i];
        if (!atual) return treinoVazio5RM(i + 1);
        return {
          ...atual,
          ordem: i + 1,
          blocoPrincipal: ajustarBloco5RM(atual.blocoPrincipal, PLANILHA5RM_QTD_BLOCO_PRINCIPAL),
          blocoAcessorio: ajustarBloco5RM(atual.blocoAcessorio, PLANILHA5RM_QTD_BLOCO_ACESSORIO),
        };
      });
      const validos = new Set(Array.from({ length: freq }, (_, i) => `T${i + 1}`));
      const aq = ensureAquecimento(prev.aquecimento);
      const aquecimento = Object.fromEntries(
        Object.keys(aq).map((k) => [
          k,
          aq[k].map((ex) => ({ ...ex, dias: ex.dias.filter((d) => validos.has(d)) })),
        ]),
      ) as Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;
      return { ...prev, frequencia: freq, treinos, aquecimento };
    });

  const updateExercicio = (
    idxTreino: number,
    bloco: BlocoKey,
    idxEx: number,
    patch: Partial<ExercicioPlanilha5RM>,
  ) =>
    setData((prev) => ({
      ...prev,
      treinos: prev.treinos.map((t, i) =>
        i !== idxTreino
          ? t
          : {
              ...t,
              [bloco]: t[bloco].map((ex, j) => (j === idxEx ? { ...ex, ...patch } : ex)),
            },
      ),
    }));

  const updateKgSemana = (
    idxTreino: number,
    bloco: BlocoKey,
    idxEx: number,
    semana: 0 | 1 | 2 | 3,
    valor: string,
  ) =>
    setData((prev) => ({
      ...prev,
      treinos: prev.treinos.map((t, i) =>
        i !== idxTreino
          ? t
          : {
              ...t,
              [bloco]: t[bloco].map((ex, j) => {
                if (j !== idxEx) return ex;
                const kgSemanas = [...ex.kgSemanas] as ExercicioPlanilha5RM["kgSemanas"];
                kgSemanas[semana] = valor;
                return { ...ex, kgSemanas };
              }),
            },
      ),
    }));

  // ── Aquecimento ──────────────────────────────────────────────
  const addAquecimento = (bloco: AquecimentoBloco) =>
    setData((prev) => {
      const aq = ensureAquecimento(prev.aquecimento);
      const diasDefault = Array.from({ length: prev.frequencia }, (_, i) => `T${i + 1}`);
      return {
        ...prev,
        aquecimento: {
          ...aq,
          [bloco]: [...aq[bloco], { exercicio: "", repeticoes: "10", dias: diasDefault }],
        },
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
            return { ...ex, dias: has ? ex.dias.filter((d) => d !== dia) : [...ex.dias, dia] };
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

  // ── PDF / Imprimir ───────────────────────────────────────────
  const handleExport = async (mode: "download" | "print") => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", alunoId)
        .maybeSingle();
      const student = (aluno ?? { id: alunoId, nome: alunoNome }) as Tables<"alunos">;
      await exportPlanilha5RMPDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Concluir prescrição ──────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    const faltando = data.treinos.some((t) =>
      [...t.blocoPrincipal, ...t.blocoAcessorio].some((ex) => !ex.exercicio.trim()),
    );
    if (faltando) {
      toast.error("Escolha todos os exercícios dos blocos antes de concluir.");
      return;
    }
    setPublishing(true);
    try {
      if (dirty) await saveDraft(data);
      if (!treinoId) {
        toast.error("Rascunho não foi salvo ainda. Tente novamente em 1s.");
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
        .update({ status: "atual", data_inicio: dataInicio, updated_at: new Date().toISOString() })
        .eq("id", treinoId);
      if (error) throw error;

      toast.success("Planilha 5RM enviada ao aluno.");
      onSaved?.();
      onBack();
    } catch (e) {
      toast.error("Erro ao concluir: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPublishing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  const renderBloco = (
    idxTreino: number,
    bloco: BlocoKey,
    titulo: string,
    exercicios: ExercicioPlanilha5RM[],
    referencia: string,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <Badge variant="outline" className="text-[10px]">{referencia}</Badge>
      </div>
      {exercicios.map((ex, idxEx) => (
        <div key={idxEx} className="border rounded-md p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-2 items-end">
            <div>
              <Label className="text-xs">Categoria</Label>
              <CategoriaSelectForca
                value={ex.categoria}
                groups={categoriasForca}
                onChange={(v) =>
                  updateExercicio(idxTreino, bloco, idxEx, {
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
                  categoria={ex.categoria || "DJS"}
                  value={ex.exercicio}
                  disabled={!ex.categoria}
                  placeholder={ex.categoria ? "Buscar exercício..." : "Escolha a categoria"}
                  onChange={(val, video) =>
                    updateExercicio(idxTreino, bloco, idxEx, { exercicio: val, video_url: video })
                  }
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ex.kgSemanas.map((kg, s) => (
              <div key={s}>
                <Label className="text-[10px] text-muted-foreground">S{s + 1} (kg)</Label>
                <Input
                  className="h-8 text-xs"
                  inputMode="decimal"
                  value={kg}
                  placeholder="—"
                  onChange={(e) =>
                    updateKgSemana(idxTreino, bloco, idxEx, s as 0 | 1 | 2 | 3, e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

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
              Planilha 5RM · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              4 semanas — cargas anotadas manualmente, sem cálculo de 1RM.
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

      <AlunoDeficitsAlert alunoId={alunoId} />

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Frequência semanal</Label>
            <Select
              value={String(data.frequencia)}
              onValueChange={(v) => setFrequencia(Number(v) as Frequencia5RM)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLANILHA5RM_FREQ_OPTIONS.map((f) => (
                  <SelectItem key={f} value={String(f)}>{f}x por semana</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={data.observacoes}
              onChange={(e) => setData((prev) => ({ ...prev, observacoes: e.target.value }))}
              className="min-h-[38px]"
              placeholder="Orientações gerais do ciclo"
            />
          </div>
        </CardContent>
      </Card>

      {/* Volume / Intensidade — referência fixa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Volume / Intensidade
            <HelpTip title="Como ler esta referência">
              <p>
                <strong>{PLANILHA5RM_BLOCO_PRINCIPAL_LABEL}</strong>: sempre 4 séries de 5
                repetições. A cada semana a carga sobe, mirando um RM cada vez menor — de 8RM na
                semana 1 até 5RM na semana 4. Na prática: mesma quantidade de séries e repetições,
                com mais peso a cada semana.
              </p>
              <p>
                <strong>{PLANILHA5RM_BLOCO_ACESSORIO_LABEL}</strong>: sempre 3 séries de 8
                repetições numa carga de 10-12RM, igual nas quatro semanas.
              </p>
            </HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{PLANILHA5RM_BLOCO_PRINCIPAL_LABEL}</span>
              <Badge variant="outline" className="text-[10px]">
                {PLANILHA5RM_VOLUME_PRINCIPAL_NOTA}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PLANILHA5RM_VOLUME_PRINCIPAL.map((v) => (
                <div key={v.semana} className="border rounded-md p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    S{v.semana}
                  </p>
                  <p className="text-sm font-medium tabular-nums">{v.texto}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">{PLANILHA5RM_BLOCO_ACESSORIO_LABEL}</p>
            <div className="border rounded-md p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                S1-S4
              </p>
              <p className="text-sm font-medium tabular-nums">{PLANILHA5RM_VOLUME_ACESSORIO}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aquecimento global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aquecimento (global)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {AQUECIMENTO_BLOCOS.map((b) => {
            const items = ensureAquecimento(data.aquecimento)[b.key];
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
                                {b.subcategorias.map((sub) => (
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

      {/* Treinos */}
      {data.treinos.map((treino, idxTreino) => (
        <Card key={treino.ordem}>
          <CardHeader>
            <CardTitle className="text-base">Treino {treino.ordem}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {renderBloco(
              idxTreino,
              "blocoPrincipal",
              PLANILHA5RM_BLOCO_PRINCIPAL_LABEL,
              treino.blocoPrincipal,
              "4x5 · 8RM → 5RM",
            )}
            {renderBloco(
              idxTreino,
              "blocoAcessorio",
              PLANILHA5RM_BLOCO_ACESSORIO_LABEL,
              treino.blocoAcessorio,
              PLANILHA5RM_VOLUME_ACESSORIO,
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
