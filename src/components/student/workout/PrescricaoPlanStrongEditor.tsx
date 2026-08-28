import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import { exportPlanStrongPDF } from "./exportPlanStrongPDF";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { AuxiliaresBlock } from "@/components/student/workout/AuxiliaresBlock";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import {
  type PlanStrong50Conteudo,
  type PSAuxiliar,
  emptyAuxiliar,
  psAuxiliaresDoSlot,
  type PSLevantamento,
  type PSLevantamentoConfig,
  type PSMes,
  type PSVariante,
  type PSZona,
  PS_LEVANTAMENTOS,
  PS_LEV_LABEL,
  PS_DIAS_SEMANA_PADRAO,
  psSlots,
  PS_LEV_BASE,
  PS_ZONAS,
  PS_ZONAS_INPUT,
  PS_ZONA_MAP,
  PS_VARIANTE_KEYS,
  PS_VARIANTES,
  PS_FASE_LABEL,
  SPLITS_SESSAO,
  emptyPlanStrong50,
  emptyLevantamento,
  ajustarDuracao,
  splitPadrao,
  pct71_80,
  ariReal,
  nlPorZonaMes,
  nlPorZonaSemana,
  nlTotalSemana,
  calcularSessao,
  kgZona,
  totalSessoes,
  statusLevantamento,
  variacaoKey,
  faixaNlSugerida,
  descreverVariante,
} from "@/lib/planStrong";


const DIAS_SEMANA_OPCOES = [2, 3, 4, 5];

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: PlanStrong50Conteudo;
  onSaved?: () => void;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("pt-BR");

export function PrescricaoPlanStrongEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<PlanStrong50Conteudo>(initial ?? emptyPlanStrong50(3));
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


  // Sessões concluídas por levantamento (preview ao vivo)
  const { data: sessionCounts = {} } = useQuery({
    queryKey: ["planstrong-session-counts", treinoId],
    enabled: !!treinoId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("treino_sessoes")
        .select("variacao")
        .eq("treino_id", treinoId!)
        .not("concluido_em", "is", null);
      const counts: Record<string, number> = {};
      (rows || []).forEach((r: { variacao: string }) => {
        counts[r.variacao] = (counts[r.variacao] ?? 0) + 1;
      });
      return counts;
    },
  });

  // ── Autosave ────────────────────────────────────────────────
  const saveDraft = useCallback(
    async (next: PlanStrong50Conteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = `Plan Strong 50 — ${next.duracaoMeses} ${next.duracaoMeses === 1 ? "mês" : "meses"}`;
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
              template_fase: "Plan Strong 50",
              semanas: next.duracaoMeses * 4,
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
    aq: PlanStrong50Conteudo["aquecimento"] | undefined,
  ): Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]> =>
    ensureAquecimentoRecord(aq, siglasAq);
  const addAq = (b: AquecimentoBloco) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return {
        ...p,
        aquecimento: { ...aq, [b]: [...aq[b], { exercicio: "", repeticoes: "10", dias: [] }] },
      };
    });
  const updateAq = (b: AquecimentoBloco, i: number, patch: Partial<PersonalizadoAquecimentoEx>) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return {
        ...p,
        aquecimento: { ...aq, [b]: aq[b].map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)) },
      };
    });
  const removeAq = (b: AquecimentoBloco, i: number) =>
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      return { ...p, aquecimento: { ...aq, [b]: aq[b].filter((_, idx) => idx !== i) } };
    });

  // ── Auxiliares por slot (T1..Tn) ────────────────────────────
  const addAux = (slot: string) =>
    setData((p) => {
      const map = p.auxiliaresPorSlot ?? {};
      return {
        ...p,
        auxiliaresPorSlot: { ...map, [slot]: [...(map[slot] ?? []), emptyAuxiliar()] },
      };
    });
  const updateAux = (slot: string, i: number, patch: Partial<PSAuxiliar>) =>
    setData((p) => {
      const map = p.auxiliaresPorSlot ?? {};
      return {
        ...p,
        auxiliaresPorSlot: {
          ...map,
          [slot]: (map[slot] ?? []).map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
        },
      };
    });
  const removeAux = (slot: string, i: number) =>
    setData((p) => {
      const map = p.auxiliaresPorSlot ?? {};
      return {
        ...p,
        auxiliaresPorSlot: { ...map, [slot]: (map[slot] ?? []).filter((_, idx) => idx !== i) },
      };
    });


  // ── Levantamentos ───────────────────────────────────────────
  const usados = data.levantamentos.map((l) => l.tipo);
  const disponiveis = PS_LEVANTAMENTOS.filter((t) => !usados.includes(t));

  const addLev = () => {
    if (data.levantamentos.length >= 4) {
      toast.info("Máximo de 4 levantamentos por aluno.");
      return;
    }
    const tipo = disponiveis[0];
    if (!tipo) return;
    setData((p) => ({
      ...p,
      levantamentos: [...p.levantamentos, emptyLevantamento(tipo, p.duracaoMeses)],
    }));
  };
  const removeLev = (i: number) =>
    setData((p) => ({ ...p, levantamentos: p.levantamentos.filter((_, idx) => idx !== i) }));
  const updateLev = (i: number, patch: Partial<PSLevantamentoConfig>) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
  const updateMes = (li: number, mi: number, patch: Partial<PSMes>) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, idx) =>
        idx !== li
          ? l
          : { ...l, meses: l.meses.map((m, j) => (j === mi ? { ...m, ...patch } : m)) },
      ),
    }));
  const updateSemana = (
    li: number,
    mi: number,
    wi: number,
    patch: Partial<PSMes["semanas"][number]>,
  ) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, idx) =>
        idx !== li
          ? l
          : {
              ...l,
              meses: l.meses.map((m, j) =>
                j !== mi
                  ? m
                  : { ...m, semanas: m.semanas.map((s, k) => (k === wi ? { ...s, ...patch } : s)) },
              ),
            },
      ),
    }));
  const setOverride = (
    li: number,
    mi: number,
    wi: number,
    sessaoIdx: number,
    zona: PSZona,
    val: string,
  ) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, idx) =>
        idx !== li
          ? l
          : {
              ...l,
              meses: l.meses.map((m, j) =>
                j !== mi
                  ? m
                  : {
                      ...m,
                      semanas: m.semanas.map((s, k) =>
                        k !== wi
                          ? s
                          : {
                              ...s,
                              overrides: { ...(s.overrides ?? {}), [`${sessaoIdx}:${zona}`]: val },
                            },
                      ),
                    },
              ),
            },
      ),
    }));

  const setDuracao = (n: number) => setData((p) => ajustarDuracao(p, n));

  const setDiasSemana = (n: number) => setData((p) => ({ ...p, diasTreinoSemana: n }));

  // Ordena os slots (T1, T2, ...) para exibição estável
  const ordenaSlots = (arr: string[]) =>
    [...arr].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  const toggleDia = (li: number, dia: string) =>
    setData((p) => ({
      ...p,
      levantamentos: p.levantamentos.map((l, idx) => {
        if (idx !== li) return l;
        const has = l.diasTreino.includes(dia);
        return {
          ...l,
          diasTreino: has
            ? l.diasTreino.filter((d) => d !== dia)
            : ordenaSlots([...l.diasTreino, dia]),
        };
      }),
    }));

  // ── Publicar ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    if (data.levantamentos.length === 0) {
      toast.error("Adicione ao menos um levantamento.");
      return;
    }
    if (data.levantamentos.some((l) => !l.rm1)) {
      toast.error("Informe o 1RM de todos os levantamentos.");
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
      toast.success("Prescrição Plan Strong 50 enviada ao aluno.");
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
      await exportPlanStrongPDF({ student, data, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };



  // ── Render de um mês ────────────────────────────────────────
  const renderMes = (lev: PSLevantamentoConfig, li: number, mes: PSMes, mi: number) => {
    const resto = pct71_80(mes);
    const ari = ariReal(mes);
    const nlMes = nlPorZonaMes(mes);
    const somaInputs = 100 - resto;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{PS_FASE_LABEL[mes.fase]}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {mes.fase === "competitivo"
              ? "Dica: ARI acima de 70% e 1-5% a mais de 1RM que o último mês preparatório."
              : "Dica: ARI abaixo de 70% no preparatório."}
          </span>
        </div>

        {/* NL + ARI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs flex items-center gap-1">
              NL do mês
              <HelpTip title="NL — número de levantamentos do mês">
                <p>É o total de repetições do levantamento principal no mês inteiro.</p>
                <p>
                  Faixa sugerida para {PS_LEV_LABEL[lev.tipo]}: <strong>{faixaNlSugerida(lev.tipo)}</strong>.
                  É só uma referência — você pode usar o número que fizer sentido para o aluno.
                </p>
              </HelpTip>
            </Label>
            <Input
              type="number"
              className="h-8"
              value={mes.nlMensal || ""}
              onChange={(e) => updateMes(li, mi, { nlMensal: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              ARI objetivo (%)
              <HelpTip title="ARI objetivo × ARI real">
                <p>
                  O <strong>ARI real</strong> é calculado sozinho a partir da distribuição por zona —
                  você não digita.
                </p>
                <p>
                  O <strong>ARI objetivo</strong> é só a sua meta visual, para comparar enquanto ajusta
                  as porcentagens. Não entra em nenhuma conta.
                </p>
                <p>Diretriz: abaixo de 70% no preparatório, acima disso no competitivo.</p>
              </HelpTip>
            </Label>
            <Input
              type="number"
              className="h-8"
              value={mes.ariObjetivo || ""}
              onChange={(e) => updateMes(li, mi, { ariObjetivo: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="text-xs">ARI real (calculado)</Label>
            <div
              className={
                "h-8 flex items-center px-3 rounded-md border text-sm font-semibold tabular-nums " +
                (ari >= 70 ? "border-warning/50 text-warning" : "border-border")
              }
            >
              {fmt(ari)}%
            </div>
          </div>
        </div>

        {/* % por zona */}
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
            Distribuição de NL por zona
            <HelpTip title="% de NL por zona">
              <p>
                A zona <strong>71-80% é calculada sozinha</strong>: é o que sobra de 100% depois das
                outras quatro.
              </p>
              <p>Diretrizes práticas:</p>
              <p>• 50-70% costuma ficar entre 30% e 60% do volume total.</p>
              <p>• 81-90% costuma crescer no período competitivo.</p>
              <p>• 91-100% costuma ficar entre 0% e 10% — opcional no preparatório.</p>
            </HelpTip>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PS_ZONAS.map((z) => {
              const isInput = PS_ZONAS_INPUT.includes(z.key);
              const pct = isInput
                ? ((mes[
                    ("pct" + z.key.replace("z", "")) as keyof PSMes
                  ] as number) ?? 0)
                : resto;
              return (
                <div
                  key={z.key}
                  className={
                    "rounded-md border p-2 space-y-1 " +
                    (isInput ? "border-border" : "border-primary/40 bg-primary/5")
                  }
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {z.label} · {z.pctCentral}%
                  </p>
                  {isInput ? (
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={pct || ""}
                      onChange={(e) =>
                        updateMes(li, mi, {
                          [("pct" + z.key.replace("z", "")) as "pct50_60"]:
                            Number(e.target.value) || 0,
                        } as Partial<PSMes>)
                      }
                    />
                  ) : (
                    <div className="h-7 flex items-center text-xs font-semibold tabular-nums">
                      {fmt(resto)}% <span className="ml-1 text-[10px] text-muted-foreground">(auto)</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    NL {fmt(nlMes[z.key])} · {mes.kgOverride?.[z.key] ?? kgZona(lev.rm1, z.pctCentral)} kg
                  </p>
                  <Input
                    type="number"
                    className="h-6 text-[10px]"
                    placeholder="kg manual"
                    value={mes.kgOverride?.[z.key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateMes(li, mi, {
                        kgOverride: {
                          ...(mes.kgOverride ?? {}),
                          [z.key]: v === "" ? undefined : Number(v),
                        },
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
          {resto < 0 && (
            <p className="text-[11px] text-destructive mt-1">
              As zonas digitadas somam {fmt(somaInputs)}% — reduza para sobrar espaço à zona 71-80%.
            </p>
          )}
        </div>

        {/* Variantes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(
            [
              ["variantePrincipal", "Variante 50-60% e 61-70%"],
              ["variante81_90", "Variante 81-90%"],
              ["variante91_100", "Variante 91-100%"],
            ] as Array<[keyof PSMes, string]>
          ).map(([key, label], idx) => (
            <div key={key as string}>
              <Label className="text-xs flex items-center gap-1">
                {label}
                {idx === 0 && (
                  <HelpTip title="O que é uma variante?">
                    <p>
                      A variante define como o volume daquela zona sobe e desce ao longo das 4 semanas
                      do mês — por exemplo, começar leve e ir crescendo, ou alternar semana forte/fraca.
                    </p>
                    <p>
                      As zonas 50-60% e 61-70% usam sempre a <strong>mesma</strong> variante. As zonas
                      81-90% e 91-100% têm variante própria. A zona 71-80% não tem variante: ela é o
                      resto de cada semana.
                    </p>
                  </HelpTip>
                )}
              </Label>
              <Select
                value={mes[key] as string}
                onValueChange={(v) => updateMes(li, mi, { [key]: v as PSVariante } as Partial<PSMes>)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PS_VARIANTE_KEYS.map((v) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {v} — {PS_VARIANTES[v].join("/")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {descreverVariante(mes[key] as PSVariante)}
              </p>
            </div>
          ))}
        </div>

        {/* Semanas */}
        <div className="space-y-3">
          {mes.semanas.map((sem, wi) => {
            const nlSem = nlPorZonaSemana(mes, wi);
            const totalSem = nlTotalSemana(mes, wi);
            return (
              <div key={wi} className="rounded-md border border-border/70 p-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="secondary">Semana {wi + 1}</Badge>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    NL da semana: <strong>{fmt(totalSem)}</strong>
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <Label className="text-[10px]">Sessões</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3}
                      className="h-7 w-14 text-xs"
                      value={sem.sessoes || ""}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(3, Number(e.target.value) || 1));
                        updateSemana(li, mi, wi, { sessoes: n, splitSessao: splitPadrao(n) });
                      }}
                    />
                    <Label className="text-[10px] ml-2 flex items-center gap-1">
                      Split
                      <HelpTip title="Split de sessão">
                        <p>
                          Define como o volume da semana se divide entre as sessões daquele
                          levantamento — por exemplo 40-60 põe 40% do volume na primeira sessão e 60%
                          na segunda.
                        </p>
                      </HelpTip>
                    </Label>
                    <Select
                      value={sem.splitSessao || splitPadrao(sem.sessoes)}
                      onValueChange={(v) => updateSemana(li, mi, wi, { splitSessao: v })}
                      disabled={(sem.sessoes || 1) < 2}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPLITS_SESSAO.filter((s) => s.sessoes === sem.sessoes).map((s) => (
                          <SelectItem key={s.key} value={s.key} className="text-xs">
                            {s.key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                  {PS_ZONAS.map((z) => (
                    <div key={z.key} className="text-[10px] text-muted-foreground tabular-nums">
                      {z.label}: <strong className="text-foreground">{fmt(nlSem[z.key])}</strong>
                    </div>
                  ))}
                </div>

                {/* Sessões da semana */}
                <div className="space-y-2">
                  {Array.from({ length: sem.sessoes || 1 }, (_, si) => {
                    const calc = calcularSessao(lev, mi, wi, si);
                    if (!calc) return null;
                    return (
                      <div key={si} className="rounded border border-border/50 bg-muted/20 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                          Sessão {si + 1} · NL {fmt(calc.nlTotal)}
                          {si === 0 && (
                            <HelpTip title="Séries sugeridas">
                              <p>
                                As séries abaixo são uma <strong>sugestão</strong> calculada a partir do
                                volume da sessão e das repetições ideais daquela zona.
                              </p>
                              <p>Você pode editar livremente — não é uma trava.</p>
                            </HelpTip>
                          )}
                        </p>
                        {calc.zonas.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            Sem volume nesta sessão.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {calc.zonas.map((zs) => (
                              <div key={zs.zona} className="flex items-center gap-2 text-xs">
                                <span className="w-20 shrink-0 text-[10px] text-muted-foreground">
                                  {zs.label}
                                </span>
                                <span className="w-16 shrink-0 tabular-nums font-medium">
                                  {zs.kg} kg
                                </span>
                                <span className="w-20 shrink-0 tabular-nums text-[10px] text-muted-foreground">
                                  NL {fmt(zs.nl)}
                                </span>
                                <Input
                                  className="h-7 text-xs flex-1"
                                  value={zs.series}
                                  onChange={(e) =>
                                    setOverride(li, mi, wi, si, zs.zona, e.target.value)
                                  }
                                />
                                {zs.manual && (
                                  <Badge variant="outline" className="text-[9px] h-5">
                                    editado
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const diasSemana = data.diasTreinoSemana ?? PS_DIAS_SEMANA_PADRAO;
  const aqDias = useMemo(() => psSlots(diasSemana), [diasSemana]);

  // Poda automática: remove marcações de slots que excedem os dias configurados
  useEffect(() => {
    setData((p) => {
      const aq = ensureAq(p.aquecimento);
      let changed = false;
      const next = (Object.keys(aq) as AquecimentoBloco[]).reduce(
        (acc, b) => {
          acc[b] = aq[b].map((ex) => {
            const dias = (ex.dias ?? []).filter((d) => aqDias.includes(d));
            if (dias.length !== (ex.dias?.length ?? 0)) {
              changed = true;
              return { ...ex, dias };
            }
            return ex;
          });
          return acc;
        },
        {} as Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>,
      );

      const levs = p.levantamentos.map((l) => {
        const dt = l.diasTreino.filter((d) => aqDias.includes(d));
        if (dt.length !== l.diasTreino.length) {
          changed = true;
          return { ...l, diasTreino: dt };
        }
        return l;
      });

      return changed ? { ...p, aquecimento: next, levantamentos: levs } : p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aqDias]);

  const toggleAqDia = (b: AquecimentoBloco, i: number, dia: string, atual: string[]) =>
    updateAq(b, i, {
      dias: atual.includes(dia)
        ? atual.filter((d) => d !== dia)
        : ordenaSlots([...atual, dia]),
    });


  return (
    <div className="container mx-auto p-6 max-w-6xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Plan Strong 50 · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Orçamento de volume (NL) por zona de intensidade — cálculo ao vivo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden={!savingLabel}
            className={`text-xs text-muted-foreground flex items-center justify-end gap-1 min-w-[130px] whitespace-nowrap transition-opacity duration-200 ${
              savingLabel ? "opacity-100" : "opacity-0"
            }`}
          >
            {savingLabel === "Salvando…" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-primary" />
            )}
            {savingLabel || "Rascunho salvo"}
          </span>
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

      {/* Configuração geral */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                Duração (meses)
                <HelpTip title="Duração e fases">
                  <p>O programa dura de 1 a 6 meses e as fases são montadas automaticamente:</p>
                  <p>• O <strong>último mês</strong> é o Competitivo.</p>
                  <p>• O <strong>penúltimo</strong> (a partir de 3 meses) é o Pré-competitivo.</p>
                  <p>• Os demais são Preparatórios.</p>
                  <p>É só um agrupamento para orientar você — não muda nenhuma conta.</p>
                </HelpTip>
              </Label>
              <Select value={String(data.duracaoMeses)} onValueChange={(v) => setDuracao(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? "mês" : "meses"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Dias de treino por semana
                <HelpTip title="Slots de treino (T1..Tn)">
                  <p>
                    Define quantas sessões semanais a prescrição tem. Cada sessão vira um slot
                    <strong> T1, T2, T3…</strong> compartilhado por toda a prescrição.
                  </p>
                  <p>
                    Em cada levantamento você marca em quais slots ele entra — dois levantamentos
                    podem ocupar o mesmo slot (ex.: T1 = Terra + Supino) e o mesmo levantamento pode
                    aparecer em vários slots.
                  </p>
                  <p>O aquecimento também usa esses mesmos slots.</p>
                </HelpTip>
              </Label>
              <Select value={String(diasSemana)} onValueChange={(v) => setDiasSemana(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA_OPCOES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} dias (T1–T{n})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: data.duracaoMeses }, (_, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    Mês {i + 1}:{" "}
                    {PS_FASE_LABEL[
                      i === data.duracaoMeses - 1
                        ? "competitivo"
                        : data.duracaoMeses >= 3 && i === data.duracaoMeses - 2
                          ? "pre_competitivo"
                          : "preparatorio"
                    ]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>


          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-1">
              Levantamentos ({data.levantamentos.length}/4)
              <HelpTip title="Quantos levantamentos usar?">
                <p>Você pode usar de 1 a 4 levantamentos por aluno.</p>
                <p>
                  Cada um tem seu próprio 1RM, sua própria frequência semanal (que pode mudar de mês
                  para mês) e seus próprios dias — dois levantamentos podem dividir o mesmo dia ou
                  ficar isolados, como você preferir.
                </p>
              </HelpTip>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={addLev}
              disabled={data.levantamentos.length >= 4 || disponiveis.length === 0}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Levantamento
            </Button>
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
            const items = ensureAq(data.aquecimento)[b.key];
            const subs = b.subcategorias;
            return (
              <div key={b.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {b.key}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
                  <Button size="sm" variant="ghost" className="h-6 ml-auto" onClick={() => addAq(b.key)}>
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
                            <div className="flex items-center gap-1 ml-2">
                              <Label className="text-[10px] text-muted-foreground mr-1">
                                Dias
                              </Label>
                              {aqDias.map((dia) => {
                                const atual = ex.dias ?? [];
                                const on = atual.includes(dia);
                                return (
                                  <button
                                    key={dia}
                                    type="button"
                                    title={`Sessão ${dia}`}
                                    onClick={() => toggleAqDia(b.key, i, dia, atual)}
                                    className={`h-6 min-w-[28px] px-1.5 rounded text-[10px] font-semibold border transition-colors ${
                                      on
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                    }`}
                                  >
                                    {dia}
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

      {/* Levantamentos */}
      {data.levantamentos.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum levantamento adicionado ainda.
          </CardContent>
        </Card>
      )}

      {data.levantamentos.map((lev, li) => {
        const base = PS_LEV_BASE[lev.tipo];
        const done = sessionCounts[variacaoKey(lev.tipo)] ?? 0;
        const st = statusLevantamento(lev, done);
        return (
          <Card key={lev.tipo}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>{PS_LEV_LABEL[lev.tipo]}</Badge>
                <span className="text-muted-foreground font-normal text-sm">{base.nome}</span>
                {base.video_url && (
                  <a
                    href={base.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-xs"
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Vídeo
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive ml-auto"
                  onClick={() => removeLev(li)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Levantamento</Label>
                  <Select
                    value={lev.tipo}
                    onValueChange={(v) => updateLev(li, { tipo: v as PSLevantamento })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PS_LEVANTAMENTOS.filter((t) => t === lev.tipo || !usados.includes(t)).map(
                        (t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {PS_LEV_LABEL[t]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">1RM (kg)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={lev.rm1 || ""}
                    onChange={(e) => updateLev(li, { rm1: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    Dias de treino
                    <HelpTip title="Em quais sessões este levantamento entra?">
                      <p>
                        Os slots T1..T{diasSemana} são as sessões da semana, compartilhadas por
                        toda a prescrição.
                      </p>
                      <p>
                        Marque os slots em que este levantamento é treinado. Mais de um
                        levantamento pode ocupar o mesmo slot.
                      </p>
                    </HelpTip>
                  </Label>
                  <div className="flex gap-1 flex-wrap pt-1">
                    {aqDias.map((d) => {
                      const on = lev.diasTreino.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          title={`Sessão ${d}`}
                          onClick={() => toggleDia(li, d)}
                          className={
                            "h-7 min-w-[32px] px-2 rounded text-[10px] font-semibold border transition-colors " +
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

              {/* Preview ao vivo */}
              <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    Sessão atual ·{" "}
                    <strong className="text-foreground">
                      {done}/{totalSessoes(lev)}
                    </strong>{" "}
                    concluídas
                  </span>
                  {st.phase === "sessao" && (
                    <span>
                      Mês {st.sessao.mesIdx + 1} · Semana {st.sessao.semanaIdx + 1} · Sessão{" "}
                      {st.sessao.sessaoIdx + 1}
                    </span>
                  )}
                </div>
                {st.phase === "sessao" &&
                  st.sessao.zonas.map((z) => (
                    <div key={z.zona} className="text-xs flex items-center justify-between gap-2">
                      <span className="font-medium">{z.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {z.series} reps @ <strong className="text-foreground">{z.kg} kg</strong>
                      </span>
                    </div>
                  ))}
                {st.phase === "concluido" && (
                  <p className="text-xs text-success italic">Programa concluído neste levantamento.</p>
                )}
                {st.phase === "vazio" && (
                  <p className="text-xs text-muted-foreground italic">
                    Configure NL e sessões para ver a prescrição.
                  </p>
                )}
              </div>

              {/* Meses */}
              <Accordion type="multiple" className="w-full">
                {lev.meses.map((mes, mi) => (
                  <AccordionItem key={mi} value={`m${mi}`}>
                    <AccordionTrigger className="text-sm">
                      Mês {mi + 1} · {PS_FASE_LABEL[mes.fase]} · NL {fmt(mes.nlMensal)} · ARI{" "}
                      {fmt(ariReal(mes))}%
                    </AccordionTrigger>
                    <AccordionContent>{renderMes(lev, li, mes, mi)}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        );
      })}

      {/* Auxiliares por slot de dia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Auxiliares
            <HelpTip>
              <p>
                Exercícios complementares, prescritos por slot de dia (T1..T{diasSemana}) — os
                mesmos slots usados pelos levantamentos e pelo aquecimento.
              </p>
              <p>Séries e reps fixos, sem percentual. O kg é opcional e digitado à mão.</p>
            </HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {aqDias.map((slot) => {
            const levsDoSlot = data.levantamentos
              .filter((l) => l.diasTreino.includes(slot))
              .map((l) => PS_LEV_LABEL[l.tipo]);
            return (
              <div key={slot} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{slot}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {levsDoSlot.length ? levsDoSlot.join(" + ") : "Sem levantamento neste slot"}
                  </span>
                </div>
                <AuxiliaresBlock
                  title=""
                  emptyLabel="Sem auxiliares neste dia."
                  itens={psAuxiliaresDoSlot(data, slot)}
                  categorias={forcaCategories}
                  onAdd={() => addAux(slot)}
                  onUpdate={(i, patch) => updateAux(slot, i, patch)}
                  onRemove={(i) => removeAux(slot, i)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
