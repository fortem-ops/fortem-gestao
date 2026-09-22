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
  ChevronRight,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  type PTTP2Conteudo,
  type PTTP2EstadoLevantamento,
  type PTTP2Fase,
  type PTTP2Levantamento,
  PTTP2_LEVANTAMENTOS,
  PTTP2_LEV_BASE,
  PTTP2_LABEL,
  PTTP2_FASES,
  PTTP2_FASE_LABEL,
  PTTP2_FASE_ESQUEMA,
  PTTP2_MIN_LEVANTAMENTOS,
  PTTP2_MAX_LEVANTAMENTOS,
  emptyPTTP2,
  estadoVazioPTTP2,
  normalizarTreinosPTTP2,
  normalizarLevantamentosPTTP2,
  pesoInicialPTTP2,
  rm5PorLombardi,
  limitarPercentualPTTP2,
  alvoPTTP2,
  avancarFasePTTP2,
  definirFasePTTP2,
  registrarTestePTTP2,
  limparTestePTTP2,
  cicloConcluidoPTTP2,
} from "@/lib/pttp2";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { AuxiliaresBlock } from "@/components/student/workout/AuxiliaresBlock";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { exportPTTP2PDF } from "./exportPTTP2PDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: PTTP2Conteudo;
  onSaved?: () => void;
}

