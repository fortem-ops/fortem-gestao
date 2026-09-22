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
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Loader2,
  Plus,
  Printer,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  type MileDeep5RMConteudo,
  type MD5Sessao,
  MD5_FAIXAS,
  MD5_MAX_SESSOES,
  MD5_MIN_SESSOES,
  MILEDEEP5RM_LABEL,
  emptyMileDeep5RM,
  md5Slots,
  normalizarSessoesMD5,
  planoMD5,
  sessaoVaziaMD5,
} from "@/lib/mileDeep5RM";
import {
  type MDBlocoId,
  type MDLevantamento,
  MD_LEVANTAMENTOS,
  MD_LEV_BASE,
  MD_TOTAL_SEMANAS,
  auxiliarVazioMD,
} from "@/lib/mileDeepShared";
import type { AuxiliarItem } from "@/components/student/workout/AuxiliaresBlock";
import { AuxiliaresBlock } from "@/components/student/workout/AuxiliaresBlock";
import { useExerciseCategories } from "@/hooks/useExerciseCategories";
import { HelpTip } from "@/components/student/workout/HelpTip";
import { MethodGuideSheet } from "@/components/student/workout/MethodGuideSheet";
import { MILE_DEEP_5RM_METHOD_GUIDE } from "@/components/student/workout/methodGuides";
import {
  AquecimentoGlobalCard,
  OrdemBlocosSelect,
  TabelaReferenciaMD,
  semanaPorSlotMD,
  useConcluidasPorSlot,
  useMileDeepPersistencia,
} from "./MileDeepEditorShared";
import { exportMileDeep5RMPDF } from "./exportMileDeep5RMPDF";

interface Props {
  alunoId: string;
  alunoNome: string;
  onBack: () => void;
  initialTreinoId?: string;
  initial?: MileDeep5RMConteudo;
  onSaved?: () => void;
}

