import { useMemo, useState } from "react";
import { AlunoDeficitsAlert } from "./AlunoDeficitsAlert";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, FileDown, Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  type MileDeep1RMConteudo,
  type MD1Par,
  MD1_FAIXAS,
  MILEDEEP1RM_LABEL,
  emptyMileDeep1RM,
  levantamentosDoParMD1,
  md1Slots,
  normalizarParesMD1,
  planoMD1,
} from "@/lib/mileDeep1RM";
import {
  type MDBlocoId,
  type MDLevantamento,
  MD_LEVANTAMENTOS_INFERIORES,
  MD_LEVANTAMENTOS_SUPERIORES,
  MD_LEV_BASE,
  MD_TOTAL_SEMANAS,
  auxiliarVazioMD,
} from "@/lib/mileDeepShared";
import type { AuxiliarItem } from "@/components/student/workout/AuxiliaresBlock";
import { AuxiliaresBlock } from "@/components/student/workout/AuxiliaresBlock";
import { useExerciseCategories } from "@/hooks/useExerciseCategories";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { MethodGuideSheet } from "@/components/student/workout/MethodGuideSheet";
import { MILE_DEEP_1RM_METHOD_GUIDE } from "@/components/student/workout/methodGuides";
import {
  AquecimentoGlobalCard,
  OrdemBlocosSelect,
  TabelaReferenciaMD,
  semanaPorSlotMD,
  useConcluidasPorSlot,
  useMileDeepPersistencia,
} from "./MileDeepEditorShared";
import { exportMileDeep1RMPDF } from "./exportMileDeep1RMPDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: MileDeep1RMConteudo;
  onSaved?: () => void;
}

