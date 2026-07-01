import { useEffect, useMemo, useRef, useState } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, FileDown, Printer, Save, Users, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { ExerciseSelector } from "./ExerciseSelector";
import { CATEGORY_LABELS } from "./workoutTemplates";
import { useExerciseCategories, type ExerciseCategory } from "@/hooks/useExerciseCategories";
import { SUBCATEGORIA_TO_CODE, CODE_TO_SUBCATEGORIA } from "@/lib/exerciseMapping";
import { StudentPicker } from "@/components/student/StudentPicker";
import { exportWorkoutPDF } from "./exportWorkoutPDF";
import { PrescribeOptionsDialog } from "./PrescribeOptionsDialog";
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
  /** Quando true, oculta botões de salvar/aplicar e desliga autosave remoto. */
  readOnly?: boolean;
}

const FORCA_CATEGORIAS = [
  "DJS","DJA","DQ","DQ_P","PH","PV","EH","EV","EP","EEF","EE","AH","AF","AR","ROT","PREV","COND",
  "KB","PLIO","ISO","ABD","ET","LPO","AUX",
];

const AQUECIMENTO_BLOCOS: { key: AquecimentoBloco; label: string }[] = [
  { key: "LIB", label: "Liberação (LIB)" },
  { key: "MOB", label: "Mobilidade (MOB)" },
  { key: "ATI", label: "Ativação (ATI)" },
  { key: "PREV", label: "Preventivo (PREV)" },
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
  readOnly = false,
}: Props) {
  const { user } = useAuth();
  const { categories, grupoSubcategorias } = useExerciseCategories();
  const aquecimentoGrupoMap: Record<AquecimentoBloco, string> = {
    LIB: "Liberação Miofascial",
    MOB: "Mobilidade Articular",
    ATI: "Ativação Muscular",
    PREV: "Preventivo",
  };
  // Grupos que pertencem ao bloco de aquecimento (não devem aparecer no seletor de FORÇA).
  const AQUECIMENTO_GRUPOS = new Set(Object.values(aquecimentoGrupoMap));
  const forcaCategories: ExerciseCategory[] = useMemo(
    () => categories.filter((c) => !AQUECIMENTO_GRUPOS.has(c.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories],
  );
  // IMPORTANT: `initial` and `initialName` are treated as initializers only.
  // We deliberately do NOT sync with later prop changes — re-syncing causes
  // the editor to wipe the user's in-progress prescription whenever the
  // parent re-renders (e.g. on browser tab focus, query refetch, or any
  // upstream state change that produces a new object reference).
  // The editor identity is tied to `modeloId`/`treinoId` via the parent's
  // conditional rendering, so a true "load different record" path naturally
  // remounts this component and re-initializes state from scratch.
  const [data, setData] = useState<PersonalizadoConteudo>(() => {
    const base = initial ?? emptyPersonalizado();
    return {
      ...base,
      aquecimento: {
        LIB: base.aquecimento?.LIB ?? [],
        MOB: base.aquecimento?.MOB ?? [],
        ATI: base.aquecimento?.ATI ?? [],
        PREV: base.aquecimento?.PREV ?? [],
      },
    };
  });
  const [name, setName] = useState(
    () => initialName ?? (alunoId ? "Treino Personalizado" : "Modelo Personalizado"),
  );
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState<null | "download" | "print">(null);
  const [weeks, setWeeks] = useState(4);
  const [applyOpen, setApplyOpen] = useState(false);
  const [pickedAluno, setPickedAluno] = useState("");
  const [prescribeOpen, setPrescribeOpen] = useState(false);
  const [prescribeTargetAluno, setPrescribeTargetAluno] = useState<string | null>(null);
  // Aba ativa do card "FORÇA" (apenas UI, não persiste).
  const [activeTreino, setActiveTreino] = useState(0);
  // Modo de visualização do painel "PADRÕES DE MOVIMENTO".
  const [padraoMode, setPadraoMode] = useState<"total" | "treino">("total");

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
      const aq = (parsed.data?.aquecimento ?? {}) as Partial<PersonalizadoConteudo["aquecimento"]>;
      setData({
        ...parsed.data,
        aquecimento: {
          LIB: aq.LIB ?? [],
          MOB: aq.MOB ?? [],
          ATI: aq.ATI ?? [],
          PREV: aq.PREV ?? [],
        },
      });
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
    if ((modeloId || treinoId) && !readOnly) {
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

  // ============ Reordenação (drag-and-drop) ============
  const reorderAquecimento = (bloco: AquecimentoBloco, from: number, to: number) => {
    if (from === to) return;
    setData((p) => ({
      ...p,
      aquecimento: {
        ...p.aquecimento,
        [bloco]: arrayMove(p.aquecimento[bloco] ?? [], from, to),
      },
    }));
  };
  const reorderExercicioForca = (ti: number, bi: number, from: number, to: number) => {
    if (from === to) return;
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t, i) =>
        i === ti
          ? {
              ...t,
              blocos: t.blocos.map((b, j) =>
                j === bi ? { ...b, exercicios: arrayMove(b.exercicios, from, to) } : b,
              ),
            }
          : t,
      ),
    }));
  };
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
    setData((p) => {
      const next = {
        ...p,
        treinos: [
          ...p.treinos,
          { nome: `Treino ${p.treinos.length + 1}`, blocos: [{ nome: "Bloco A", exercicios: [] }] },
        ],
      };
      // Seleciona automaticamente a aba do treino recém-criado.
      setActiveTreino(next.treinos.length - 1);
      return next;
    });
  };
  const removeTreino = (ti: number) => {
    setData((p) => {
      const next = { ...p, treinos: p.treinos.filter((_, i) => i !== ti) };
      // Mantém activeTreino dentro do range válido.
      setActiveTreino((curr) => Math.max(0, Math.min(curr, next.treinos.length - 1)));
      return next;
    });
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

  const saveToAluno = async (targetAlunoId: string, choice?: import("./PrescribeOptionsDialog").PrescribeChoice) => {
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
        const mode = choice?.mode ?? "now";
        if (mode === "now") {
          await supabase
            .from("treinos")
            .update({ status: "arquivado", updated_at: new Date().toISOString() })
            .eq("aluno_id", targetAlunoId)
            .eq("status", "atual");
        }
        const { data: ultimo } = await supabase
          .from("treinos")
          .select("versao")
          .eq("aluno_id", targetAlunoId)
          .order("versao", { ascending: false })
          .limit(1)
          .maybeSingle();
        const proximaVersao = (ultimo?.versao || 0) + 1;
        const insertRow: Record<string, unknown> = {
          aluno_id: targetAlunoId,
          autor_id: user.id,
          descricao: name,
          conteudo,
          status: mode === "schedule" ? "aguardando" : "atual",
          versao: proximaVersao,
          template_fase: "Personalizado",
        };
        if (choice?.mode === "schedule") {
          const d = choice.date;
          insertRow.data_inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
        const { error } = await supabase.from("treinos").insert(insertRow as never);
        if (error) throw error;
      }


      // Criar tarefa automática "Atualizar treino" em 30 dias
      try {
        const { data: alunoRow } = await supabase
          .from("alunos")
          .select("nome, responsavel_id")
          .eq("id", targetAlunoId)
          .maybeSingle();
        const respId = alunoRow?.responsavel_id || user.id;
        // Concluir tarefas antigas pendentes desse tipo para o mesmo aluno
        await supabase
          .from("tarefas")
          .update({ status: "concluida", updated_at: new Date().toISOString() })
          .eq("aluno_id", targetAlunoId)
          .eq("tipo_auto", "atualizar_treino")
          .neq("status", "concluida");
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 30);
        await supabase.from("tarefas").insert({
          titulo: `Atualizar treino — ${alunoRow?.nome || "aluno"}`,
          descricao: "Revisar e atualizar a prescrição de treino do aluno.",
          aluno_id: targetAlunoId,
          responsavel_id: respId,
          criado_por_id: user.id,
          data_limite: dataLimite.toISOString().split("T")[0],
          prioridade: "media",
          automatica: true,
          tipo_auto: "atualizar_treino",
        });
      } catch (e) {
        console.error("Erro ao criar tarefa automática:", e);
      }

      toast.success(
        choice?.mode === "schedule"
          ? `Treino programado para ${choice.date.toLocaleDateString("pt-BR")}.`
          : "Treino aplicado ao aluno",
      );
      clearDraft();
      onSaved?.();
    } catch (e) {
      toast.error("Erro ao aplicar: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
      setApplyOpen(false);
      setPrescribeOpen(false);
      setPrescribeTargetAluno(null);
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
      templateFase: "Personalizado",
      data: flat,
      print: mode === "print",
      weeks: weeksCount,
    });
  };

  // ============ Padrões de Movimento (contagem por CAT) ============
  const padraoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Sementes: códigos clássicos + códigos sintetizados a partir das subcategorias dinâmicas.
    FORCA_CATEGORIAS.forEach((c) => (counts[c] = 0));
    forcaCategories.forEach((g) =>
      g.subcategories.forEach((sub) => {
        const code = SUBCATEGORIA_TO_CODE[sub] ?? sub;
        if (!(code in counts)) counts[code] = 0;
      }),
    );
    const treinos =
      padraoMode === "treino" && data.treinos[activeTreino]
        ? [data.treinos[activeTreino]]
        : data.treinos;
    treinos.forEach((tr) => {
      tr.blocos.forEach((bl) => {
        bl.exercicios.forEach((ex) => {
          const cat = ex.categoria || "";
          if (!cat) return;
          counts[cat] = (counts[cat] ?? 0) + 1;
        });
      });
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [data.treinos, activeTreino, padraoMode, forcaCategories]);

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
          {!isAluno && !readOnly && (
            <>
              <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)}>
                <Users className="w-3 h-3 mr-1" /> Aplicar a aluno
              </Button>
              <Button size="sm" onClick={handleSaveModelo} disabled={saving}>
                <Save className="w-3 h-3 mr-1" /> {saving ? "Salvando..." : "Salvar modelo"}
              </Button>
            </>
          )}
          {isAluno && !readOnly && (
            <Button
              size="sm"
              onClick={() => {
                if (treinoId) {
                  saveToAluno(alunoId!);
                } else {
                  setPrescribeTargetAluno(alunoId!);
                  setPrescribeOpen(true);
                }
              }}
              disabled={saving}
            >
              <Save className="w-3 h-3 mr-1" /> {saving ? "Salvando..." : "Salvar no aluno"}
            </Button>
          )}
          {readOnly && (
            <span className="text-xs text-muted-foreground italic px-2">Somente leitura</span>
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
            {(data.aquecimento[b.key]?.length ?? 0) === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Nenhum exercício neste bloco.</p>
            ) : (
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={(e: DragEndEvent) => {
                  const { active, over } = e;
                  if (!over || active.id === over.id) return;
                  const items = data.aquecimento[b.key] ?? [];
                  const from = items.findIndex((_, idx) => `aq-${b.key}-${idx}` === active.id);
                  const to = items.findIndex((_, idx) => `aq-${b.key}-${idx}` === over.id);
                  if (from < 0 || to < 0) return;
                  reorderAquecimento(b.key, from, to);
                }}
              >
                <SortableContext
                  items={(data.aquecimento[b.key] ?? []).map((_, idx) => `aq-${b.key}-${idx}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {(data.aquecimento[b.key] ?? []).map((ex, i) => (
                      <SortableAqItem key={`${b.key}-${i}`} id={`aq-${b.key}-${i}`}>
                        {(handleProps) => (
                          <div className="flex items-start gap-2 p-2 rounded border border-border/50 bg-card/50">
                            <button
                              type="button"
                              {...handleProps}
                              className="mt-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
                              title="Arrastar para reordenar"
                              aria-label="Reordenar exercício"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </button>
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
                                  <SelectTrigger className="h-7 text-xs w-[160px] shrink-0">
                                    <SelectValue placeholder="Subcategoria..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(grupoSubcategorias[aquecimentoGrupoMap[b.key]] || []).map((sub) => (
                                      <SelectItem key={sub} value={sub} className="text-xs">
                                        {sub}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex-1 min-w-0">
                                  <ExerciseSelector
                                    categoria={b.key}
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
                        )}
                      </SortableAqItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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

        {/* PADRÕES DE MOVIMENTO */}
        {data.treinos.length > 0 && (
          <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-heading font-semibold tracking-wider text-muted-foreground">
                PADRÕES DE MOVIMENTO
              </span>
              <ToggleGroup
                type="single"
                size="sm"
                value={padraoMode}
                onValueChange={(v) => v && setPadraoMode(v as "total" | "treino")}
                className="h-6"
              >
                <ToggleGroupItem value="total" className="h-6 px-2 text-[10px]">
                  Total
                </ToggleGroupItem>
                <ToggleGroupItem value="treino" className="h-6 px-2 text-[10px]">
                  Treino atual
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(padraoCounts.counts).map((c) => {
                const n = padraoCounts.counts[c] ?? 0;
                const label = CATEGORY_LABELS[c] ?? CODE_TO_SUBCATEGORIA[c] ?? c;
                return (
                  <Badge
                    key={c}
                    variant={n > 0 ? "default" : "outline"}
                    className={`text-[10px] font-mono ${n === 0 ? "opacity-40" : ""}`}
                    title={label}
                  >
                    {c} {n}
                  </Badge>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Total: {padraoCounts.total} {padraoCounts.total === 1 ? "exercício" : "exercícios"}
              {padraoMode === "treino" && data.treinos[activeTreino]
                ? ` · ${data.treinos[activeTreino].nome}`
                : ""}
            </p>
          </div>
        )}

        {data.treinos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhum treino. Use “+ Treino”.
          </p>
        ) : (
          <Tabs
            value={String(Math.min(activeTreino, data.treinos.length - 1))}
            onValueChange={(v) => setActiveTreino(Number(v))}
          >
            <TabsList className="flex-wrap h-auto">
              {data.treinos.map((tr, ti) => (
                <TabsTrigger key={ti} value={String(ti)}>
                  {tr.nome || `Treino ${ti + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>

            {data.treinos.map((tr, ti) => (
              <TabsContent key={ti} value={String(ti)} className="mt-3">
                <div className="rounded-lg border border-border p-3 space-y-3 bg-card/30">
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
                        <div className="rounded-md border border-border/50 overflow-hidden">
                          <DndContext
                            sensors={dndSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e: DragEndEvent) => {
                              const { active, over } = e;
                              if (!over || active.id === over.id) return;
                              const from = bl.exercicios.findIndex((_, k) => `forca-${ti}-${bi}-${k}` === active.id);
                              const to = bl.exercicios.findIndex((_, k) => `forca-${ti}-${bi}-${k}` === over.id);
                              if (from < 0 || to < 0) return;
                              reorderExercicioForca(ti, bi, from, to);
                            }}
                          >
                            <SortableContext
                              items={bl.exercicios.map((_, k) => `forca-${ti}-${bi}-${k}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="w-6 h-8 px-1"></TableHead>
                                    <TableHead className="w-10 h-8 px-2 text-[10px]">#</TableHead>
                                    <TableHead className="w-24 h-8 px-2 text-[10px]">Categoria</TableHead>
                                    <TableHead className="h-8 px-2 text-[10px]">Exercício</TableHead>
                                    <TableHead className="w-16 h-8 px-2 text-[10px] text-center">Séries</TableHead>
                                    <TableHead className="w-20 h-8 px-2 text-[10px] text-center">Reps</TableHead>
                                    <TableHead className="w-10 h-8 px-2"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                {bl.exercicios.map((ex, ei) => (
                                  <SortableForcaTbody key={ei} id={`forca-${ti}-${bi}-${ei}`}>
                                    {(handleProps) => (
                                      <ExercicioRows
                                        ex={ex}
                                        index={ei}
                                        groups={forcaCategories}
                                        onRemove={() => removeExercicio(ti, bi, ei)}
                                        onUpdate={(patch) => updateExercicio(ti, bi, ei, patch)}
                                        handleProps={handleProps}
                                      />
                                    )}
                                  </SortableForcaTbody>
                                ))}
                              </Table>
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
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
              onClick={() => {
                if (!pickedAluno) return;
                setApplyOpen(false);
                setPrescribeTargetAluno(pickedAluno);
                setPrescribeOpen(true);
              }}
              disabled={!pickedAluno || saving}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrescribeOptionsDialog
        open={prescribeOpen}
        onOpenChange={(o) => {
          setPrescribeOpen(o);
          if (!o) setPrescribeTargetAluno(null);
        }}
        onConfirm={(choice) => {
          if (prescribeTargetAluno) saveToAluno(prescribeTargetAluno, choice);
        }}
        saving={saving}
        title="Prescrever treino"
      />
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
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: ExerciseCategory[];
}) {
  // Resolve o label exibido no trigger: se for um código clássico, mostra "DJS";
  // se for o nome de uma subcategoria custom, mostra um abreviado das iniciais.
  const isCode = !!CATEGORY_LABELS[value];
  const triggerLabel = isCode
    ? value
    : (value
        ? value
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 4)
            .toUpperCase()
        : "");
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-24 text-xs" title={CATEGORY_LABELS[value] ?? value}>
        <SelectValue>{triggerLabel}</SelectValue>
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
              const display = code
                ? `${code} — ${CATEGORY_LABELS[code] ?? sub}`
                : sub;
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

// ============ Renderização em tabela (estilo Fases) ============

type DragHandleProps = Record<string, unknown>;

function DragHandleCell({ handleProps }: { handleProps?: DragHandleProps }) {
  return (
    <TableCell className="px-1 py-1.5 align-middle w-6">
      {handleProps ? (
        <button
          type="button"
          {...handleProps}
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
          title="Arrastar para reordenar"
          aria-label="Reordenar exercício"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </TableCell>
  );
}

function ExercicioRows({
  ex,
  index,
  groups,
  onRemove,
  onUpdate,
  handleProps,
}: {
  ex: PersonalizadoExercicio;
  index: number;
  groups: ExerciseCategory[];
  onRemove: () => void;
  onUpdate: (patch: Partial<PersonalizadoExercicio>) => void;
  handleProps?: DragHandleProps;
}) {
  if (ex.tipo === "simples") {
    return (
      <SimplesRow
        ex={ex}
        index={index}
        groups={groups}
        onRemove={onRemove}
        onUpdate={onUpdate as (p: Partial<PersonalizadoExercicioSimples>) => void}
        handleProps={handleProps}
      />
    );
  }
  return (
    <DinamicoRows
      ex={ex}
      index={index}
      groups={groups}
      onRemove={onRemove}
      onUpdate={onUpdate as (p: Partial<PersonalizadoExercicioDinamico>) => void}
      handleProps={handleProps}
    />
  );
}

function SimplesRow({
  ex,
  index,
  groups,
  onRemove,
  onUpdate,
  handleProps,
}: {
  ex: PersonalizadoExercicioSimples;
  index: number;
  groups: ExerciseCategory[];
  onRemove: () => void;
  onUpdate: (p: Partial<PersonalizadoExercicioSimples>) => void;
  handleProps?: DragHandleProps;
}) {
  return (
    <TableRow className="border-b border-border/60">
      <DragHandleCell handleProps={handleProps} />
      <TableCell className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground align-middle">
        {index + 1}
      </TableCell>
      <TableCell className="px-2 py-1.5 align-middle">
        <CategoriaSelect value={ex.categoria} groups={groups} onChange={(v) => onUpdate({ categoria: v })} />
      </TableCell>
      <TableCell className="px-2 py-1.5 align-middle">
        <ExerciseSelector
          categoria={ex.categoria}
          value={ex.exercicio}
          onChange={(val, video) => onUpdate({ exercicio: val, video_url: video })}
        />
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center align-middle">
        <Input
          value={String(ex.series)}
          onChange={(e) => onUpdate({ series: e.target.value })}
          className="h-7 w-14 mx-auto text-xs text-center px-1"
        />
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center align-middle">
        <Input
          value={ex.repeticoes}
          onChange={(e) => onUpdate({ repeticoes: e.target.value })}
          className="h-7 w-20 mx-auto text-xs text-center px-1"
        />
      </TableCell>
      <TableCell className="px-2 py-1.5 align-middle">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive"
          onClick={onRemove}
          title="Remover exercício"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DinamicoRows({
  ex,
  index,
  groups,
  onRemove,
  onUpdate,
  handleProps,
}: {
  ex: PersonalizadoExercicioDinamico;
  index: number;
  groups: ExerciseCategory[];
  onRemove: () => void;
  onUpdate: (p: Partial<PersonalizadoExercicioDinamico>) => void;
  handleProps?: DragHandleProps;
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
    if (ex.rotacao === "impar_par") return i === 0 ? "X" : "Y";
    return `${i + 1}/${ex.variantes.length}`;
  };

  const compartilhado = ex.series_modo === "compartilhado";

  return (
    <>
      {/* Linha-cabeçalho do dinâmico */}
      <TableRow className="bg-primary/5 border-b border-border/60 hover:bg-primary/5">
        <DragHandleCell handleProps={handleProps} />
        <TableCell className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground align-middle">
          {index + 1}
        </TableCell>
        <TableCell className="px-2 py-1.5 align-middle">
          <CategoriaSelect value={ex.categoria} groups={groups} onChange={(v) => onUpdate({ categoria: v })} />
        </TableCell>
        <TableCell className="px-2 py-1.5 align-middle" colSpan={compartilhado ? 1 : 3}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-[10px]">DINÂMICO</Badge>
            <Select value={ex.rotacao} onValueChange={(v) => setRotacao(v as DinamicoRotacao)}>
              <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="impar_par">Ímpar / Par</SelectItem>
                <SelectItem value="rotativa">N variantes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ex.series_modo} onValueChange={(v) => setSeriesModo(v as DinamicoSeriesModo)}>
              <SelectTrigger className="h-7 text-[11px] w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compartilhado">Séries compartilhadas</SelectItem>
                <SelectItem value="independente">Séries por variante</SelectItem>
              </SelectContent>
            </Select>
            {ex.rotacao === "rotativa" && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={addVariante}>
                <Plus className="w-3 h-3 mr-1" /> Variante
              </Button>
            )}
          </div>
        </TableCell>
        {compartilhado && (
          <>
            <TableCell className="px-2 py-1.5 text-center align-middle">
              <Input
                value={String(ex.series)}
                onChange={(e) => onUpdate({ series: e.target.value })}
                className="h-7 w-14 mx-auto text-xs text-center px-1"
              />
            </TableCell>
            <TableCell className="px-2 py-1.5 text-center align-middle">
              <Input
                value={ex.repeticoes}
                onChange={(e) => onUpdate({ repeticoes: e.target.value })}
                className="h-7 w-20 mx-auto text-xs text-center px-1"
              />
            </TableCell>
          </>
        )}
        <TableCell className="px-2 py-1.5 align-middle">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive"
            onClick={onRemove}
            title="Remover exercício"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </TableCell>
      </TableRow>

      {/* Linhas das variantes */}
      {ex.variantes.map((v, i) => (
        <TableRow key={i} className="border-b border-border/30 bg-background/40">
          <TableCell className="px-1 py-1.5 align-middle w-6" />

          <TableCell className="px-2 py-1.5 align-middle">
            <Badge variant="outline" className="text-[10px] font-mono">{labelFor(i)}</Badge>
          </TableCell>
          <TableCell className="px-2 py-1.5 align-middle">
            <span className="text-[10px] text-muted-foreground font-mono">{ex.categoria}</span>
          </TableCell>
          <TableCell className="px-2 py-1.5 align-middle">
            <ExerciseSelector
              categoria={ex.categoria}
              value={v.exercicio}
              onChange={(val, video) => updateVariante(i, { exercicio: val, video_url: video })}
            />
          </TableCell>
          <TableCell className="px-2 py-1.5 text-center align-middle">
            {compartilhado ? (
              <span className="text-[11px] text-muted-foreground">{String(ex.series ?? "—")}</span>
            ) : (
              <Input
                value={String(v.series ?? "")}
                onChange={(e) => updateVariante(i, { series: e.target.value })}
                className="h-7 w-14 mx-auto text-xs text-center px-1"
              />
            )}
          </TableCell>
          <TableCell className="px-2 py-1.5 text-center align-middle">
            {compartilhado ? (
              <span className="text-[11px] text-muted-foreground">{ex.repeticoes || "—"}</span>
            ) : (
              <Input
                value={String(v.repeticoes ?? "")}
                onChange={(e) => updateVariante(i, { repeticoes: e.target.value })}
                className="h-7 w-20 mx-auto text-xs text-center px-1"
              />
            )}
          </TableCell>
          <TableCell className="px-2 py-1.5 align-middle">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive"
              onClick={() => removeVariante(i)}
              disabled={ex.variantes.length <= 2}
              title="Remover variante"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
