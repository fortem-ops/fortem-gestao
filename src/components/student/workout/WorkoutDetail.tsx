import { useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Video, Printer, FileDown } from "lucide-react";
import { CATEGORY_LABELS, type WorkoutExercise } from "./workoutTemplates";
import { ExerciseSelector } from "./ExerciseSelector";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { exportWorkoutPDF } from "./exportWorkoutPDF";
import { PersonalizadoEditor } from "./PersonalizadoEditor";
import { isPersonalizadoContent } from "./personalizadoTypes";
import { PrescribeOptionsDialog, toISODate, type PrescribeChoice } from "./PrescribeOptionsDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

interface WorkoutDetailProps {
  treino?: {
    id: string;
    descricao: string;
    versao: number;
    status: string;
    conteudo: Json | null;
    created_at: string;
  };
  templateData?: WorkoutData;
  fase?: string;
  alunoId: string;
  /** Optional — needed for the printable PDF (uses the student's name in the header). */
  student?: { id: string; nome: string };
  onBack: () => void;
  onSaved?: () => void;
  readOnly?: boolean;
}

export function WorkoutDetail({ treino, templateData, fase, alunoId, student, onBack, onSaved, readOnly }: WorkoutDetailProps) {
  const { user } = useAuth();

  // Se o treino salvo é Personalizado (shape novo), abre o editor dedicado.
  if (treino?.conteudo && isPersonalizadoContent(treino.conteudo)) {
    return (
      <PersonalizadoEditor
        initial={treino.conteudo.estrutura}
        initialName={treino.descricao}
        alunoId={alunoId}
        alunoNome={student?.nome}
        treinoId={treino.id}
        onBack={onBack}
        onSaved={onSaved}
      />
    );
  }

  const initialData: WorkoutData = treino?.conteudo
    ? (treino.conteudo as unknown as WorkoutData)
    : templateData || { aquecimento: [], treinos: [] };

  const [data, setData] = useState<WorkoutData>(initialData);
  const [descricao, setDescricao] = useState(treino?.descricao || fase || "");
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState<null | "download" | "print">(null);
  const [weeks, setWeeks] = useState<number>(4);

  const updateExercise = (section: "aquecimento" | "treino", treinoIdx: number, exIdx: number, field: string, value: string) => {
    setData(prev => {
      const next = structuredClone(prev);
      if (section === "aquecimento") {
        (next.aquecimento[exIdx] as unknown as Record<string, unknown>)[field] = value;
      } else {
        (next.treinos[treinoIdx].exercicios[exIdx] as unknown as Record<string, unknown>)[field] = value;
      }
      return next;
    });
  };

  // Quando o usuário escolhe um exercício pelo seletor, atualiza nome + vídeo + limpa id antigo.
  const pickExercise = (
    section: "aquecimento" | "treino",
    treinoIdx: number,
    exIdx: number,
    nome: string,
    video?: string | null,
  ) => {
    setData(prev => {
      const next = structuredClone(prev);
      const target = section === "aquecimento"
        ? next.aquecimento[exIdx]
        : next.treinos[treinoIdx].exercicios[exIdx];
      target.exercicio = nome;
      target.video_url = video ?? null;
      // exercicio_id não é mais confiável após troca manual; deixa undefined.
      target.exercicio_id = undefined;
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (treino) {
        const { error } = await supabase
          .from("treinos")
          .update({ conteudo: data as unknown as Json, descricao, updated_at: new Date().toISOString() })
          .eq("id", treino.id);
        if (error) throw error;
      } else {
        // Arquiva treinos anteriores 'atual' do mesmo aluno
        const { error: archiveError } = await supabase
          .from("treinos")
          .update({ status: "arquivado", updated_at: new Date().toISOString() })
          .eq("aluno_id", alunoId)
          .eq("status", "atual");
        if (archiveError) throw archiveError;

        // Calcula próxima versão
        const { data: ultimo } = await supabase
          .from("treinos")
          .select("versao")
          .eq("aluno_id", alunoId)
          .order("versao", { ascending: false })
          .limit(1)
          .maybeSingle();
        const proximaVersao = (ultimo?.versao || 0) + 1;

        const { error } = await supabase.from("treinos").insert({
          aluno_id: alunoId,
          autor_id: user.id,
          descricao,
          conteudo: data as unknown as Json,
          status: "atual",
          versao: proximaVersao,
        });
        if (error) throw error;
      }
      toast.success("Treino salvo com sucesso!");
      onSaved?.();
      onBack();
    } catch (e: unknown) {
      toast.error("Erro ao salvar treino: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (mode: "download" | "print", weeksCount: number) => {
    let aluno = student as { id: string; nome: string } | undefined;
    if (!aluno) {
      const { data: a } = await supabase.from("alunos").select("*").eq("id", alunoId).maybeSingle();
      if (!a) {
        toast.error("Não foi possível carregar os dados do aluno.");
        return;
      }
      aluno = a;
    }
    // URL pública do treino para o QR Code — rota /treino/:id em modo somente leitura,
    // sem login, para o aluno conferir vídeos pelo celular durante o treino.
    const appUrl = treino?.id
      ? `${window.location.origin}/treino/${treino.id}`
      : `${window.location.origin}/alunos/${alunoId}`;
    await exportWorkoutPDF({
      student: aluno as Parameters<typeof exportWorkoutPDF>[0]["student"],
      descricao: descricao || "PLANILHA DE TREINO",
      data,
      print: mode === "print",
      weeks: weeksCount,
      qrUrl: appUrl,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          className="max-w-sm font-heading font-semibold"
          placeholder="Descrição do treino"
          readOnly={readOnly}
        />
        <Button size="sm" variant="outline" onClick={() => setExportOpen("download")}>
          <FileDown className="w-3 h-3 mr-1" /> PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExportOpen("print")}>
          <Printer className="w-3 h-3 mr-1" /> Imprimir
        </Button>
        {!readOnly && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </div>

      {/* Aquecimento — separado por blocos LIB / MOB / ATI */}
      {data.aquecimento.length > 0 && (() => {
        const blocos: { key: string; label: string; items: { ex: WorkoutExercise; idx: number }[] }[] = [
          { key: "LIB", label: "LIBERAÇÃO", items: [] },
          { key: "MOB", label: "MOBILIDADE", items: [] },
          { key: "ATI", label: "ATIVAÇÃO", items: [] },
        ];
        data.aquecimento.forEach((ex, idx) => {
          const bloco = blocos.find(b => b.key === ex.categoria);
          if (bloco) bloco.items.push({ ex, idx });
        });
        return (
          <div className="glass-card rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-heading font-semibold text-primary">AQUECIMENTO</h4>
            {blocos.filter(b => b.items.length > 0).map(bloco => (
              <div key={bloco.key} className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary">
                    {bloco.key}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                    {bloco.label}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-1 px-2 w-8">#</th>
                        <th className="text-left py-1 px-2">Exercício</th>
                        <th className="text-center py-1 px-2 w-16">Rep.</th>
                        <th className="text-center py-1 px-2 w-24">Dias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bloco.items.map(({ ex, idx }, localIdx) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="py-1 px-2 text-muted-foreground">{localIdx + 1}</td>
                          <td className="py-1 px-2">
                            <div className="flex items-center gap-1">
                              <div className="flex-1 min-w-0">
                                <ExerciseSelector
                                  categoria={ex.categoria}
                                  value={ex.exercicio}
                                  onChange={(val, video) => pickExercise("aquecimento", 0, idx, val, video)}
                                  readOnly={readOnly}
                                />
                              </div>
                              {ex.video_url && (
                                <a
                                  href={ex.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary shrink-0"
                                  title="Ver vídeo do exercício"
                                >
                                  <Video className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-2 text-center">
                            <Input
                              value={ex.repeticoes}
                              onChange={e => updateExercise("aquecimento", 0, idx, "repeticoes", e.target.value)}
                              className="h-7 text-xs text-center bg-transparent border-none px-1 w-14 mx-auto"
                              readOnly={readOnly}
                            />
                          </td>
                          <td className="py-1 px-2 text-center text-muted-foreground text-[10px]">
                            {ex.dias?.join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Treinos — divididos em Bloco A (ex 1-2) e Bloco B (ex 3-5, renumerados 1-3) */}
      {data.treinos.map((treino, tIdx) => {
        const blocoA = treino.exercicios.slice(0, 2).map((ex, i) => ({ ex, idx: i, num: i + 1 }));
        const blocoB = treino.exercicios.slice(2, 5).map((ex, i) => ({ ex, idx: i + 2, num: i + 1 }));
        const renderBloco = (label: string, items: { ex: WorkoutExercise; idx: number; num: number }[]) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-accent-foreground">
                BLOCO {label}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 px-2 w-8">#</th>
                    <th className="text-left py-1 px-2 w-16">Cat.</th>
                    <th className="text-left py-1 px-2">Exercício</th>
                    <th className="text-center py-1 px-2 w-16">Séries</th>
                    <th className="text-center py-1 px-2 w-16">Rep.</th>
                    <th className="text-center py-1 px-2 w-16">KG</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ ex, idx, num }) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-1 px-2 text-muted-foreground">{num}</td>
                      <td className="py-1 px-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent/50 text-accent-foreground">
                          {ex.categoria}
                        </span>
                      </td>
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <ExerciseSelector
                              categoria={ex.categoria}
                              value={ex.exercicio}
                              onChange={(val, video) => pickExercise("treino", tIdx, idx, val, video)}
                              readOnly={readOnly}
                            />
                          </div>
                          {ex.video_url && (
                            <a
                              href={ex.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary shrink-0"
                              title="Ver vídeo do exercício"
                            >
                              <Video className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-1 px-2 text-center">{ex.series}</td>
                      <td className="py-1 px-2 text-center">
                        <Input
                          value={ex.repeticoes}
                          onChange={e => updateExercise("treino", tIdx, idx, "repeticoes", e.target.value)}
                          className="h-7 text-xs text-center bg-transparent border-none px-1 w-14 mx-auto"
                          readOnly={readOnly}
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <Input
                          value={ex.kg || ""}
                          onChange={e => updateExercise("treino", tIdx, idx, "kg", e.target.value)}
                          className="h-7 text-xs text-center bg-transparent border-none px-1 w-14 mx-auto"
                          placeholder="—"
                          readOnly={readOnly}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        return (
          <div key={tIdx} className="glass-card rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-heading font-semibold text-foreground">{treino.nome} — FORÇA</h4>
            {blocoA.length > 0 && renderBloco("A", blocoA)}
            {blocoB.length > 0 && renderBloco("B", blocoB)}
          </div>
        );
      })}

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
            <Button variant="outline" onClick={() => setExportOpen(null)}>
              Cancelar
            </Button>
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
    </div>
  );
}
