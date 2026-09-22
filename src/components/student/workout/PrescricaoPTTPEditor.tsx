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
  PlayCircle,
  FileDown,
  Printer,
  Undo2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  type PTTPConteudo,
  type PTTPEstadoLevantamento,
  type PTTPFrequencia,
  type PTTPLevantamento,
  PTTP_LEVANTAMENTOS,
  PTTP_LEV_BASE,
  PTTP_LABEL,
  PTTP_DIAS_RECUO,
  PTTP_SERIES_RAMPA,
  PTTP_SERIES_MANUTENCAO,
  emptyPTTP,
  normalizarTreinosPTTP,
  lombardi,
  alvoPTTP,
  recuarPorTreinoPulado,
  entrarManutencao,
  voltarParaRampa,
} from "@/lib/pttp";
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
import { PTTP_METHOD_GUIDE } from "@/components/student/workout/methodGuides";
import { exportPTTPPDF } from "./exportPTTPPDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: PTTPConteudo;
  onSaved?: () => void;
}

export function PrescricaoPTTPEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<PTTPConteudo>(() => {
    const base = initial ?? emptyPTTP();
    return { ...base, treinos: normalizarTreinosPTTP(base.treinos, base.frequencia) };
  });
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNext = useRef(true);
  // Entradas do método Lombardi (não persistidas fora de `origem`)
  const [lombardiInput, setLombardiInput] = useState<
    Record<number, { carga: string; reps: string }>
  >({});

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

  const DIAS = useMemo(
    () => Array.from({ length: data.frequencia }, (_, i) => `T${i + 1}`),
    [data.frequencia],
  );

  // ── Autosave ────────────────────────────────────────────────
  const saveDraft = useCallback(
    async (next: PTTPConteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = `${PTTP_LABEL} — progressão por sessão`;
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
              template_fase: PTTP_LABEL,
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
    aq: PTTPConteudo["aquecimento"] | undefined,
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

  // ── Levantamentos centrais ──────────────────────────────────
  const patchLev = (idx: number, patch: Partial<PTTPEstadoLevantamento>) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) =>
        i === idx ? { ...l, ...patch } : l,
      ) as PTTPConteudo["levantamentos"],
    }));

  const aplicarLev = (
    idx: number,
    fn: (l: PTTPEstadoLevantamento) => PTTPEstadoLevantamento,
  ) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) =>
        i === idx ? fn(l) : l,
      ) as PTTPConteudo["levantamentos"],
    }));

  const aplicarLombardi = (idx: number) => {
    const entrada = lombardiInput[idx];
    const carga = Number(entrada?.carga) || 0;
    const reps = Number(entrada?.reps) || 0;
    if (!carga || !reps) {
      toast.error("Informe carga e repetições do teste.");
      return;
    }
    const r = lombardi(carga, reps);
    patchLev(idx, {
      origem: { metodo: "lombardi", carga, reps },
      pesoAtual: r.pesoInicial,
    });
    toast.success(`Peso inicial: ${r.pesoInicial} kg (E1RM ${r.e1rm.toFixed(1)} kg).`);
  };

  // ── Frequência / auxiliares ─────────────────────────────────
  const setFrequencia = (f: PTTPFrequencia) =>
    setData((p) => ({ ...p, frequencia: f, treinos: normalizarTreinosPTTP(p.treinos, f) }));

  const updateAux = (
    ordem: number,
    i: number,
    patch: Partial<PTTPConteudo["treinos"][number]["auxiliares"][number]>,
  ) =>
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t) =>
        t.ordem !== ordem
          ? t
          : { ...t, auxiliares: t.auxiliares.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) },
      ),
    }));

  const addAux = (ordem: number) =>
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t) =>
        t.ordem !== ordem
          ? t
          : {
              ...t,
              auxiliares: [
                ...t.auxiliares,
                { categoria: "", exercicio: "", exercicio_id: null, video_url: null, series: 3, reps: "8", kg: "" },
              ],
            },
      ),
    }));

  const removeAux = (ordem: number, i: number) =>
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t) =>
        t.ordem !== ordem ? t : { ...t, auxiliares: t.auxiliares.filter((_, idx) => idx !== i) },
      ),
    }));

  // ── Publicar ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    if (data.levantamentos.some((l) => !l.pesoAtual)) {
      toast.error("Defina o peso inicial dos 2 levantamentos centrais.");
      return;
    }
    if (data.levantamentos[0].levantamento === data.levantamentos[1].levantamento) {
      toast.error("Escolha dois levantamentos centrais diferentes.");
      return;
    }
    const faltando = data.treinos.some((t) =>
      t.auxiliares.some((a) => !a.categoria || !a.exercicio),
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
      const hoje = new Date();
      const dataInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
      const { error } = await supabase
        .from("treinos")
        .update({ status: "atual", data_inicio: dataInicio, updated_at: new Date().toISOString() })
        .eq("id", treinoId);
      if (error) throw error;
      toast.success("Prescrição Power to the People enviada ao aluno.");
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
      await exportPTTPPDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Render levantamento central ─────────────────────────────
  const renderLevantamento = (lev: PTTPEstadoLevantamento, idx: number) => {
    const base = PTTP_LEV_BASE[lev.levantamento];
    const alvo = alvoPTTP(lev);
    const entrada = lombardiInput[idx] ?? { carga: "", reps: "" };
    const previa = Number(entrada.carga) && Number(entrada.reps)
      ? lombardi(Number(entrada.carga), Number(entrada.reps))
      : null;
    return (
      <Card key={idx}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Levantamento {idx + 1}</Badge>
            <Select
              value={lev.levantamento}
              onValueChange={(v) => patchLev(idx, { levantamento: v as PTTPLevantamento })}
            >
              <SelectTrigger className="h-8 w-[220px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PTTP_LEVANTAMENTOS.map((l) => (
                  <SelectItem key={l} value={l} className="text-sm">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant={lev.modo === "rampa" ? "default" : "secondary"}>
              {lev.modo === "rampa" ? "Rampa" : "Manutenção"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>
              {base.categoria} · {base.nome}
            </span>
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
          </p>

          {/* Peso inicial */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Peso inicial
              <HelpTip title="Dois caminhos">
                <p>
                  <strong>Lombardi:</strong> informe carga e repetições de um teste com reserva.
                  O peso inicial é 80% do 5RM estimado, arredondado para 2,5 kg.
                </p>
                <p>
                  <strong>Rampa do primeiro dia:</strong> digite direto o peso que o aluno sentiu
                  como ~80% de esforço em séries de 5 crescentes.
                </p>
              </HelpTip>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">Teste — carga (kg)</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={entrada.carga}
                  onChange={(e) =>
                    setLombardiInput((p) => ({ ...p, [idx]: { ...entrada, carga: e.target.value } }))
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
                    setLombardiInput((p) => ({ ...p, [idx]: { ...entrada, reps: e.target.value } }))
                  }
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => aplicarLombardi(idx)}>
                Calcular por Lombardi
              </Button>
              <div>
                <Label className="text-xs">Rampa — peso inicial (kg)</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={lev.pesoAtual || ""}
                  onChange={(e) =>
                    patchLev(idx, {
                      pesoAtual: Number(e.target.value) || 0,
                      origem: { metodo: "rampa" },
                    })
                  }
                />
              </div>
            </div>
            {previa && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Lombardi: {Number(entrada.carga)} × {Number(entrada.reps)} = {previa.y.toFixed(1)} ·
                E1RM {previa.e1rm.toFixed(1)} kg · 5RM {previa.rm5.toFixed(1)} kg → peso inicial{" "}
                <strong className="text-foreground">{previa.pesoInicial} kg</strong>
              </p>
            )}
            {lev.origem.metodo === "lombardi" && (
              <p className="text-[11px] text-muted-foreground">
                Origem: Lombardi ({lev.origem.carga} kg × {lev.origem.reps} reps)
              </p>
            )}
          </div>

          {/* Estado atual */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Próxima sessão</p>
              <p className="font-semibold tabular-nums">
                {alvo.esquema} @ {alvo.peso} kg
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sessões desde o reset</p>
              <p className="font-semibold tabular-nums">{lev.sessoesDesdeReset}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sessões registradas</p>
              <p className="font-semibold tabular-nums">{lev.historico.length}</p>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => aplicarLev(idx, recuarPorTreinoPulado)}
                disabled={lev.historico.length === 0}
              >
                <Undo2 className="w-3 h-3 mr-1" /> Pulei um treino
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            "Pulei um treino" volta o peso ao de {PTTP_DIAS_RECUO} sessões atrás, sem zerar a
            contagem. Rampa: {PTTP_SERIES_RAMPA} no mesmo peso · Manutenção:{" "}
            {PTTP_SERIES_MANUTENCAO} fixo.
          </p>

          <div className="flex gap-2 flex-wrap">
            {lev.modo === "rampa" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => aplicarLev(idx, entrarManutencao)}
                disabled={!lev.pesoAtual}
              >
                <ShieldCheck className="w-3 h-3 mr-1" /> Entrar em modo manutenção
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => aplicarLev(idx, voltarParaRampa)}>
                Voltar para a rampa
              </Button>
            )}
          </div>

          {/* Histórico */}
          {lev.historico.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1 pr-3 font-semibold">Treino</th>
                    <th className="py-1 pr-3 font-semibold">Data</th>
                    <th className="py-1 pr-3 font-semibold">Peso</th>
                    <th className="py-1 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {lev.historico.map((h, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 pr-3 font-semibold">TREINO #{i + 1}</td>
                      <td className="py-1 pr-3">{h.data}</td>
                      <td className="py-1 pr-3">{h.peso} kg</td>
                      <td className={"py-1 " + (h.sucesso ? "text-success" : "text-destructive")}>
                        {h.sucesso ? "✓" : "✗"}
                      </td>
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
              <Sparkles className="w-5 h-5 text-primary" /> {PTTP_LABEL} · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              2 levantamentos centrais em todo treino · progressão pelo resultado real de cada
              sessão.
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
          <MethodGuideSheet guide={PTTP_METHOD_GUIDE} />
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

      {/* Frequência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Frequência semanal
            <HelpTip title="Como funciona">
              <p>
                Os 2 levantamentos centrais aparecem em todos os treinos da semana. Só os
                auxiliares mudam de um treino para o outro.
              </p>
            </HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={String(data.frequencia)}
            onValueChange={(v) => setFrequencia(Number(v) as PTTPFrequencia)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5].map((f) => (
                <SelectItem key={f} value={String(f)}>
                  {f} treinos por semana
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Treinos */}
      {data.treinos.map((tr) => (
        <Card key={tr.ordem}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Badge>T{tr.ordem}</Badge>
              <span>Treino {tr.ordem}</span>
              <span className="text-muted-foreground font-normal text-sm">
                — {data.levantamentos.map((l) => l.levantamento).join(" + ")} + 3 auxiliares
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Levantamentos centrais
              </p>
              {data.levantamentos.map((l, i) => {
                const alvo = alvoPTTP(l);
                return (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium">{l.levantamento}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {alvo.esquema} ·{" "}
                      <strong className="text-foreground">{alvo.peso || "—"} kg</strong>
                      {l.modo === "manutencao" && " (manutenção)"}
                    </span>
                  </div>
                );
              })}
            </div>

            <AuxiliaresBlock
              title="Auxiliares (3)"
              emptyLabel="Sem auxiliares neste treino."
              itens={tr.auxiliares}
              categorias={categoriasForca}
              onAdd={() => addAux(tr.ordem)}
              onUpdate={(i, patch) => updateAux(tr.ordem, i, patch)}
              onRemove={(i) => removeAux(tr.ordem, i)}
            />
          </CardContent>
        </Card>
      ))}

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