const PCT_OPCOES = [0.85, 0.86, 0.87, 0.88, 0.89, 0.9];

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PrescricaoPTTP2Editor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<PTTP2Conteudo>(() => {
    const base = initial ?? emptyPTTP2();
    return {
      ...base,
      levantamentos: normalizarLevantamentosPTTP2(base.levantamentos),
      treinos: normalizarTreinosPTTP2(base.treinos),
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
  const [testeInput, setTesteInput] = useState<Record<number, string>>({});

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

  const DIAS = useMemo(() => ["T1", "T2", "T3"], []);

  // ── Autosave ────────────────────────────────────────────────
  const saveDraft = useCallback(
    async (next: PTTP2Conteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = `${PTTP2_LABEL} — progressão automática por sessão`;
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
              template_fase: PTTP2_LABEL,
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
    aq: PTTP2Conteudo["aquecimento"] | undefined,
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
  const patchLev = (idx: number, patch: Partial<PTTP2EstadoLevantamento>) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));

  const aplicarLev = (
    idx: number,
    fn: (l: PTTP2EstadoLevantamento) => PTTP2EstadoLevantamento,
  ) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, i) => (i === idx ? fn(l) : l)),
    }));

  const addLevantamento = () =>
    setData((p) => {
      if (p.levantamentos.length >= PTTP2_MAX_LEVANTAMENTOS) return p;
      const usados = new Set(p.levantamentos.map((l) => l.levantamento));
      const livre = PTTP2_LEVANTAMENTOS.find((l) => !usados.has(l)) ?? PTTP2_LEVANTAMENTOS[0];
      return { ...p, levantamentos: [...p.levantamentos, estadoVazioPTTP2(livre)] };
    });

  const removeLevantamento = (idx: number) =>
    setData((p) =>
      p.levantamentos.length <= PTTP2_MIN_LEVANTAMENTOS
        ? p
        : { ...p, levantamentos: p.levantamentos.filter((_, i) => i !== idx) },
    );

  /** Recalcula o peso inicial a partir do 5RM de referência e do percentual. */
  const recalcularPeso = (idx: number, rm5: number, pct: number) => {
    const lev = data.levantamentos[idx];
    const peso = pesoInicialPTTP2(rm5, pct);
    if (lev.historico.length > 0) {
      patchLev(idx, { percentual: limitarPercentualPTTP2(pct) });
      toast.info("O levantamento já tem sessões registradas — o peso atual foi mantido.");
      return;
    }
    patchLev(idx, { percentual: limitarPercentualPTTP2(pct), pesoAtual: peso });
  };

  const setRm5 = (idx: number, rm5: number, origem: PTTP2EstadoLevantamento["origem"]) => {
    const lev = data.levantamentos[idx];
    patchLev(idx, {
      origem,
      ...(lev.historico.length === 0
        ? { pesoAtual: pesoInicialPTTP2(rm5, lev.percentual) }
        : {}),
    });
  };

  const aplicarLombardi = (idx: number) => {
    const entrada = lombardiInput[idx];
    const carga = Number(entrada?.carga) || 0;
    const reps = Number(entrada?.reps) || 0;
    if (!carga || !reps) {
      toast.error("Informe carga e repetições do teste.");
      return;
    }
    const rm5 = rm5PorLombardi(carga, reps);
    setRm5(idx, rm5, { tipo: "lombardi", carga, reps, rm5 });
    toast.success(
      `5RM estimado: ${rm5.toFixed(1)} kg → peso inicial ${pesoInicialPTTP2(rm5, data.levantamentos[idx].percentual)} kg.`,
    );
  };

  const registrarTeste = (idx: number) => {
    const rm1 = Number(testeInput[idx]) || 0;
    if (!rm1) {
      toast.error("Informe o 1RM testado.");
      return;
    }
    aplicarLev(idx, (l) => registrarTestePTTP2(l, rm1, hojeISO()));
    setTesteInput((p) => ({ ...p, [idx]: "" }));
    toast.success(`Ciclo concluído — 1RM testado: ${rm1} kg.`);
  };

  // ── Auxiliares ──────────────────────────────────────────────
  const updateAux = (
    ordem: number,
    i: number,
    patch: Partial<PTTP2Conteudo["treinos"][number]["auxiliares"][number]>,
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
                {
                  categoria: "",
                  exercicio: "",
                  exercicio_id: null,
                  video_url: null,
                  series: 3,
                  reps: "8",
                  kg: "",
                },
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
    if (data.levantamentos.some((l) => !l.pesoAtual && !cicloConcluidoPTTP2(l))) {
      toast.error("Defina o peso inicial de todos os levantamentos.");
      return;
    }
    const nomes = data.levantamentos.map((l) => l.levantamento);
    if (new Set(nomes).size !== nomes.length) {
      toast.error("Não repita o mesmo levantamento.");
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
      const { error } = await supabase
        .from("treinos")
        .update({
          status: "atual",
          data_inicio: hojeISO(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", treinoId);
      if (error) throw error;
      toast.success("Prescrição Power to the People 2.0 enviada ao aluno.");
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
      await exportPTTP2PDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Render levantamento ─────────────────────────────────────
  const renderLevantamento = (lev: PTTP2EstadoLevantamento, idx: number) => {
    const base = PTTP2_LEV_BASE[lev.levantamento];
    const alvo = alvoPTTP2(lev);
    const entrada = lombardiInput[idx] ?? { carga: "", reps: "" };
    const concluido = cicloConcluidoPTTP2(lev);
    const rm5 = lev.origem.rm5 ?? 0;
    return (
      <Card key={idx}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Levantamento {idx + 1}</Badge>
            <Select
              value={lev.levantamento}
              onValueChange={(v) => patchLev(idx, { levantamento: v as PTTP2Levantamento })}
            >
              <SelectTrigger className="h-8 w-[220px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PTTP2_LEVANTAMENTOS.map((l) => (
                  <SelectItem key={l} value={l} className="text-sm">
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant={concluido ? "secondary" : "default"}>
              {concluido ? "Ciclo concluído" : PTTP2_FASE_LABEL[lev.fase]}
            </Badge>
            {data.levantamentos.length > PTTP2_MIN_LEVANTAMENTOS && (
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

          {/* 5RM de referência */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              5RM de referência
              <HelpTip title="De onde vem o 5RM">
                <p>
                  <strong>Herdado da 1.0:</strong> informe o peso do 5RM com que o levantamento
                  terminou o ciclo anterior.
                </p>
                <p>
                  <strong>Novo na 2.0:</strong> estabeleça um 5RM do zero, por Lombardi (teste
                  carga × reps) ou digitando o 5RM direto.
                </p>
                <p>
                  O peso inicial da 2.0 é esse 5RM multiplicado pelo percentual escolhido (85% a
                  90%).
                </p>
              </HelpTip>
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs">Origem</Label>
              <Select
                value={lev.origem.tipo === "lombardi" ? "novo" : lev.origem.tipo}
                onValueChange={(v) =>
                  patchLev(idx, {
                    origem:
                      v === "herdado"
                        ? { tipo: "herdado", rm5 }
                        : { tipo: "novo", rm5 },
                  })
                }
              >
                <SelectTrigger className="h-8 w-[260px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="herdado" className="text-xs">
                    Herdado do ciclo 1.0
                  </SelectItem>
                  <SelectItem value="novo" className="text-xs">
                    Novo na 2.0
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">
                  {lev.origem.tipo === "herdado" ? "5RM final da 1.0 (kg)" : "5RM de referência (kg)"}
                </Label>
                <Input
                  type="number"
                  className="h-8"
                  value={rm5 || ""}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setRm5(
                      idx,
                      v,
                      lev.origem.tipo === "herdado"
                        ? { tipo: "herdado", rm5: v }
                        : { tipo: "novo", rm5: v },
                    );
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Percentual do 5RM</Label>
                <Select
                  value={String(limitarPercentualPTTP2(lev.percentual))}
                  onValueChange={(v) => recalcularPeso(idx, rm5, Number(v))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PCT_OPCOES.map((p) => (
                      <SelectItem key={p} value={String(p)} className="text-xs">
                        {Math.round(p * 100)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {rm5
                  ? `${rm5.toFixed(1)} kg × ${Math.round(limitarPercentualPTTP2(lev.percentual) * 100)}% = ${pesoInicialPTTP2(rm5, lev.percentual)} kg`
                  : "Informe o 5RM de referência."}
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
                  Calcular 5RM por Lombardi
                </Button>
                {lev.origem.tipo === "lombardi" && (
                  <p className="text-[11px] text-muted-foreground">
                    Origem: Lombardi ({lev.origem.carga} kg × {lev.origem.reps} reps)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fase e estado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Próxima sessão</p>
              <p className="font-semibold tabular-nums">
                {concluido ? "—" : `${alvo.esquema} @ ${alvo.peso || "—"} kg`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Fase atual</p>
              <p className="font-semibold">{PTTP2_FASE_LABEL[lev.fase]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sessões registradas</p>
              <p className="font-semibold tabular-nums">{lev.historico.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">1RM testado</p>
              <p className="font-semibold tabular-nums">
                {lev.rm1Testado ? `${lev.rm1Testado} kg` : "—"}
              </p>
            </div>
          </div>

          {concluido ? (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Ciclo concluído — 1RM testado: {lev.rm1Testado} kg
                {lev.rm1TestadoEm ? ` (${lev.rm1TestadoEm})` : ""}
              </p>
              <Button variant="outline" size="sm" onClick={() => aplicarLev(idx, limparTestePTTP2)}>
                Desfazer teste
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs">Trocar fase manualmente</Label>
                <Select
                  value={lev.fase}
                  onValueChange={(v) => aplicarLev(idx, (l) => definirFasePTTP2(l, v as PTTP2Fase))}
                >
                  <SelectTrigger className="h-8 w-[240px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PTTP2_FASES.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {PTTP2_FASE_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => aplicarLev(idx, avancarFasePTTP2)}
                disabled={lev.fase === "teste"}
              >
                <ChevronRight className="w-3 h-3 mr-1" /> Avançar fase
              </Button>
              {lev.fase === "teste" && (
                <>
                  <div>
                    <Label className="text-xs">1RM testado (kg)</Label>
                    <Input
                      type="number"
                      className="h-8 w-[140px]"
                      value={testeInput[idx] ?? ""}
                      onChange={(e) =>
                        setTesteInput((p) => ({ ...p, [idx]: e.target.value }))
                      }
                    />
                  </div>
                  <Button size="sm" onClick={() => registrarTeste(idx)}>
                    Registrar teste
                  </Button>
                </>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            A troca de fase é sempre manual. A cada sessão concluída pelo aluno o peso sobe sozinho
            (2,5%, no mínimo 2,5 kg), sem perguntar sucesso ou falha.
          </p>

          {/* Histórico */}
          {lev.historico.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1 pr-3 font-semibold">Treino</th>
                    <th className="py-1 pr-3 font-semibold">Data</th>
                    <th className="py-1 pr-3 font-semibold">Peso</th>
                    <th className="py-1 font-semibold">Fase</th>
                  </tr>
                </thead>
                <tbody>
                  {lev.historico.map((h, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 pr-3 font-semibold">TREINO #{i + 1}</td>
                      <td className="py-1 pr-3">{h.data}</td>
                      <td className="py-1 pr-3">{h.peso} kg</td>
                      <td className="py-1">{PTTP2_FASE_ESQUEMA[h.fase]}</td>
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
              <Sparkles className="w-5 h-5 text-primary" /> {PTTP2_LABEL} · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              3 sessões por semana · 2 a 4 levantamentos · progressão automática a cada sessão.
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
          <CardTitle className="text-base flex items-center gap-2">
            Levantamentos ({data.levantamentos.length})
            <HelpTip title="Como funciona a 2.0">
              <p>
                A frequência é fixa: 3 sessões por semana, com todos os levantamentos treinados
                juntos em cada sessão.
              </p>
              <p>
                Cada levantamento tem sua própria fase e seu próprio peso; a fase só muda quando
                você (ou o aluno) decide avançar.
              </p>
            </HelpTip>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={addLevantamento}
              disabled={data.levantamentos.length >= PTTP2_MAX_LEVANTAMENTOS}
            >
              <Plus className="w-3 h-3 mr-1" /> Levantamento
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            De {PTTP2_MIN_LEVANTAMENTOS} a {PTTP2_MAX_LEVANTAMENTOS} levantamentos · 3 treinos por
            semana (fixo).
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
                Levantamentos
              </p>
              {data.levantamentos.map((l, i) => {
                const alvo = alvoPTTP2(l);
                return (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium">{l.levantamento}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {alvo.concluido ? (
                        <>Ciclo concluído — 1RM {l.rm1Testado} kg</>
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