export function PrescricaoMileDeep1RMEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const [data, setData] = useState<MileDeep1RMConteudo>(() => {
    const base = initial ?? emptyMileDeep1RM();
    return { ...base, pares: normalizarParesMD1(base.pares) };
  });
  const { categoriasForca } = useExerciseCategories();

  const { treinoId, savingLabel, publishing, publicar } = useMileDeepPersistencia({
    alunoId,
    initialTreinoId,
    descricao: `${MILEDEEP1RM_LABEL} — ciclo de ${MD_TOTAL_SEMANAS} semanas`,
    templateFase: MILEDEEP1RM_LABEL,
    data,
    onSaved,
  });

  const concluidasPorSlot = useConcluidasPorSlot(treinoId);
  const SLOTS = useMemo(() => md1Slots(), []);
  const semanaPorSlot = useMemo(
    () => semanaPorSlotMD(SLOTS, concluidasPorSlot),
    [SLOTS, concluidasPorSlot],
  );

  const patchPar = (idx: number, patch: Partial<MD1Par>) =>
    setData((p) => ({
      ...p,
      pares: p.pares.map((par, i) => (i === idx ? { ...par, ...patch } : par)),
    }));

  const patchLev = (
    idx: number,
    campo: "superior" | "inferior",
    patch: Partial<{ levantamento: MDLevantamento; rm1: number }>,
  ) =>
    setData((p) => ({
      ...p,
      pares: p.pares.map((par, i) =>
        i === idx ? { ...par, [campo]: { ...par[campo], ...patch } } : par,
      ),
    }));

  const addAux = (idx: number) =>
    patchPar(idx, { auxiliares: [...data.pares[idx].auxiliares, auxiliarVazioMD()] });
  const updateAux = (idx: number, k: number, patch: Partial<AuxiliarItem>) =>
    patchPar(idx, {
      auxiliares: data.pares[idx].auxiliares.map((a, j) => (j === k ? { ...a, ...patch } : a)),
    });
  const removeAux = (idx: number, k: number) =>
    patchPar(idx, { auxiliares: data.pares[idx].auxiliares.filter((_, j) => j !== k) });

  const handlePublish = () => {
    const todos = data.pares.flatMap(levantamentosDoParMD1);
    if (todos.some((l) => !l.rm1)) {
      toast.error("Informe o 1RM de todos os levantamentos.");
      return;
    }
    const nomes = todos.map((l) => l.levantamento);
    if (new Set(nomes).size !== nomes.length) {
      toast.error("Não repita o mesmo levantamento entre os pares.");
      return;
    }
    if (data.pares.some((p) => p.auxiliares.some((a) => !a.categoria || !a.exercicio))) {
      toast.error("Escolha categoria e exercício de todos os auxiliares.");
      return;
    }
    publicar(onBack);
  };

  const handleExport = async (mode: "download" | "print") => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", alunoId)
        .maybeSingle();
      const student = (aluno ?? { id: alunoId, nome: alunoNome }) as Tables<"alunos">;
      await exportMileDeep1RMPDF({ student, data, semanaPorSlot, print: mode === "print" });
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e instanceof Error ? e.message : String(e)));
    }
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
              <Sparkles className="w-5 h-5 text-primary" /> {MILEDEEP1RM_LABEL} · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              4 levantamentos em 2 pares · {MD_TOTAL_SEMANAS} semanas · sem cálculo de carga.
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
          <MethodGuideSheet guide={MILE_DEEP_1RM_METHOD_GUIDE} />
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
            Pares e 1RM
            <HelpTip title="Como funciona o Quality a Mile Deep">
              <p>
                São 3 blocos de 4 semanas: 5 reps (5→8 séries), 3 reps (10→13) e 2 reps (12→15). A
                ordem dos blocos é livre e cada par percorre os 3 blocos ao longo dos 3 meses.
              </p>
              <p>
                Não há cálculo de carga: siga a faixa de % do bloco, autorregulando com 1-2
                repetições de reserva. Depois da semana {MD_TOTAL_SEMANAS} o ciclo reinicia.
              </p>
            </HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.pares.map((par, idx) => (
            <div key={par.slot} className="rounded-md border border-border/60 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Badge>{par.slot}</Badge>
                <span className="text-sm font-semibold">Par {idx + 1}</span>
                <span className="text-xs text-muted-foreground">
                  semana {semanaPorSlot[par.slot] ?? 1} de {MD_TOTAL_SEMANAS}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(["inferior", "superior"] as const).map((campo) => {
                  const lista =
                    campo === "inferior" ? MD_LEVANTAMENTOS_INFERIORES : MD_LEVANTAMENTOS_SUPERIORES;
                  const lev = par[campo];
                  return (
                    <div key={campo} className="grid grid-cols-[1fr_110px] gap-2 items-end">
                      <div>
                        <Label className="text-xs capitalize">{campo}</Label>
                        <Select
                          value={lev.levantamento}
                          onValueChange={(v) =>
                            patchLev(idx, campo, { levantamento: v as MDLevantamento })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {lista.map((l) => (
                              <SelectItem key={l} value={l} className="text-sm">
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Banco: {MD_LEV_BASE[lev.levantamento].nome}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs">1RM (kg)</Label>
                        <Input
                          type="number"
                          className="h-8"
                          value={lev.rm1 || ""}
                          onChange={(e) =>
                            patchLev(idx, campo, { rm1: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <Label className="text-xs">Ordem dos blocos (3 meses)</Label>
                <OrdemBlocosSelect
                  ordem={par.ordem}
                  onChange={(ordem: MDBlocoId[]) => patchPar(idx, { ordem })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AquecimentoGlobalCard
        aquecimento={data.aquecimento}
        dias={SLOTS}
        onChange={(aquecimento) => setData((p) => ({ ...p, aquecimento }))}
      />

      {data.pares.map((par, idx) => {
        const semana = semanaPorSlot[par.slot] ?? 1;
        const plano = planoMD1(par, semana);
        return (
          <Card key={par.slot}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>{par.slot}</Badge>
                <span>Sessão {idx + 1}</span>
                <span className="text-muted-foreground font-normal text-sm">
                  semana {semana} · {plano.bloco.label} · {plano.esquema} · {plano.faixaLabel} do 1RM
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Levantamentos desta sessão
                </p>
                {levantamentosDoParMD1(par).map((l, k) => (
                  <div key={k} className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium">{l.levantamento}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {plano.esquema} · {plano.faixaLabel} do 1RM ({l.rm1 || "—"} kg)
                    </span>
                  </div>
                ))}
              </div>

              <AuxiliaresBlock
                title="Auxiliares"
                emptyLabel="Sem auxiliares nesta sessão."
                itens={par.auxiliares}
                categorias={categoriasForca}
                onAdd={() => addAux(idx)}
                onUpdate={(k, patch) => updateAux(idx, k, patch)}
                onRemove={(k) => removeAux(idx, k)}
              />
            </CardContent>
          </Card>
        );
      })}

      {data.pares.map((par, idx) => (
        <TabelaReferenciaMD
          key={`tab-${par.slot}`}
          ordem={par.ordem}
          faixas={MD1_FAIXAS}
          titulo={`Par ${idx + 1} (${par.slot})`}
        />
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
