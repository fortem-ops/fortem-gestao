import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlunoDeficitsAlert } from "./AlunoDeficitsAlert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  type EasyStrengthConteudo,
  type ESFrequencia,
  type ESLevantamento,
  type ESNivel,
  EASY_STRENGTH_LABEL,
  ES_LEVANTAMENTOS,
  ES_LEV_BASE,
  ES_MAX_LEVANTAMENTOS,
  ES_MIN_LEVANTAMENTOS,
  ES_NIVEIS,
  ES_NIVEL_LABEL,
  ES_TOTAL_SEMANAS,
  ajustarFrequenciaES,
  auxiliarVazioES,
  emptyEasyStrength,
  esSlots,
  kgES,
  normalizarLevantamentosES,
  normalizarSessoesES,
  planoES,
  semanaAtualES,
  sessaoDoSlotES,
  tabelaES,
} from "@/lib/easyStrength";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { AuxiliaresBlock } from "@/components/student/workout/AuxiliaresBlock";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { MethodGuideSheet } from "@/components/student/workout/MethodGuideSheet";
import { EASY_STRENGTH_METHOD_GUIDE } from "@/components/student/workout/methodGuides";
import { exportEasyStrengthPDF } from "./exportEasyStrengthPDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: EasyStrengthConteudo;
  onSaved?: () => void;
}

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PrescricaoEasyStrengthEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<EasyStrengthConteudo>(() => {
    const base = initial ?? emptyEasyStrength();
    const frequencia: ESFrequencia = base.frequencia === 2 ? 2 : 3;
    return {
      ...base,
      frequencia,
      levantamentos: normalizarLevantamentosES(base.levantamentos),
      sessoes: normalizarSessoesES(base.sessoes, frequencia),
    };
  });
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNext = useRef(true);
  const [concluidasPorSlot, setConcluidasPorSlot] = useState<Record<string, number>>({});

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

  const DIAS = useMemo(() => esSlots(data.frequencia), [data.frequencia]);

  const semanaPorSlot = useMemo(() => {
    const out: Record<string, number> = {};
    DIAS.forEach((slot) => {
      out[slot] = semanaAtualES(concluidasPorSlot[slot] ?? 0);
    });
    return out;
  }, [DIAS, concluidasPorSlot]);

  // ── Sessões concluídas (progresso cíclico por slot) ─────────
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!treinoId) return;
      const { data: rows } = await supabase
        .from("treino_sessoes")
        .select("variacao, concluido_em")
        .eq("treino_id", treinoId);
      if (cancel || !rows) return;
      const counts: Record<string, number> = {};
      rows.forEach((r) => {
        if (!r.concluido_em || !r.variacao) return;
        counts[r.variacao] = (counts[r.variacao] ?? 0) + 1;
      });
      setConcluidasPorSlot(counts);
    })();
    return () => {
      cancel = true;
    };
  }, [treinoId]);

  // ── Autosave ────────────────────────────────────────────────
  const saveDraft = useCallback(
    async (next: EasyStrengthConteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = `${EASY_STRENGTH_LABEL} — tabela fixa de 9 semanas`;
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
              template_fase: EASY_STRENGTH_LABEL,
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
    aq: EasyStrengthConteudo["aquecimento"] | undefined,
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
  const patchLev = (idx: number, patch: Partial<{ levantamento: ESLevantamento; rm1: number }>) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));

  const addLevantamento = () =>
    setData((p) => {
      if (p.levantamentos.length >= ES_MAX_LEVANTAMENTOS) return p;
      const usados = new Set(p.levantamentos.map((l) => l.levantamento));
      const livre = ES_LEVANTAMENTOS.find((l) => !usados.has(l)) ?? ES_LEVANTAMENTOS[0];
      return { ...p, levantamentos: [...p.levantamentos, { levantamento: livre, rm1: 0 }] };
    });

  const removeLevantamento = (idx: number) =>
    setData((p) =>
      p.levantamentos.length <= ES_MIN_LEVANTAMENTOS
        ? p
        : { ...p, levantamentos: p.levantamentos.filter((_, i) => i !== idx) },
    );

  // ── Sessões / auxiliares ────────────────────────────────────
  const setNivel = (slot: string, nivel: ESNivel) =>
    setData((p) => ({
      ...p,
      sessoes: p.sessoes.map((s) => (s.slot === slot ? { ...s, nivel } : s)),
    }));

  const updateAux = (slot: string, i: number, patch: Partial<ReturnType<typeof auxiliarVazioES>>) =>
    setData((p) => ({
      ...p,
      sessoes: p.sessoes.map((s) =>
        s.slot === slot
          ? { ...s, auxiliares: s.auxiliares.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }
          : s,
      ),
    }));

  const addAux = (slot: string) =>
    setData((p) => ({
      ...p,
      sessoes: p.sessoes.map((s) =>
        s.slot === slot ? { ...s, auxiliares: [...s.auxiliares, auxiliarVazioES()] } : s,
      ),
    }));

  const removeAux = (slot: string, i: number) =>
    setData((p) => ({
      ...p,
      sessoes: p.sessoes.map((s) =>
        s.slot === slot ? { ...s, auxiliares: s.auxiliares.filter((_, idx) => idx !== i) } : s,
      ),
    }));

  // ── Publicar ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    if (data.levantamentos.some((l) => !l.rm1)) {
      toast.error("Informe o 1RM de todos os levantamentos.");
      return;
    }
    const nomes = data.levantamentos.map((l) => l.levantamento);
    if (new Set(nomes).size !== nomes.length) {
      toast.error("Não repita o mesmo levantamento.");
      return;
    }
    const niveis = data.sessoes.map((s) => s.nivel);
    if (new Set(niveis).size !== niveis.length) {
      toast.error("Cada sessão precisa de um nível diferente.");
      return;
    }
    const faltando = data.sessoes.some((s) =>
      s.auxiliares.some((a) => !a.categoria || !a.exercicio),
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
      toast.success("Prescrição Easy Strength enviada ao aluno.");
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
      await exportEasyStrengthPDF({
        student,
        data,
        semanaPorSlot,
        print: mode === "print",
      });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const niveisUsados = data.sessoes.map((s) => s.nivel);

  return (
    <div className="container mx-auto p-6 max-w-6xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> {EASY_STRENGTH_LABEL} · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Tabela fixa de {ES_TOTAL_SEMANAS} semanas · 2 a 3 levantamentos em todas as sessões.
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
          <MethodGuideSheet guide={EASY_STRENGTH_METHOD_GUIDE} />
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

      {/* Levantamentos e 1RM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Levantamentos ({data.levantamentos.length})
            <HelpTip title="Como funciona o Easy Strength">
              <p>
                Todos os levantamentos escolhidos são treinados em todas as sessões, sempre no
                mesmo nível daquela sessão (Leve, Pesado ou Médio).
              </p>
              <p>
                A tabela de 9 semanas é fixa. Depois da 9ª sessão de um dia o ciclo reinicia na
                semana 1 — atualize o 1RM quando julgar que o aluno ficou mais forte.
              </p>
            </HelpTip>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs">Sessões por semana</Label>
              <Select
                value={String(data.frequencia)}
                onValueChange={(v) =>
                  setData((p) => ajustarFrequenciaES(p, Number(v) === 2 ? 2 : 3))
                }
              >
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2" className="text-xs">
                    2x
                  </SelectItem>
                  <SelectItem value="3" className="text-xs">
                    3x
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={addLevantamento}
                disabled={data.levantamentos.length >= ES_MAX_LEVANTAMENTOS}
              >
                <Plus className="w-3 h-3 mr-1" /> Levantamento
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.levantamentos.map((lev, idx) => {
            const base = ES_LEV_BASE[lev.levantamento];
            return (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[220px_140px_1fr_auto] gap-3 items-end rounded-md border border-border/60 p-3"
              >
                <div>
                  <Label className="text-xs">Levantamento</Label>
                  <Select
                    value={lev.levantamento}
                    onValueChange={(v) => patchLev(idx, { levantamento: v as ESLevantamento })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ES_LEVANTAMENTOS.map((l) => (
                        <SelectItem key={l} value={l} className="text-sm">
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">1RM (kg)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={lev.rm1 || ""}
                    onChange={(e) => patchLev(idx, { rm1: Number(e.target.value) || 0 })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Banco: <span className="font-medium">{base.nome}</span>
                  {lev.rm1 ? (
                    <>
                      {" "}
                      · 70% = {kgES(lev.rm1, 70)} kg · 85% = {kgES(lev.rm1, 85)} kg · 90% ={" "}
                      {kgES(lev.rm1, 90)} kg
                    </>
                  ) : (
                    " · informe o 1RM para calcular as cargas."
                  )}
                </p>
                {data.levantamentos.length > ES_MIN_LEVANTAMENTOS && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeLevantamento(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            De {ES_MIN_LEVANTAMENTOS} a {ES_MAX_LEVANTAMENTOS} levantamentos · dias{" "}
            {DIAS.join(", ")}. O 1RM pode ser atualizado a qualquer momento.
          </p>
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

      {/* Sessões */}
      {DIAS.map((slot, i) => {
        const sessao = sessaoDoSlotES(data, slot);
        if (!sessao) return null;
        const semana = semanaPorSlot[slot] ?? 1;
        const plano = planoES(sessao.nivel, semana);
        return (
          <Card key={slot}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>{slot}</Badge>
                <span>Treino {i + 1}</span>
                {data.frequencia === 3 ? (
                  <Badge variant="outline">{ES_NIVEL_LABEL[sessao.nivel]} (fixo)</Badge>
                ) : (
                  <Select
                    value={sessao.nivel}
                    onValueChange={(v) => setNivel(slot, v as ESNivel)}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ES_NIVEIS.map((n) => (
                        <SelectItem
                          key={n}
                          value={n}
                          className="text-xs"
                          disabled={niveisUsados.includes(n) && n !== sessao.nivel}
                        >
                          {ES_NIVEL_LABEL[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <span className="text-muted-foreground font-normal text-sm">
                  semana {semana} de {ES_TOTAL_SEMANAS} · {plano.esquema} @ {plano.pct}%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Levantamentos desta sessão
                </p>
                {data.levantamentos.map((l, k) => (
                  <div key={k} className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium">{l.levantamento}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {plano.esquema} @ {plano.pct}% ·{" "}
                      <strong className="text-foreground">{kgES(l.rm1, plano.pct) || "—"} kg</strong>
                    </span>
                  </div>
                ))}
              </div>

              <AuxiliaresBlock
                title="Auxiliares (2)"
                emptyLabel="Sem auxiliares nesta sessão."
                itens={sessao.auxiliares}
                categorias={categoriasForca}
                onAdd={() => addAux(slot)}
                onUpdate={(k, patch) => updateAux(slot, k, patch)}
                onRemove={(k) => removeAux(slot, k)}
              />
            </CardContent>
          </Card>
        );
      })}

      {/* Tabela de referência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabela fixa de {ES_TOTAL_SEMANAS} semanas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1 pr-3 font-semibold">Semana</th>
                {ES_NIVEIS.map((n) => (
                  <th key={n} className="py-1 pr-3 font-semibold">
                    {ES_NIVEL_LABEL[n]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabelaES("leve").map((linha) => (
                <tr key={linha.semana} className="border-t border-border/50">
                  <td className="py-1 pr-3 font-semibold">Semana {linha.semana}</td>
                  {ES_NIVEIS.map((n) => {
                    const p = planoES(n, linha.semana);
                    return (
                      <td key={n} className="py-1 pr-3">
                        {p.esquema} @ {p.pct}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
