import { useEffect, useRef, useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Plus, Trash2, FileDown, Printer, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { ExerciseSelector } from "./ExerciseSelector";
import { CATEGORY_LABELS } from "./workoutTemplates";
import { AQUECIMENTO_SUBCATEGORIAS } from "@/lib/exerciseMapping";
import { StudentPicker } from "@/components/student/StudentPicker";
import { exportWorkoutPDF } from "./exportWorkoutPDF";
import {
  emptyPersonalizado,
  flattenPersonalizado,
  type PersonalizadoConteudo,
  type PersonalizadoExercicio,
  type PersonalizadoExercicioDinamico,
  type PersonalizadoExercicioSimples,
  type AquecimentoBloco,
  type DinamicoRotacao,
  type DinamicoSeriesModo,
  type PersonalizadoTreinoConteudo,
} from "./personalizadoTypes";

interface Props {
  /** Conteúdo inicial (modelo do banco ou treino do aluno). */
  initial?: PersonalizadoConteudo;
  /** Nome inicial (modelo) ou descrição (treino do aluno). */
  initialName?: string;
  /** Quando aberto a partir de um aluno, persistir em treinos.conteudo deste aluno. */
  alunoId?: string;
  alunoNome?: string;
  /** ID do registro existente, se editando. */
  modeloId?: string;
  treinoId?: string;
  onBack: () => void;
  onSaved?: () => void;
}

const FORCA_CATEGORIAS = [
  "DJS","DJA","DQ","DQ_P","PH","PV","EH","EV","EP","EEF","EE","AH","AF","AR","PREV","COND",
];

const AQUECIMENTO_BLOCOS: { key: AquecimentoBloco; label: string }[] = [
  { key: "LIB", label: "Liberação (LIB)" },
  { key: "MOB", label: "Mobilidade (MOB)" },
  { key: "ATI", label: "Ativação (ATI)" },
];

const DAYS = ["T1", "T2", "T3", "T4"];

function nextLetter(blocosCount: number) {
  return String.fromCharCode(65 + blocosCount); // A, B, C...
}

export function PersonalizadoEditor({
  initial,
  initialName,
  alunoId,
  alunoNome,
  modeloId,
  treinoId,
  onBack,
  onSaved,
}: Props) {
  const { user } = useAuth();
  // IMPORTANT: `initial` and `initialName` are treated as initializers only.
  // We deliberately do NOT sync with later prop changes — re-syncing causes
  // the editor to wipe the user's in-progress prescription whenever the
  // parent re-renders (e.g. on browser tab focus, query refetch, or any
  // upstream state change that produces a new object reference).
  // The editor identity is tied to `modeloId`/`treinoId` via the parent's
  // conditional rendering, so a true "load different record" path naturally
  // remounts this component and re-initializes state from scratch.
  const [data, setData] = useState<PersonalizadoConteudo>(() => initial ?? emptyPersonalizado());
  const [name, setName] = useState(
    () => initialName ?? (alunoId ? "Treino Personalizado" : "Modelo Personalizado"),
  );
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState<null | "download" | "print">(null);
  const [weeks, setWeeks] = useState(4);
  const [applyOpen, setApplyOpen] = useState(false);
  const [pickedAluno, setPickedAluno] = useState("");

  const isAluno = !!alunoId;

  // ============ Auto-save (rascunho) ============
  // Estratégia:
  //  - Sempre persistimos um rascunho local em localStorage (debounce ~800ms).
  //  - Se houver `modeloId` ou `treinoId`, persistimos também no banco com
  //    debounce maior (~5s) e silenciosamente, sem toast.
  //  - Ao montar, se existir um rascunho local mais recente que o `initial`
  //    fornecido (ou se for um "novo" sem id), restauramos automaticamente.
  // Chave de rascunho — única para cada contexto de edição:
  const draftKey =
    `personalizado:draft:${modeloId ?? treinoId ?? (alunoId ? `aluno-${alunoId}` : "new")}`;

  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null);

  // Refs para evitar disparar auto-save no primeiro render e para guardar timers.
  const didMountRef = useRef(false);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  // Restaura rascunho local se existir.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        data: PersonalizadoConteudo;
        name: string;
        savedAt: number;
      };
      // Heurística: só restaura se o rascunho difere do estado inicial atual,
      // evitando sobrescrever um modelo recém-aberto idêntico.
      const sameContent =
        JSON.stringify(parsed.data) === JSON.stringify(data) &&
        parsed.name === name;
      if (sameContent) return;
      setData(parsed.data);
      setName(parsed.name);
      setLastAutoSaveAt(parsed.savedAt);
      setAutoSaveStatus("saved");
      toast.info("Rascunho restaurado automaticamente");
    } catch {
      /* rascunho corrompido — ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Debounce: salvar rascunho local + (opcional) backend a cada edição.
  useEffect(() => {
    // Pula primeira execução (montagem) — evita gravar antes da restauração.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    setAutoSaveStatus("saving");

    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ data, name, savedAt: Date.now() }),
        );
        setLastAutoSaveAt(Date.now());
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("error");
      }
    }, 800);

    // Auto-save remoto silencioso, apenas para registros já existentes.
    if (modeloId || treinoId) {
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = setTimeout(async () => {
        const u = userRef.current;
        if (!u) return;
        try {
          if (modeloId) {
            await supabase
              .from("banco_treinos_personalizados")
              .update({
                nome: name.trim() || "Modelo Personalizado",
                conteudo: data as unknown as Json,
              })
              .eq("id", modeloId);
          } else if (treinoId) {
            const conteudo = {
              __personalizado: true,
              estrutura: data,
              ...flattenPersonalizado(data),
            } as unknown as Json;
            await supabase
              .from("treinos")
              .update({
                conteudo,
                descricao: name,
                updated_at: new Date().toISOString(),
              })
              .eq("id", treinoId);
          }
          setLastAutoSaveAt(Date.now());
          setAutoSaveStatus("saved");
        } catch {
          setAutoSaveStatus("error");
        }
      }, 5000);
    }

    return () => {
      // Não limpamos os timers aqui para permitir que o último save complete
      // após um desmonte (ex: usuário clica em "Voltar").
    };
  }, [data, name, draftKey, modeloId, treinoId]);

  // Limpa rascunho local após save manual bem-sucedido.
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* noop */
    }
  };

  // Indicador textual amigável.
  const autoSaveLabel = (() => {
    if (autoSaveStatus === "saving") return "Salvando rascunho...";
    if (autoSaveStatus === "error") return "Falha ao salvar rascunho";
    if (autoSaveStatus === "saved" && lastAutoSaveAt) {
      const sec = Math.max(1, Math.round((Date.now() - lastAutoSaveAt) / 1000));
      if (sec < 60) return `Rascunho salvo há ${sec}s`;
      const min = Math.round(sec / 60);
      return `Rascunho salvo há ${min}min`;
    }
    return null;
  })();

  // Re-renderiza o label de tempo a cada 15s (apenas estética).
  useEffect(() => {
    const t = setInterval(() => setLastAutoSaveAt((v) => v), 15_000);
    return () => clearInterval(t);
  }, []);


  // ============ Aquecimento ============
  const addAquecimento = (bloco: AquecimentoBloco) => {
    setData((p) => ({
      ...p,
      aquecimento: {
        ...p.aquecimento,
        [bloco]: [
          ...p.aquecimento[bloco],
          { exercicio: "", repeticoes: "10", dias: ["T1", "T2", "T3", "T4"] },
        ],
      },
    }));
  };
  const removeAquecimento = (bloco: AquecimentoBloco, i: number) => {
    setData((p) => ({
      ...p,
      aquecimento: {
        ...p.aquecimento,
        [bloco]: p.aquecimento[bloco].filter((_, idx) => idx !== i),
      },
    }));
  };
  const updateAquecimento = (
    bloco: AquecimentoBloco,
    i: number,
    patch: Partial<PersonalizadoConteudo["aquecimento"][AquecimentoBloco][number]>,
  ) => {
    setData((p) => ({
      ...p,
      aquecimento: {
        ...p.aquecimento,
        [bloco]: p.aquecimento[bloco].map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)),
      },
    }));
  };
  const toggleDia = (bloco: AquecimentoBloco, i: number, dia: string) => {
    setData((p) => ({
      ...p,
      aquecimento: {
        ...p.aquecimento,
        [bloco]: p.aquecimento[bloco].map((ex, idx) => {
          if (idx !== i) return ex;
          const has = ex.dias.includes(dia);
          return { ...ex, dias: has ? ex.dias.filter((d) => d !== dia) : [...ex.dias, dia] };
        }),
      },
    }));
  };

  // ============ Treinos / Blocos / Exercícios ============
  const addTreino = () => {
    setData((p) => ({
      ...p,
      treinos: [
        ...p.treinos,
        { nome: `Treino ${p.treinos.length + 1}`, blocos: [{ nome: "Bloco A", exercicios: [] }] },
      ],
    }));
  };
  const removeTreino = (ti: number) => {
    setData((p) => ({ ...p, treinos: p.treinos.filter((_, i) => i !== ti) }));
  };
  const updateTreinoNome = (ti: number, nome: string) => {
    setData((p) => ({ ...p, treinos: p.treinos.map((t, i) => (i === ti ? { ...t, nome } : t)) }));
  };

  const addBloco = (ti: number) => {
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti
          ? { ...t, blocos: [...t.blocos, { nome: `Bloco ${nextLetter(t.blocos.length)}`, exercicios: [] }] }
          : t,
      ),
    }));
  };
  const removeBloco = (ti: number, bi: number) => {
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti ? { ...t, blocos: t.blocos.filter((_, idx) => idx !== bi) } : t,
      ),
    }));
  };
  const updateBlocoNome = (ti: number, bi: number, nome: string) => {
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti ? { ...t, blocos: t.blocos.map((b, j) => (j === bi ? { ...b, nome } : b)) } : t,
      ),
    }));
  };

  const addExercicio = (
    ti: number,
    bi: number,
    tipo: "simples" | "dinamico",
  ) => {
    const novo: PersonalizadoExercicio =
      tipo === "simples"
        ? {
            tipo: "simples",
            categoria: "DJS",
            exercicio: "",
            series: 3,
            repeticoes: "10",
          }
        : {
            tipo: "dinamico",
            categoria: "DJS",
            rotacao: "impar_par",
            series_modo: "compartilhado",
            series: 3,
            repeticoes: "10",
            variantes: [
              { exercicio: "" },
              { exercicio: "" },
            ],
          };
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti
          ? {
              ...t,
              blocos: t.blocos.map((b, j) =>
                j === bi ? { ...b, exercicios: [...b.exercicios, novo] } : b,
              ),
            }
          : t,
      ),
    }));
  };
  const removeExercicio = (ti: number, bi: number, ei: number) => {
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti
          ? {
              ...t,
              blocos: t.blocos.map((b, j) =>
                j === bi ? { ...b, exercicios: b.exercicios.filter((_, k) => k !== ei) } : b,
              ),
            }
          : t,
      ),
    }));
  };
  const updateExercicio = <T extends PersonalizadoExercicio>(
    ti: number,
    bi: number,
    ei: number,
    patch: Partial<T>,
  ) => {
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti
          ? {
              ...t,
              blocos: t.blocos.map((b, j) =>
                j === bi
                  ? {
                      ...b,
                      exercicios: b.exercicios.map((ex, k) =>
                        k === ei ? ({ ...ex, ...patch } as PersonalizadoExercicio) : ex,
                      ),
                    }
                  : b,
              ),
            }
          : t,
      ),
    }));
  };

  // ============ Salvar ============
  const buildContent = (): PersonalizadoTreinoConteudo => {
    const flat = flattenPersonalizado(data);
    return {
      __personalizado: true,
      estrutura: data,
      aquecimento: flat.aquecimento,
      treinos: flat.treinos,
    };
  };

  const handleSaveModelo = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Informe um nome para o modelo");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: name.trim(),
        conteudo: data as unknown as Json,
        criado_por: user.id,
      };
      if (modeloId) {
        const { error } = await supabase
          .from("banco_treinos_personalizados")
          .update({ nome: payload.nome, conteudo: payload.conteudo })
          .eq("id", modeloId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("banco_treinos_personalizados")
          .insert(payload);
        if (error) throw error;
      }
      toast.success("Modelo salvo no Banco de Treinos");
      clearDraft();
      onSaved?.();
    } catch (e) {
      toast.error("Erro ao salvar modelo: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
    }
  };

  const saveToAluno = async (targetAlunoId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const conteudo = buildContent() as unknown as Json;
      if (treinoId) {
        const { error } = await supabase
          .from("treinos")
          .update({ conteudo, descricao: name, updated_at: new Date().toISOString() })
          .eq("id", treinoId);
        if (error) throw error;
      } else {
        await supabase
          .from("treinos")
          .update({ status: "arquivado", updated_at: new Date().toISOString() })
          .eq("aluno_id", targetAlunoId)
          .eq("status", "atual");
        const { data: ultimo } = await supabase
          .from("treinos")
          .select("versao")
          .eq("aluno_id", targetAlunoId)
          .order("versao", { ascending: false })
          .limit(1)
          .maybeSingle();
        const proximaVersao = (ultimo?.versao || 0) + 1;
        const { error } = await supabase.from("treinos").insert({
          aluno_id: targetAlunoId,
          autor_id: user.id,
          descricao: name,
          conteudo,
          status: "atual",
          versao: proximaVersao,
        });
        if (error) throw error;
      }
      toast.success("Treino aplicado ao aluno");
      clearDraft();
      onSaved?.();
    } catch (e) {
      toast.error("Erro ao aplicar: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
      setApplyOpen(false);
    }
  };

  // ============ Exportar PDF ============
  const handleExport = async (mode: "download" | "print", weeksCount: number) => {
    let aluno: { id: string; nome: string } | null = null;
    if (alunoId) {
      const { data: a } = await supabase.from("alunos").select("*").eq("id", alunoId).maybeSingle();
      aluno = a as { id: string; nome: string } | null;
    }
    const flat = flattenPersonalizado(data);
    await exportWorkoutPDF({
      student: (aluno || {
        id: "00000000-0000-0000-0000-000000000000",
        nome: alunoNome || "—",
      }) as Parameters<typeof exportWorkoutPDF>[0]["student"],
      descricao: name || "TREINO PERSONALIZADO",
      data: flat,
      print: mode === "print",
      weeks: weeksCount,
    });
  };

  // ============ UI ============
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm font-heading font-semibold"
          placeholder={isAluno ? "Descrição do treino" : "Nome do modelo"}
        />
        {isAluno && alunoNome && (
          <Badge variant="outline" className="text-xs">Aluno: {alunoNome}</Badge>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {autoSaveLabel && (
            <span
              className={`text-[11px] ${
                autoSaveStatus === "error"
                  ? "text-destructive"
                  : autoSaveStatus === "saving"
                    ? "text-muted-foreground"
                    : "text-primary"
              }`}
              title="Suas alterações são salvas automaticamente como rascunho"
            >
              {autoSaveLabel}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => setExportOpen("download")}>
            <FileDown className="w-3 h-3 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportOpen("print")}>
            <Printer className="w-3 h-3 mr-1" /> Imprimir
          </Button>
          {!isAluno && (
            <>
              <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)}>
                <Users className="w-3 h-3 mr-1" /> Aplicar a aluno
              </Button>
              <Button size="sm" onClick={handleSaveModelo} disabled={saving}>
                <Save className="w-3 h-3 mr-1" /> {saving ? "Salvando..." : "Salvar modelo"}
              </Button>
            </>
          )}
          {isAluno && (
            <Button size="sm" onClick={() => saveToAluno(alunoId!)} disabled={saving}>
              <Save className="w-3 h-3 mr-1" /> {saving ? "Salvando..." : "Salvar no aluno"}
            </Button>
          )}
        </div>
      </div>

      {/* Aquecimento */}
      <div className="glass-card rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-heading font-semibold text-primary">AQUECIMENTO</h4>
        {AQUECIMENTO_BLOCOS.map((b) => (
          <div key={b.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-bold">{b.key}</Badge>
              <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 ml-auto"
                onClick={() => addAquecimento(b.key)}
              >
                <Plus className="w-3 h-3 mr-1" /> Exercício
              </Button>
            </div>
            {data.aquecimento[b.key].length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Nenhum exercício neste bloco.</p>
            ) : (
              <div className="space-y-1.5">
                {data.aquecimento[b.key].map((ex, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded border border-border/50 bg-card/50">
                    <span className="text-[10px] text-muted-foreground mt-2 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <ExerciseSelector
                        categoria={b.key}
                        value={ex.exercicio}
                        onChange={(val, video) =>
                          updateAquecimento(b.key, i, { exercicio: val, video_url: video })
                        }
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label className="text-[10px] text-muted-foreground">Reps</Label>
                        <Input
                          value={ex.repeticoes}
                          onChange={(e) => updateAquecimento(b.key, i, { repeticoes: e.target.value })}
                          className="h-6 w-20 text-xs"
                          placeholder='10 ou 60"'
                        />
                        <Label className="text-[10px] text-muted-foreground ml-2">Dias</Label>
                        <ToggleGroup
                          type="multiple"
                          value={ex.dias}
                          onValueChange={() => { /* via onClick individual */ }}
                          className="gap-1"
                        >
                          {DAYS.map((d) => (
                            <ToggleGroupItem
                              key={d}
                              value={d}
                              className="h-6 px-2 text-[10px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              onClick={() => toggleDia(b.key, i, d)}
                            >
                              {d}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeAquecimento(b.key, i)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Treinos */}
      <div className="glass-card rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-heading font-semibold text-primary">FORÇA</h4>
          <Button size="sm" variant="outline" onClick={addTreino}>
            <Plus className="w-3 h-3 mr-1" /> Treino
          </Button>
        </div>

        {data.treinos.map((tr, ti) => (
          <div key={ti} className="rounded-lg border border-border p-3 space-y-3 bg-card/30">
            <div className="flex items-center gap-2">
              <Input
                value={tr.nome}
                onChange={(e) => updateTreinoNome(ti, e.target.value)}
                className="h-7 max-w-[180px] text-sm font-semibold"
              />
              <Button size="sm" variant="ghost" onClick={() => addBloco(ti)} className="h-7">
                <Plus className="w-3 h-3 mr-1" /> Bloco
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive ml-auto"
                onClick={() => removeTreino(ti)}
                disabled={data.treinos.length === 1}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            {tr.blocos.map((bl, bi) => (
              <div key={bi} className="rounded border border-border/50 p-2 space-y-2 bg-background/40">
                <div className="flex items-center gap-2">
                  <Input
                    value={bl.nome}
                    onChange={(e) => updateBlocoNome(ti, bi, e.target.value)}
                    className="h-6 max-w-[140px] text-xs font-semibold"
                  />
                  <NewExerciseButton onAdd={(tipo) => addExercicio(ti, bi, tipo)} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive ml-auto"
                    onClick={() => removeBloco(ti, bi)}
                    disabled={tr.blocos.length === 1}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {bl.exercicios.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-1">Nenhum exercício. Use “+ Exercício”.</p>
                ) : (
                  <div className="space-y-2">
                    {bl.exercicios.map((ex, ei) => (
                      <ExercicioRow
                        key={ei}
                        ex={ex}
                        index={ei}
                        onRemove={() => removeExercicio(ti, bi, ei)}
                        onUpdate={(patch) => updateExercicio(ti, bi, ei, patch)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Observações */}
      <div className="glass-card rounded-lg p-4 space-y-2">
        <Label className="text-sm font-semibold">Observações</Label>
        <Textarea
          value={data.observacoes}
          onChange={(e) => setData((p) => ({ ...p, observacoes: e.target.value }))}
          rows={3}
          placeholder="Anotações livres do treino..."
        />
      </div>

      {/* Export dialog */}
      <Dialog open={exportOpen !== null} onOpenChange={(o) => !o && setExportOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{exportOpen === "print" ? "Imprimir treino" : "Exportar PDF"}</DialogTitle>
            <DialogDescription>
              Escolha quantas semanas devem aparecer na coluna Frequência (cada semana = 4 linhas T1–T4).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="weeks-select">Semanas</Label>
            <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
              <SelectTrigger id="weeks-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? "semana" : "semanas"} ({n * 4} linhas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                const mode = exportOpen;
                setExportOpen(null);
                if (mode) handleExport(mode, weeks);
              }}
            >
              {exportOpen === "print" ? "Imprimir" : "Gerar PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply to student */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar treino a um aluno</DialogTitle>
            <DialogDescription>
              O treino será salvo na ficha do aluno como o treino atual.
            </DialogDescription>
          </DialogHeader>
          <StudentPicker value={pickedAluno} onChange={setPickedAluno} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => pickedAluno && saveToAluno(pickedAluno)}
              disabled={!pickedAluno || saving}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Sub-componentes ============

function NewExerciseButton({ onAdd }: { onAdd: (tipo: "simples" | "dinamico") => void }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"simples" | "dinamico">("simples");
  return (
    <>
      <Button size="sm" variant="ghost" className="h-6" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3 mr-1" /> Exercício
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Como será o exercício?</DialogTitle>
            <DialogDescription>Defina o tipo de montagem antes de adicionar.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as "simples" | "dinamico")} className="gap-2">
            <label className="flex items-start gap-2 p-2 rounded border border-border cursor-pointer hover:bg-accent/50">
              <RadioGroupItem value="simples" id="t-simples" className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-sm font-semibold">Simples</div>
                <div className="text-[11px] text-muted-foreground">1 exercício por linha — repete em todas as semanas.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 p-2 rounded border border-border cursor-pointer hover:bg-accent/50">
              <RadioGroupItem value="dinamico" id="t-dinamico" className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-sm font-semibold">Dinâmico</div>
                <div className="text-[11px] text-muted-foreground">2+ variantes que alternam por semana (ímpar/par ou rotação).</div>
              </div>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onAdd(tipo); setOpen(false); }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoriaSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-24 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FORCA_CATEGORIAS.map((c) => (
          <SelectItem key={c} value={c} className="text-xs">
            {c} — {CATEGORY_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ExercicioRow({
  ex,
  index,
  onRemove,
  onUpdate,
}: {
  ex: PersonalizadoExercicio;
  index: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<PersonalizadoExercicio>) => void;
}) {
  return (
    <div className="rounded border border-border/60 p-2 bg-card/40 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-4">{index + 1}</span>
        <CategoriaSelect value={ex.categoria} onChange={(v) => onUpdate({ categoria: v })} />
        <Badge variant={ex.tipo === "dinamico" ? "default" : "outline"} className="text-[10px]">
          {ex.tipo === "dinamico" ? "DINÂMICO" : "SIMPLES"}
        </Badge>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive ml-auto"
          onClick={onRemove}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {ex.tipo === "simples" ? (
        <SimplesEditor ex={ex} onUpdate={onUpdate as (p: Partial<PersonalizadoExercicioSimples>) => void} />
      ) : (
        <DinamicoEditor ex={ex} onUpdate={onUpdate as (p: Partial<PersonalizadoExercicioDinamico>) => void} />
      )}
    </div>
  );
}

function SimplesEditor({
  ex,
  onUpdate,
}: {
  ex: PersonalizadoExercicioSimples;
  onUpdate: (p: Partial<PersonalizadoExercicioSimples>) => void;
}) {
  return (
    <div className="space-y-2">
      <ExerciseSelector
        categoria={ex.categoria}
        value={ex.exercicio}
        onChange={(val, video) => onUpdate({ exercicio: val, video_url: video })}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground">Séries</Label>
          <Input
            value={String(ex.series)}
            onChange={(e) => onUpdate({ series: e.target.value })}
            className="h-6 w-14 text-xs text-center"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground">Reps</Label>
          <Input
            value={ex.repeticoes}
            onChange={(e) => onUpdate({ repeticoes: e.target.value })}
            className="h-6 w-20 text-xs text-center"
          />
        </div>
      </div>
    </div>
  );
}

function DinamicoEditor({
  ex,
  onUpdate,
}: {
  ex: PersonalizadoExercicioDinamico;
  onUpdate: (p: Partial<PersonalizadoExercicioDinamico>) => void;
}) {
  const setRotacao = (rotacao: DinamicoRotacao) => {
    if (rotacao === "impar_par" && ex.variantes.length > 2) {
      onUpdate({ rotacao, variantes: ex.variantes.slice(0, 2) });
    } else {
      onUpdate({ rotacao });
    }
  };
  const setSeriesModo = (m: DinamicoSeriesModo) => onUpdate({ series_modo: m });
  const updateVariante = (i: number, patch: Partial<typeof ex.variantes[number]>) => {
    onUpdate({ variantes: ex.variantes.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  };
  const addVariante = () =>
    onUpdate({ variantes: [...ex.variantes, { exercicio: "" }] });
  const removeVariante = (i: number) =>
    onUpdate({ variantes: ex.variantes.filter((_, idx) => idx !== i) });

  const labelFor = (i: number) => {
    if (ex.rotacao === "impar_par") return i === 0 ? "Semanas ímpares (X)" : "Semanas pares (Y)";
    return `Semana ${i + 1}` + (ex.variantes.length > 1 ? ` / ${ex.variantes.length} (rotativa)` : "");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground">Rotação</Label>
          <Select value={ex.rotacao} onValueChange={(v) => setRotacao(v as DinamicoRotacao)}>
            <SelectTrigger className="h-6 text-[11px] w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="impar_par">Ímpar / Par</SelectItem>
              <SelectItem value="rotativa">N variantes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-[10px] text-muted-foreground">Séries/Reps</Label>
          <Select value={ex.series_modo} onValueChange={(v) => setSeriesModo(v as DinamicoSeriesModo)}>
            <SelectTrigger className="h-6 text-[11px] w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compartilhado">Compartilhado</SelectItem>
              <SelectItem value="independente">Independente por variante</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {ex.series_modo === "compartilhado" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground">Séries</Label>
            <Input
              value={String(ex.series)}
              onChange={(e) => onUpdate({ series: e.target.value })}
              className="h-6 w-14 text-xs text-center"
            />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground">Reps</Label>
            <Input
              value={ex.repeticoes}
              onChange={(e) => onUpdate({ repeticoes: e.target.value })}
              className="h-6 w-20 text-xs text-center"
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {ex.variantes.map((v, i) => (
          <div key={i} className="rounded border border-border/40 p-2 space-y-1 bg-background/30">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{labelFor(i)}</Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-destructive ml-auto"
                onClick={() => removeVariante(i)}
                disabled={ex.variantes.length <= 2}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <ExerciseSelector
              categoria={ex.categoria}
              value={v.exercicio}
              onChange={(val, video) => updateVariante(i, { exercicio: val, video_url: video })}
            />
            {ex.series_modo === "independente" && (
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-[10px] text-muted-foreground">Séries</Label>
                <Input
                  value={String(v.series ?? "")}
                  onChange={(e) => updateVariante(i, { series: e.target.value })}
                  className="h-6 w-14 text-xs text-center"
                />
                <Label className="text-[10px] text-muted-foreground">Reps</Label>
                <Input
                  value={String(v.repeticoes ?? "")}
                  onChange={(e) => updateVariante(i, { repeticoes: e.target.value })}
                  className="h-6 w-20 text-xs text-center"
                />
              </div>
            )}
          </div>
        ))}
        {ex.rotacao === "rotativa" && (
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={addVariante}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar variante
          </Button>
        )}
      </div>
    </div>
  );
}
