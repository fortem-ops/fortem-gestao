import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlunoDeficitsAlert } from "./AlunoDeficitsAlert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
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
  ChevronRight,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  type FoolproofConteudo,
  type FPEstadoLevantamento,
  type FPFase,
  type FPLevantamento,
  type FPOrigem,
  FOOLPROOF_LABEL,
  FP_LEVANTAMENTOS,
  FP_LEV_BASE,
  FP_FASES,
  FP_FASE_LABEL,
  FP_FASE_ESQUEMA,
  FP_MIN_LEVANTAMENTOS,
  FP_MAX_LEVANTAMENTOS,
  FP_DIAS_MIN,
  FP_DIAS_MAX,
  FP_HIPER_REPS,
  FP_HIPER_SERIES_MIN,
  FP_HIPER_SERIES_MAX,
  emptyFoolproof,
  estadoVazioFP,
  ajustarDiasFP,
  normalizarLevantamentosFP,
  normalizarAuxiliaresFP,
  fpSlots,
  pesoInicialFP,
  incrementoFP,
  rm1PorLombardi,
  definirRm1FP,
  alvoFP,
  alvoHipertrofiaFP,
  avancarFaseFP,
  definirFaseFP,
  encerrarCicloFP,
  reabrirCicloFP,
  cicloConcluidoFP,
  fpLevantamentosDoSlot,
  auxiliarVazioFP,
} from "@/lib/foolproof";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { AuxiliaresBlock } from "@/components/student/workout/AuxiliaresBlock";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { exportFoolproofPDF } from "./exportFoolproofPDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: FoolproofConteudo;
  onSaved?: () => void;
}

