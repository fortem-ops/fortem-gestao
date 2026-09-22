import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlunoDeficitsAlert } from "./AlunoDeficitsAlert";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  type XFabConteudo,
  type XFabPar,
  type XFabSlot,
  type XFabTreinoOrdem,
  type XFabContagemTreinos,
  emptyXFab,
  normalizarTreinosXFab,
  XFAB_LEV_BASE,
  XFAB_PARES,
  XFAB_TREINOS,
  XFAB_SESSOES,
  XFAB_TOTAL_SESSOES,
  XFAB_MENSAGEM_CONCLUIDO,
  statusPar,
  sessaoAuxiliar,
  alvoLevantamento,
} from "@/lib/xfab";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { exportXFabPDF } from "./exportXFabPDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: XFabConteudo;
  onSaved?: () => void;
}

const DIAS: XFabSlot[] = ["T1", "T2", "T3"];

export function PrescricaoXFabEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<XFabConteudo>(() => {
    const base = initial ?? emptyXFab();
    return { ...base, treinos: normalizarTreinosXFab(base.treinos) };
  });
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipNext = useRef(true);

  const { blocosAquecimento } = useExerciseCategories();
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

  // Contagem de sessões concluídas por treino (T1/T2/T3)
  const { data: sessionCounts = { T1: 0, T2: 0, T3: 0 } as XFabContagemTreinos } = useQuery({
    queryKey: ["xfab-session-counts", treinoId],
    enabled: !!treinoId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("treino_sessoes")
        .select("variacao")
        .eq("treino_id", treinoId!)
        .not("concluido_em", "is", null);
      const counts: XFabContagemTreinos = { T1: 0, T2: 0, T3: 0 };
      (rows || []).forEach((r: { variacao: string }) => {
        if (r.variacao === "T1" || r.variacao === "T2" || r.variacao === "T3") {
          counts[r.variacao as XFabSlot]++;
        }
      });
      return counts;
    },
  });

  // ── Autosave ────────────────────────────────────────────────
  const saveDraft = useCallback(
    async (next: XFabConteudo) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
        const descricao = "X-FAB Hipertrofia — 12 sessões por par";
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
              template_fase: "X-FAB Hipertrofia",
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
    aq: XFabConteudo["aquecimento"] | undefined,
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

  // ── Auxiliares ──────────────────────────────────────────────
  const updateAux = (
    ordem: XFabTreinoOrdem,
    bi: number,
    ei: number,
    patch: Partial<{ exercicio: string; video_url: string | null }>,
  ) =>
    setData((p) => ({
      ...p,
      treinos: p.treinos.map((t) =>
        t.ordem !== ordem
          ? t
          : {
              ...t,
              blocosAuxiliares: t.blocosAuxiliares.map((bloco, b) =>
                b !== bi ? bloco : bloco.map((ex, e) => (e !== ei ? ex : { ...ex, ...patch })),
              ),
            },
      ),
    }));

  const setRm = (k: keyof XFabConteudo["rm"], val: number) =>
    setData((p) => ({ ...p, rm: { ...p.rm, [k]: val } }));

  // ── Publicar ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!user) return;
    const r = data.rm;
    if (!r.terra || !r.press || !r.agachamento || !r.supino) {
      toast.error("Informe o 1RM dos 4 levantamentos com carga calculada.");
      return;
    }
    const faltando = data.treinos.some((t) =>
      t.blocosAuxiliares.some((bloco) => bloco.some((ex) => !ex.exercicio)),
    );
    if (faltando) {
      toast.error("Escolha todos os exercícios auxiliares dos 3 treinos.");
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
      toast.success("Prescrição X-FAB enviada ao aluno.");
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
      await exportXFabPDF({ student, data, counts: sessionCounts, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Render de um bloco de par (levantamentos básicos) ────────
  const renderPar = (par: XFabPar) => {
    const st = statusPar(sessionCounts, par);
    return (
      <div key={par} className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Par {par} · <strong className="text-foreground">{st.done}/{XFAB_TOTAL_SESSOES}</strong>{" "}
            sessões concluídas
          </span>
          {st.phase === "regular" && <span>Sessão {st.proxima.sessao}</span>}
        </div>
        {st.phase === "concluded" ? (
          <p className="text-xs text-success italic">{XFAB_MENSAGEM_CONCLUIDO}</p>
        ) : (
          <div className="space-y-1">
            {XFAB_PARES[par].map((lev) => {
              const base = XFAB_LEV_BASE[lev];
              const { alvo, kg } = alvoLevantamento(lev, st.proxima, data.rm);
              return (
                <div key={lev} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{base.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {alvo}
                      {kg !== null && (
                        <>
                          {" · "}
                          <strong className="text-foreground">{kg} kg</strong>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
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
                </div>
              );
            })}
          </div>
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
              <Sparkles className="w-5 h-5 text-primary" /> X-FAB Hipertrofia · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              3 treinos/semana · 3 pares de levantamentos · 12 sessões por par.
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
          <CardTitle className="text-base flex items-center gap-2">
            1RM dos levantamentos
            <HelpTip title="Como a carga é calculada">
              <p>
                Terra, Press, Agachamento e Supino usam a carga calculada: 1RM × % da sessão,
                arredondada para o múltiplo de 2,5 kg mais próximo.
              </p>
              <p>
                Pullup* e Serrote* não têm 1RM: o alvo é em RM (repetições máximas) e a carga fica
                em branco, para anotar à mão. Os auxiliares seguem a mesma lógica.
              </p>
            </HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(["terra", "press", "agachamento", "supino"] as const).map((k) => (
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

      {/* Tabela fixa de 12 sessões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Tabela de 12 sessões (fixa)
            <HelpTip title="Como ler a tabela">
              <p>
                A progressão é a mesma para todos os levantamentos e auxiliares. Cada par avança
                uma sessão a cada treino concluído em que ele aparece.
              </p>
              <p>
                Os auxiliares seguem a contagem do treino a que pertencem, já que não trocam de
                treino.
              </p>
            </HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1 pr-3 font-semibold">Sessão</th>
                <th className="py-1 pr-3 font-semibold">Básicos (%1RM)</th>
                <th className="py-1 pr-3 font-semibold">Com * (RM)</th>
                <th className="py-1 font-semibold">Auxiliares</th>
              </tr>
            </thead>
            <tbody>
              {XFAB_SESSOES.map((s) => (
                <tr key={s.sessao} className="border-t border-border/50">
                  <td className="py-1 pr-3 font-semibold">{s.sessao}</td>
                  <td className="py-1 pr-3">{`${s.esquema}@${s.pct}%`}</td>
                  <td className="py-1 pr-3">{`${s.esquema}@${s.rmAlvo}RM`}</td>
                  <td className="py-1">{s.auxiliar}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* 3 treinos fixos */}
      {data.treinos.map((tr) => {
        const estrutura = XFAB_TREINOS[tr.ordem];
        const planoAux = sessaoAuxiliar(sessionCounts, tr.ordem);
        return (
          <Card key={tr.ordem}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>T{tr.ordem}</Badge>
                <span>Treino {tr.ordem}</span>
                <span className="text-muted-foreground font-normal text-sm">
                  —{" "}
                  {estrutura.pares
                    .map((p) => XFAB_PARES[p].map((l) => XFAB_LEV_BASE[l].label).join(" + "))
                    .join(" | ")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Levantamentos básicos (série alternada)
                </p>
                {estrutura.pares.map((p) => renderPar(p))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Auxiliares (série alternada)
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {planoAux
                      ? `Sessão ${planoAux.sessao} · ${planoAux.auxiliar}`
                      : XFAB_MENSAGEM_CONCLUIDO}
                  </span>
                </div>
                {tr.blocosAuxiliares.map((bloco, bi) => (
                  <div key={bi} className="rounded-md border p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      Bloco {bi + 1} · {bloco.map((ex) => ex.categoria).join(" + ")}
                    </p>
                    {bloco.map((ex, ei) => (
                      <div key={ei} className="grid grid-cols-[70px_1fr] gap-2 items-center">
                        <Badge variant="outline" className="justify-center text-[10px] font-bold">
                          {ex.categoria}
                        </Badge>
                        <ExerciseSelector
                          categoria={ex.categoria}
                          value={ex.exercicio}
                          placeholder={`Buscar exercício de ${ex.categoria}...`}
                          onChange={(val, video) =>
                            updateAux(tr.ordem, bi, ei, { exercicio: val, video_url: video })
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
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