export function PrescricaoMileDeep5RMEditor({
  alunoId,
  alunoNome,
  onBack,
  initialTreinoId,
  initial,
  onSaved,
}: Props) {
  const [data, setData] = useState<MileDeep5RMConteudo>(() => {
    const base = initial ?? emptyMileDeep5RM();
    return { ...base, sessoes: normalizarSessoesMD5(base.sessoes) };
  });
  const { categoriasForca } = useExerciseCategories();

  const { treinoId, savingLabel, publishing, publicar } = useMileDeepPersistencia({
    alunoId,
    initialTreinoId,
    descricao: `${MILEDEEP5RM_LABEL} — ciclo de ${MD_TOTAL_SEMANAS} semanas`,
    templateFase: MILEDEEP5RM_LABEL,
    data,
    onSaved,
  });

  const concluidasPorSlot = useConcluidasPorSlot(treinoId);
  const SLOTS = useMemo(() => md5Slots(data), [data]);
  const semanaPorSlot = useMemo(
    () => semanaPorSlotMD(SLOTS, concluidasPorSlot),
    [SLOTS, concluidasPorSlot],
  );

  const patchSessao = (idx: number, patch: Partial<MD5Sessao>) =>
    setData((p) => ({
      ...p,
      sessoes: p.sessoes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));

  const addSessao = () =>
    setData((p) =>
      p.sessoes.length >= MD5_MAX_SESSOES
        ? p
        : { ...p, sessoes: [...p.sessoes, sessaoVaziaMD5(p.sessoes.length)] },
    );

  const removeSessao = (idx: number) =>
    setData((p) =>
      p.sessoes.length <= MD5_MIN_SESSOES
        ? p
        : {
            ...p,
            sessoes: p.sessoes
              .filter((_, i) => i !== idx)
              .map((s, i) => ({ ...s, slot: `T${i + 1}` })),
          },
    );

  const addAux = (idx: number) =>
    patchSessao(idx, { auxiliares: [...data.sessoes[idx].auxiliares, auxiliarVazioMD()] });
  const updateAux = (idx: number, k: number, patch: Partial<AuxiliarItem>) =>
    patchSessao(idx, {
      auxiliares: data.sessoes[idx].auxiliares.map((a, j) => (j === k ? { ...a, ...patch } : a)),
    });
  const removeAux = (idx: number, k: number) =>
    patchSessao(idx, { auxiliares: data.sessoes[idx].auxiliares.filter((_, j) => j !== k) });

  const handlePublish = () => {
    if (data.sessoes.some((s) => !s.rm5)) {
      toast.error("Informe o 5RM de todos os levantamentos.");
      return;
    }
    const nomes = data.sessoes.map((s) => s.levantamento);
    if (new Set(nomes).size !== nomes.length) {
      toast.error("Não repita o mesmo levantamento entre as sessões.");
      return;
    }
    if (data.sessoes.some((s) => s.auxiliares.some((a) => !a.categoria || !a.exercicio))) {
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
      await exportMileDeep5RMPDF({ student, data, semanaPorSlot, print: mode === "print" });
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
              <Sparkles className="w-5 h-5 text-primary" /> {MILEDEEP5RM_LABEL} · {alunoNome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Um levantamento por sessão · {MD_TOTAL_SEMANAS} semanas · faixas de % do 5RM.
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
          <MethodGuideSheet guide={MILE_DEEP_5RM_METHOD_GUIDE} />
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
            Levantamentos e 5RM ({data.sessoes.length})
            <HelpTip title="Como funciona a versão 5RM">
              <p>
                Cada levantamento tem sua própria sessão e sua própria ordem de blocos, totalmente
                independente dos demais.
              </p>
              <p>
                As faixas são do 5RM: 5 reps 60-95% · 3 reps 70-80% · 2 reps 75-95%. Sem cálculo de
                carga — autorregule com 1-2 repetições de reserva.
              </p>
            </HelpTip>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={addSessao}
              disabled={data.sessoes.length >= MD5_MAX_SESSOES}
            >
              <Plus className="w-3 h-3 mr-1" /> Levantamento
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.sessoes.map((s, idx) => (
            <div
              key={s.slot}
              className="grid grid-cols-1 md:grid-cols-[80px_1fr_110px_minmax(0,1fr)_auto] gap-3 items-end rounded-md border border-border/60 p-3"
            >
              <Badge className="w-fit">{s.slot}</Badge>
              <div>
                <Label className="text-xs">Levantamento</Label>
                <Select
                  value={s.levantamento}
                  onValueChange={(v) => patchSessao(idx, { levantamento: v as MDLevantamento })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MD_LEVANTAMENTOS.map((l) => (
                      <SelectItem key={l} value={l} className="text-sm">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Banco: {MD_LEV_BASE[s.levantamento].nome}
                </p>
              </div>
              <div>
                <Label className="text-xs">5RM (kg)</Label>
                <Input
                  type="number"
                  className="h-8"
                  value={s.rm5 || ""}
                  onChange={(e) => patchSessao(idx, { rm5: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="text-xs">Ordem dos blocos</Label>
                <OrdemBlocosSelect
                  ordem={s.ordem}
                  onChange={(ordem: MDBlocoId[]) => patchSessao(idx, { ordem })}
                />
              </div>
              {data.sessoes.length > MD5_MIN_SESSOES && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeSessao(idx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AquecimentoGlobalCard
        aquecimento={data.aquecimento}
        dias={SLOTS}
        onChange={(aquecimento) => setData((p) => ({ ...p, aquecimento }))}
      />

      {data.sessoes.map((s, idx) => {
        const semana = semanaPorSlot[s.slot] ?? 1;
        const plano = planoMD5(s, semana);
        return (
          <Card key={s.slot}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge>{s.slot}</Badge>
                <span>{s.levantamento}</span>
                <span className="text-muted-foreground font-normal text-sm">
                  semana {semana} · {plano.bloco.label} · {plano.esquema} · {plano.faixaLabel} do 5RM
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs flex items-center justify-between gap-2">
                <span className="font-medium">{MD_LEV_BASE[s.levantamento].nome}</span>
                <span className="tabular-nums text-muted-foreground">
                  {plano.esquema} · {plano.faixaLabel} do 5RM ({s.rm5 || "—"} kg)
                </span>
              </div>

              <AuxiliaresBlock
                title="Auxiliares"
                emptyLabel="Sem auxiliares nesta sessão."
                itens={s.auxiliares}
                categorias={categoriasForca}
                onAdd={() => addAux(idx)}
                onUpdate={(k, patch) => updateAux(idx, k, patch)}
                onRemove={(k) => removeAux(idx, k)}
              />
            </CardContent>
          </Card>
        );
      })}

      {data.sessoes.map((s) => (
        <TabelaReferenciaMD
          key={`tab-${s.slot}`}
          ordem={s.ordem}
          faixas={MD5_FAIXAS}
          titulo={`${s.slot} · ${s.levantamento}`}
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
