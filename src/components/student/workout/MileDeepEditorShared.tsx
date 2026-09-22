/**
 * Peças compartilhadas pelos editores "Quality a Mile Deep" (1RM e 5RM):
 * autosave, contagem cíclica de semanas, aquecimento global, seleção da
 * ordem dos blocos e tabela de referência das 12 semanas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import type {
  AquecimentoBloco,
  PersonalizadoAquecimentoEx,
} from "@/components/student/workout/personalizadoTypes";
import { ensureAquecimentoRecord } from "@/components/student/workout/personalizadoTypes";
import { ExerciseSelector } from "@/components/student/workout/ExerciseSelector";
import { useExerciseCategories, GRUPO_AQUECIMENTO } from "@/hooks/useExerciseCategories";
import {
  type MDBlocoId,
  type MDFaixas,
  MD_BLOCOS,
  MD_BLOCO_IDS,
  MD_TOTAL_SEMANAS,
  normalizarOrdemMD,
  semanaAtualMD,
  tabelaMD,
} from "@/lib/mileDeepShared";

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/** Sessões concluídas por slot (T1, T2, …) do treino. */
export function useConcluidasPorSlot(treinoId: string | undefined) {
  const [concluidasPorSlot, setConcluidasPorSlot] = useState<Record<string, number>>({});
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
  return concluidasPorSlot;
}

export function semanaPorSlotMD(
  slots: string[],
  concluidasPorSlot: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  slots.forEach((s) => {
    out[s] = semanaAtualMD(concluidasPorSlot[s] ?? 0);
  });
  return out;
}