const PCT_HIPER = [0.5, 0.55, 0.6, 0.65, 0.7];

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PrescricaoFoolproofEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<FoolproofConteudo>(() => {
    const base = initial ?? emptyFoolproof();
    const dias = base.diasTreinoSemana ?? 3;
    return {
      ...base,
      diasTreinoSemana: dias,
      levantamentos: normalizarLevantamentosFP(base.levantamentos, dias),
      auxiliaresPorSlot: normalizarAuxiliaresFP(base.auxiliaresPorSlot, dias),
    };
  });
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNext = useRef(true);
  const [lombardiInput, setLombardiInput] = useState<
    Record<number, { carga: string; reps: string }>
  >({});
  const [finalInput, setFinalInput] = useState<Record<number, string>>({});

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

  const DIAS = useMemo(() => fpSlots(data.diasTreinoSemana), [data.diasTreinoSemana]);

  // ── Autosave ────────────────────────────────────────────────
  const saveDraft = useCallback(
    async (next: FoolproofConteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = `${FOOLPROOF_LABEL} — progressão linear a partir do 1RM`;
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
              template_fase: FOOLPROOF_LABEL,
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
    aq: FoolproofConteudo["aquecimento"] | undefined,
  ): Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]> =>
    ensureAquecimentoRecord(aq, siglasAq);
  const addAq = (b: AquecimentoBloco) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return {
        ...p,
        aquecimento: {
          ...aq,
          [b]: [...aq[b], { exercicio: "", repeticoes: "10", dias: [...DIAS] }],
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

  // ── Levantamentos ───────────────────────────────────────────
  const patchLev = (idx: number, patch: Partial<FPEstadoLevantamento>) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));

  const aplicarLev = (idx: number, fn: (l: FPEstadoLevantamento) => FPEstadoLevantamento) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) => (i === idx ? fn(l) : l)),
    }));

  const addLevantamento = () =>
    setData((p) => {
      if (p.levantamentos.length >= FP_MAX_LEVANTAMENTOS) return p;
      const usados = new Set(p.levantamentos.map((l) => l.levantamento));
      const livre = FP_LEVANTAMENTOS.find((l) => !usados.has(l)) ?? FP_LEVANTAMENTOS[0];
      const slots = fpSlots(p.diasTreinoSemana);
      return {
        ...p,
        levantamentos: [
          ...p.levantamentos,
          estadoVazioFP(livre, slots[p.levantamentos.length % slots.length]),
        ],
      };
    });

  const removeLevantamento = (idx: number) =>
    setData((p) =>
      p.levantamentos.length <= FP_MIN_LEVANTAMENTOS
        ? p
        : { ...p, levantamentos: p.levantamentos.filter((_, i) => i !== idx) },
    );

  const setRm1 = (idx: number, origem: FPOrigem) => aplicarLev(idx, (l) => definirRm1FP(l, origem));

  const aplicarLombardi = (idx: number) => {
    const entrada = lombardiInput[idx];
    const carga = Number(entrada?.carga) || 0;
    const reps = Number(entrada?.reps) || 0;
    if (!carga || !reps) {
      toast.error("Informe carga e repetições do teste.");
      return;
    }
    const rm1 = rm1PorLombardi(carga, reps);
    setRm1(idx, { tipo: "lombardi", carga, reps, rm1 });
    toast.success(
      `1RM estimado: ${rm1.toFixed(1)} kg → peso inicial ${pesoInicialFP(rm1)} kg (incremento ${incrementoFP(rm1)} kg).`,
    );
  };

  const encerrarCiclo = (idx: number) => {
    const rm1 = Number(finalInput[idx]) || 0;
    aplicarLev(idx, (l) => encerrarCicloFP(l, hojeISO(), rm1 || null));
    setFinalInput((p) => ({ ...p, [idx]: "" }));
    toast.success(rm1 ? `Ciclo encerrado — 1RM final: ${rm1} kg.` : "Ciclo encerrado.");
  };

  // ── Auxiliares por slot ─────────────────────────────────────
  const updateAux = (
    slot: string,
    i: number,
    patch: Partial<ReturnType<typeof auxiliarVazioFP>>,
  ) =>
    setData((p) => ({
      ...p,
      auxiliaresPorSlot: {
        ...p.auxiliaresPorSlot,
        [slot]: (p.auxiliaresPorSlot[slot] ?? []).map((a, idx) =>
          idx === i ? { ...a, ...patch } : a,
        ),
      },
    }));

  const addAux = (slot: string) =>
    setData((p) => ({
      ...p,
      auxiliaresPorSlot: {
        ...p.auxiliaresPorSlot,
        [slot]: [...(p.auxiliaresPorSlot[slot] ?? []), auxiliarVazioFP()],
      },
    }));

  const removeAux = (slot: string, i: number) =>
    setData((p) => ({
      ...p,
      auxiliaresPorSlot: {
        ...p.auxiliaresPorSlot,
        [slot]: (p.auxiliaresPorSlot[slot] ?? []).filter((_, idx) => idx !== i),
      },
    }));

  // ── Publicar ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    if (data.levantamentos.some((l) => !l.pesoAtual && !cicloConcluidoFP(l))) {
      toast.error("Defina o 1RM de referência de todos os levantamentos.");
      return;
    }
    const nomes = data.levantamentos.map((l) => l.levantamento);
    if (new Set(nomes).size !== nomes.length) {
      toast.error("Não repita o mesmo levantamento.");
      return;
    }
    if (data.levantamentos.some((l) => l.hipertrofia?.ativa && l.hipertrofia.slot === l.slotPrincipal)) {
      toast.error("A sessão de hipertrofia precisa estar em um dia diferente da sessão principal.");
      return;
    }
    const faltando = DIAS.some((slot) =>
      (data.auxiliaresPorSlot[slot] ?? []).some((a) => !a.categoria || !a.exercicio),
    );
    if (faltando) {
      toast.error("Escolha categoria e exercício de todos os auxiliares.");
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
      const { error } = await supabase
        .from("treinos")
        .update({
          status: "atual",
          data_inicio: hojeISO(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", treinoId);
      if (error) throw error;
      toast.success("Prescrição Foolproof enviada ao aluno.");
      onSaved?.();
      onBack();
    } catch (e) {
      toast.error("Erro ao concluir: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPublishing(false);
    }
  };

  // ── PDF ─────────────────────────────────────────────────────
  const handleExport = async (mode: "download" | "print") => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", alunoId)
        .maybeSingle();
      const student = (aluno ?? { id: alunoId, nome: alunoNome }) as Tables<"alunos">;
      await exportFoolproofPDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Render levantamento ─────────────────────────────────────
  const renderLevantamento = (lev: FPEstadoLevantamento, idx: number) => {
    const base = FP_LEV_BASE[lev.levantamento];
    const alvo = alvoFP(lev);
    const hiper = alvoHipertrofiaFP(lev);
    const entrada = lombardiInput[idx] ?? { carga: "", reps: "" };
    const concluido = cicloConcluidoFP(lev);
    const rm1 = lev.origem.rm1 ?? 0;
    return (
      <Card key={idx}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Levantamento {idx + 1}</Badge>
            <Select
              value={lev.levantamento}
              onValueChange={(v) => patchLev(idx, { levantamento: v as FPLevantamento })}
            >
              <SelectTrigger className="h-8 w-[220px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FP_LEVANTAMENTOS.map((l) => (
                  <SelectItem key={l} value={l} className="text-sm">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant={concluido ? "secondary" : "default"}>
              {concluido ? "Ciclo concluído" : FP_FASE_LABEL[lev.fase]}
            </Badge>
            {data.levantamentos.length > FP_MIN_LEVANTAMENTOS && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive ml-auto"
                onClick={() => removeLevantamento(idx)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Exercício do banco: <span className="font-medium">{base.nome}</span>
          </p>

          {/* Origem do 1RM */}
          <div className="rounded-md border border-border/60 p-3 space-y-3">
            <p className="text-xs font-semibold flex items-center gap-2">
              1RM de referência
              <HelpTip title="De onde vem o 1RM">
                <p>
                  Pode ser herdado do 1RM testado no fim do Power to the People 2.0, estimado por
                  Lombardi (teste de carga × repetições) ou digitado direto.
                </p>
                <p>
                  O peso inicial é 70% desse 1RM e o incremento semanal é 2,5% dele (mínimo 2,5 kg),
                  sempre a mesma fatia — não é composto.
                </p>
              </HelpTip>
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs">Origem</Label>
              <Select
                value={lev.origem.tipo === "lombardi" ? "novo" : lev.origem.tipo}
                onValueChange={(v) =>
                  setRm1(idx, v === "herdado" ? { tipo: "herdado", rm1 } : { tipo: "novo", rm1 })
                }
              >
                <SelectTrigger className="h-8 w-[280px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="herdado" className="text-xs">
                    Herdado do PTTP 2.0 (1RM testado)
                  </SelectItem>
                  <SelectItem value="novo" className="text-xs">
                    Novo (Lombardi ou 1RM direto)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">1RM de referência (kg)</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={rm1 || ""}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setRm1(
                      idx,
                      lev.origem.tipo === "herdado"
                        ? { tipo: "herdado", rm1: v }
                        : { tipo: "novo", rm1: v },
                    );
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Peso atual (kg)</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={lev.pesoAtual || ""}
                  onChange={(e) => patchLev(idx, { pesoAtual: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="text-xs">Incremento semanal (kg)</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={lev.incremento || ""}
                  onChange={(e) => patchLev(idx, { incremento: Number(e.target.value) || 0 })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {rm1
                  ? `${rm1.toFixed(1)} kg × 70% = ${pesoInicialFP(rm1)} kg · +${incrementoFP(rm1)} kg por semana`
                  : "Informe o 1RM de referência."}
              </p>
            </div>

            {lev.origem.tipo !== "herdado" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border-t pt-3">
                <div>
                  <Label className="text-xs">Teste — carga (kg)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={entrada.carga}
                    onChange={(e) =>
                      setLombardiInput((p) => ({
                        ...p,
                        [idx]: { ...entrada, carga: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Teste — reps</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={entrada.reps}
                    onChange={(e) =>
                      setLombardiInput((p) => ({
                        ...p,
                        [idx]: { ...entrada, reps: e.target.value },
                      }))
                    }
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => aplicarLombardi(idx)}>
                  Calcular 1RM por Lombardi
                </Button>
                {lev.origem.tipo === "lombardi" && (
                  <p className="text-[11px] text-muted-foreground">
                    Origem: Lombardi ({lev.origem.carga} kg × {lev.origem.reps} reps)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sessões: principal e hipertrofia */}
          <div className="rounded-md border border-border/60 p-3 space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <Label className="text-xs">Dia da sessão principal</Label>
                <Select
                  value={lev.slotPrincipal}
                  onValueChange={(v) => patchLev(idx, { slotPrincipal: v })}
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                1x por semana · dispara o incremento automático.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t">
              <Switch
                checked={lev.hipertrofia?.ativa ?? false}
                onCheckedChange={(v) =>
                  patchLev(idx, { hipertrofia: { ...lev.hipertrofia, ativa: v } })
                }
              />
              <Label className="text-xs">Sessão de hipertrofia (opcional, sem progressão)</Label>
            </div>

            {lev.hipertrofia?.ativa && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs">Dia</Label>
                  <Select
                    value={lev.hipertrofia.slot}
                    onValueChange={(v) =>
                      patchLev(idx, { hipertrofia: { ...lev.hipertrofia, slot: v } })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS.map((d) => (
                        <SelectItem key={d} value={d} className="text-xs">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Séries (reps sempre {FP_HIPER_REPS})</Label>
                  <Select
                    value={String(lev.hipertrofia.series)}
                    onValueChange={(v) =>
                      patchLev(idx, {
                        hipertrofia: { ...lev.hipertrofia, series: Number(v) },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: FP_HIPER_SERIES_MAX - FP_HIPER_SERIES_MIN + 1 },
                        (_, i) => FP_HIPER_SERIES_MIN + i,
                      ).map((s) => (
                        <SelectItem key={s} value={String(s)} className="text-xs">
                          {s} séries
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">% do 1RM</Label>
                  <Select
                    value={String(lev.hipertrofia.pct)}
                    onValueChange={(v) =>
                      patchLev(idx, { hipertrofia: { ...lev.hipertrofia, pct: Number(v) } })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PCT_HIPER.map((p) => (
                        <SelectItem key={p} value={String(p)} className="text-xs">
                          {Math.round(p * 100)}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {hiper ? `${hiper.esquema} @ ${hiper.peso || "—"} kg (fixo)` : "—"}
                </p>
              </div>
            )}
          </div>

          {/* Fase e estado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Próxima sessão principal</p>
              <p className="font-semibold tabular-nums">
                {concluido ? "—" : `${alvo.esquema} @ ${alvo.peso || "—"} kg`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Fase atual</p>
              <p className="font-semibold">{FP_FASE_LABEL[lev.fase]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Semanas registradas</p>
              <p className="font-semibold tabular-nums">{lev.historico.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">1RM final</p>
              <p className="font-semibold tabular-nums">
                {lev.rm1Final ? `${lev.rm1Final} kg` : "—"}
              </p>
            </div>
          </div>

          {concluido ? (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Ciclo concluído
                {lev.rm1Final ? ` — 1RM final: ${lev.rm1Final} kg` : ""}
                {lev.concluidoEm ? ` (${lev.concluidoEm})` : ""}
              </p>
              <Button variant="outline" size="sm" onClick={() => aplicarLev(idx, reabrirCicloFP)}>
                Reabrir ciclo
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs">Trocar fase manualmente</Label>
                <Select
                  value={lev.fase}
                  onValueChange={(v) => aplicarLev(idx, (l) => definirFaseFP(l, v as FPFase))}
                >
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FP_FASES.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {FP_FASE_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => aplicarLev(idx, avancarFaseFP)}
                disabled={lev.fase === "2x2"}
              >
                <ChevronRight className="w-3 h-3 mr-1" /> Avançar fase
              </Button>
              <div>
                <Label className="text-xs">1RM final (opcional)</Label>
                <Input
                  type="number"
                  className="h-8 w-[140px]"
                  value={finalInput[idx] ?? ""}
                  onChange={(e) => setFinalInput((p) => ({ ...p, [idx]: e.target.value }))}
                />
              </div>
              <Button size="sm" onClick={() => encerrarCiclo(idx)}>
                Encerrar ciclo
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            A troca de fase e o encerramento do ciclo são sempre manuais. A cada sessão principal
            concluída pelo aluno o peso sobe {lev.incremento || incrementoFP(rm1)} kg.
          </p>

          {/* Histórico */}
          {lev.historico.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1 pr-3 font-semibold">Semana</th>
                    <th className="py-1 pr-3 font-semibold">Data</th>
                    <th className="py-1 pr-3 font-semibold">Peso</th>
                    <th className="py-1 font-semibold">Fase</th>
                  </tr>
                </thead>
                <tbody>
                  {lev.historico.map((h, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 pr-3 font-semibold">SEMANA {h.semana}</td>
                      <td className="py-1 pr-3">{h.data}</td>
                      <td className="py-1 pr-3">{h.peso} kg</td>
                      <td className="py-1">{FP_FASE_ESQUEMA[h.fase]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
              <Sparkles className="w-5 h-5 text-primary" /> {FOOLPROOF_LABEL} · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Frequência livre · 2 a 4 levantamentos · incremento fixo a partir do 1RM.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Levantamentos ({data.levantamentos.length})
            <HelpTip title="Como funciona o Foolproof">
              <p>
                Cada levantamento tem uma sessão principal por semana, em qualquer dia (T1…Tn), e
                pode compartilhar o dia com outros levantamentos.
              </p>
              <p>
                O peso sobe sempre a mesma fatia (2,5% do 1RM original) a cada sessão principal
                concluída. A sessão de hipertrofia, se ligada, é fixa e não progride.
              </p>
            </HelpTip>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs">Dias de treino</Label>
              <Select
                value={String(data.diasTreinoSemana)}
                onValueChange={(v) => setData((p) => ajustarDiasFP(p, Number(v)))}
              >
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: FP_DIAS_MAX - FP_DIAS_MIN + 1 },
                    (_, i) => FP_DIAS_MIN + i,
                  ).map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={addLevantamento}
                disabled={data.levantamentos.length >= FP_MAX_LEVANTAMENTOS}
              >
                <Plus className="w-3 h-3 mr-1" /> Levantamento
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            De {FP_MIN_LEVANTAMENTOS} a {FP_MAX_LEVANTAMENTOS} levantamentos · dias {DIAS.join(", ")}.
          </p>
        </CardContent>
      </Card>

      {data.levantamentos.map((lev, idx) => renderLevantamento(lev, idx))}

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
                  <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
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
                        <span className="text-[10px] text-muted-foreground mt-2 w-4">{i + 1}</span>
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
                            <Label className="text-[10px] text-muted-foreground ml-2">Dias</Label>
                            <div className="flex gap-1">
                              {DIAS.map((d) => {
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

      {/* Treinos por slot */}
      {DIAS.map((slot, i) => {
        const sessoes = fpLevantamentosDoSlot(data, slot);
        return (
          <Card key={slot}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>{slot}</Badge>
                <span>Treino {i + 1}</span>
                <span className="text-muted-foreground font-normal text-sm">
                  —{" "}
                  {sessoes.length
                    ? sessoes
                        .map(
                          (s) =>
                            `${s.estado.levantamento}${s.tipo === "hipertrofia" ? " (hipertrofia)" : ""}`,
                        )
                        .join(" + ")
                    : "sem levantamentos"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Levantamentos
                </p>
                {sessoes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum levantamento marcado para este dia.
                  </p>
                )}
                {sessoes.map((s, k) => {
                  const alvo = alvoFP(s.estado);
                  const hiper = alvoHipertrofiaFP(s.estado);
                  return (
                    <div key={k} className="flex items-center justify-between text-xs gap-2">
                      <span className="font-medium">
                        {s.estado.levantamento}
                        {s.tipo === "hipertrofia" ? " · hipertrofia" : " · principal"}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.tipo === "hipertrofia" ? (
                          <>
                            {hiper?.esquema} ·{" "}
                            <strong className="text-foreground">{hiper?.peso || "—"} kg</strong>
                          </>
                        ) : alvo.concluido ? (
                          <>Ciclo concluído</>
                        ) : (
                          <>
                            {alvo.esquema} ·{" "}
                            <strong className="text-foreground">{alvo.peso || "—"} kg</strong>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <AuxiliaresBlock
                title="Auxiliares (3)"
                emptyLabel="Sem auxiliares neste treino."
                itens={data.auxiliaresPorSlot[slot] ?? []}
                categorias={categoriasForca}
                onAdd={() => addAux(slot)}
                onUpdate={(k, patch) => updateAux(slot, k, patch)}
                onRemove={(k) => removeAux(slot, k)}
              />
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.observacoes}
            onChange={(e) => setData((p) => ({ ...p, observacoes: e.target.value }))}
            placeholder="Orientações gerais para o aluno…"
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}