/** Autosave em `treinos` (rascunho) + publicação como treino atual. */
export function useMileDeepPersistencia<T>({
  alunoId,
  initialTreinoId,
  descricao,
  templateFase,
  data,
  onSaved,
}: {
  alunoId: string;
  initialTreinoId?: string;
  descricao: string;
  templateFase: string;
  data: T;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [treinoId, setTreinoId] = useState<string | undefined>(initialTreinoId);
  const [savingLabel, setSavingLabel] = useState("");
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const skipNext = useRef(true);

  const saveDraft = useCallback(
    async (next: T) => {
      if (!user) return;
      setSavingLabel("Salvando…");
      try {
        const conteudo = next as unknown as Json;
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
              template_fase: templateFase,
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
    [alunoId, treinoId, user, descricao, templateFase, onSaved],
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

  const publicar = useCallback(
    async (onDone: () => void) => {
      if (!user) return;
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
        toast.success("Prescrição enviada ao aluno.");
        onSaved?.();
        onDone();
      } catch (e) {
        toast.error("Erro ao concluir: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        setPublishing(false);
      }
    },
    [alunoId, data, dirty, onSaved, saveDraft, treinoId, user],
  );

  return { treinoId, savingLabel, publishing, publicar };
}

/** Todas as ordens possíveis dos 3 blocos, como opções de select. */
export const MD_ORDENS: MDBlocoId[][] = [
  ["b5", "b3", "b2"],
  ["b5", "b2", "b3"],
  ["b3", "b5", "b2"],
  ["b3", "b2", "b5"],
  ["b2", "b5", "b3"],
  ["b2", "b3", "b5"],
];

export const ordemKey = (ordem: MDBlocoId[]) => normalizarOrdemMD(ordem).join("-");
export const ordemLabel = (ordem: MDBlocoId[]) =>
  normalizarOrdemMD(ordem)
    .map((b, i) => `Mês ${i + 1}: ${MD_BLOCOS[b].reps} reps`)
    .join(" · ");

export function OrdemBlocosSelect({
  ordem,
  onChange,
}: {
  ordem: MDBlocoId[];
  onChange: (ordem: MDBlocoId[]) => void;
}) {
  return (
    <Select
      value={ordemKey(ordem)}
      onValueChange={(v) => onChange(v.split("-") as MDBlocoId[])}
    >
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MD_ORDENS.map((o) => (
          <SelectItem key={ordemKey(o)} value={ordemKey(o)} className="text-xs">
            {ordemLabel(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Tabela de referência das 12 semanas de uma ordem de blocos. */
export function TabelaReferenciaMD({
  ordem,
  faixas,
  titulo,
}: {
  ordem: MDBlocoId[];
  faixas: MDFaixas;
  titulo: string;
}) {
  const linhas = useMemo(() => tabelaMD(ordem, faixas), [ordem, faixas]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {titulo} · {MD_TOTAL_SEMANAS} semanas
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1 pr-3 font-semibold">Semana</th>
              <th className="py-1 pr-3 font-semibold">Bloco</th>
              <th className="py-1 pr-3 font-semibold">Séries × reps</th>
              <th className="py-1 pr-3 font-semibold">Faixa de %</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.semana} className="border-t border-border/50">
                <td className="py-1 pr-3 font-semibold">Semana {l.semana}</td>
                <td className="py-1 pr-3">
                  {l.bloco.label} (mês {l.mes})
                </td>
                <td className="py-1 pr-3">{l.esquema}</td>
                <td className="py-1 pr-3">{l.faixaLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted-foreground">
          NL por bloco:{" "}
          {MD_BLOCO_IDS.map((b) => `${MD_BLOCOS[b].reps} reps = ${MD_BLOCOS[b].nl}`).join(" · ")}.
          Sem cálculo de carga: o peso é autorregulado com 1-2 repetições de reserva e anotado
          manualmente.
        </p>
      </CardContent>
    </Card>
  );
}

type AquecimentoRecord = Record<AquecimentoBloco, PersonalizadoAquecimentoEx[]>;

/** Bloco de aquecimento global (LIB/MOB/ATI/PREV) com marcação de dias. */
export function AquecimentoGlobalCard({
  aquecimento,
  dias,
  onChange,
}: {
  aquecimento: AquecimentoRecord | undefined;
  dias: string[];
  onChange: (next: AquecimentoRecord) => void;
}) {
  const { blocosAquecimento } = useExerciseCategories();
  const blocos = useMemo(
    () =>
      blocosAquecimento.map((b) => ({
        key: b.sigla,
        label: `${b.categoria} (${b.sigla})`,
        categoria: b.categoria,
        subcategorias: b.subcategorias,
      })),
    [blocosAquecimento],
  );
  const siglas = useMemo(() => blocos.map((b) => b.key), [blocos]);
  const aq = ensureAquecimentoRecord(aquecimento, siglas);

  const add = (b: AquecimentoBloco) =>
    onChange({ ...aq, [b]: [...aq[b], { exercicio: "", repeticoes: "10", dias: [...dias] }] });
  const update = (b: AquecimentoBloco, i: number, patch: Partial<PersonalizadoAquecimentoEx>) =>
    onChange({ ...aq, [b]: aq[b].map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)) });
  const remove = (b: AquecimentoBloco, i: number) =>
    onChange({ ...aq, [b]: aq[b].filter((_, idx) => idx !== i) });
  const toggleDia = (b: AquecimentoBloco, i: number, dia: string) =>
    onChange({
      ...aq,
      [b]: aq[b].map((ex, idx) => {
        if (idx !== i) return ex;
        const has = ex.dias.includes(dia);
        return { ...ex, dias: has ? ex.dias.filter((d) => d !== dia) : [...ex.dias, dia] };
      }),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aquecimento (global)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocos.map((b) => {
          const items = aq[b.key] ?? [];
          return (
            <div key={b.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold">
                  {b.key}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
                <Button size="sm" variant="ghost" className="h-6 ml-auto" onClick={() => add(b.key)}>
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
                              update(b.key, i, {
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
                                update(b.key, i, { exercicio: val, video_url: video })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label className="text-[10px] text-muted-foreground">Reps</Label>
                          <Input
                            value={ex.repeticoes}
                            onChange={(e) => update(b.key, i, { repeticoes: e.target.value })}
                            className="h-6 w-24 text-xs"
                            placeholder='10 ou 60"'
                          />
                          <Label className="text-[10px] text-muted-foreground ml-2">Dias</Label>
                          <div className="flex gap-1">
                            {dias.map((d) => {
                              const on = ex.dias.includes(d);
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => toggleDia(b.key, i, d)}
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
                        onClick={() => remove(b.key, i)}
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
  );
}
