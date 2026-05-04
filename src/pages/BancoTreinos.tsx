import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Dumbbell, Library, ArrowLeft, Flame, ListChecks, Video, AlertTriangle, Search, X, Check, Sparkles, Trash2, Pencil } from "lucide-react";
import { WORKOUT_TEMPLATES, CATEGORY_LABELS, type WorkoutTemplate, type WorkoutExercise } from "@/components/student/workout/workoutTemplates";
import { CODE_TO_GRUPO, CODE_TO_SUBCATEGORIA, AQUECIMENTO_SUBCATEGORIAS, GRUPO_SUBCATEGORIAS } from "@/lib/exerciseMapping";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { toast } from "sonner";
import { PersonalizadoEditor } from "@/components/student/workout/PersonalizadoEditor";
import { emptyPersonalizado, type PersonalizadoConteudo } from "@/components/student/workout/personalizadoTypes";

interface GroupSelection { grupo: string; subcategoria: string }
interface BankExercise {
  id: string;
  nome: string;
  grupos: GroupSelection[];
  video_url: string | null;
  video_path: string | null;
}

interface Escolha {
  id: string;
  template_fase: string;
  treino_nome: string;
  ordem: number;
  exercicio_id: string | null;
  categoria_override: string | null;
  subcategoria_override: string | null;
  series_override: number | null;
  repeticoes_override: string | null;
  dias_override: string[] | null;
}

type OverridePatch = {
  categoria_override?: string | null;
  subcategoria_override?: string | null;
  series_override?: number | null;
  repeticoes_override?: string | null;
  dias_override?: string[] | null;
};

const DAY_OPTIONS = ["T1", "T2", "T3", "T4"] as const;

const PHASE_GROUPS = [
  { label: "Fases", filter: (t: WorkoutTemplate) => /^Fase \d/.test(t.fase) },
  { label: "Métodos", filter: (t: WorkoutTemplate) => ["Personalizado", "Personalizado 2", "Planilha 5RM", "5-3-1", "M102"].includes(t.fase) },
  { label: "Corrida", filter: (t: WorkoutTemplate) => t.fase.startsWith("Corrida") },
];

/** Estrutura inicial do "Personalizado 2": 4 Treinos × 2 Blocos (Principais/Acessórios). */
function emptyPersonalizado2(): PersonalizadoConteudo {
  return {
    aquecimento: { LIB: [], MOB: [], ATI: [] },
    treinos: [1, 2, 3, 4].map((n) => ({
      nome: `Treino ${n}`,
      blocos: [
        { nome: "Bloco 1 (Principais)", exercicios: [] },
        { nome: "Bloco 2 (Acessórios)", exercicios: [] },
      ],
    })),
    observacoes: "",
  };
}

function findBankMatch(ex: WorkoutExercise, bank: BankExercise[]): BankExercise | null {
  if (ex.exercicio?.trim()) {
    const nameLower = ex.exercicio.trim().toLowerCase();
    const exact = bank.find((b) => b.nome.trim().toLowerCase() === nameLower);
    if (exact) return exact;
  }
  return null;
}

function getCandidatesForCode(
  categoria: string,
  bank: BankExercise[],
  subOverride?: string,
): BankExercise[] {
  const grupo = CODE_TO_GRUPO[categoria.toUpperCase()];
  const sub = subOverride ?? CODE_TO_SUBCATEGORIA[categoria.toUpperCase()];
  if (!grupo) return [];
  return bank.filter((ex) =>
    ex.grupos.some((g) => g.grupo === grupo && (!sub || g.subcategoria === sub)),
  );
}

function ExercisePicker({
  categoria,
  bank,
  currentId,
  onSelect,
  onClear,
  canEdit,
  triggerLabel,
  subcategoriaOverride,
  onPreviewVideo,
}: {
  categoria: string;
  bank: BankExercise[];
  currentId?: string;
  onSelect: (ex: BankExercise) => void;
  onClear?: () => void;
  canEdit: boolean;
  triggerLabel: React.ReactNode;
  subcategoriaOverride?: string;
  onPreviewVideo?: (ex: BankExercise) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const candidates = useMemo(
    () => getCandidatesForCode(categoria, bank, subcategoriaOverride),
    [categoria, bank, subcategoriaOverride],
  );
  const filtered = useMemo(() => {
    if (!query) return candidates;
    const q = query.toLowerCase();
    return candidates.filter((c) => c.nome.toLowerCase().includes(q));
  }, [candidates, query]);

  // Quando não há subcategoria fixa, agrupar candidatos por subcategoria
  // (do grupo alvo) para facilitar a navegação visual.
  const grupoAlvo = CODE_TO_GRUPO[categoria.toUpperCase()] || categoria;
  const shouldGroup = !subcategoriaOverride;
  const grouped = useMemo(() => {
    if (!shouldGroup) return null;
    const map = new Map<string, BankExercise[]>();
    for (const ex of filtered) {
      const sub = ex.grupos.find((g) => g.grupo === grupoAlvo)?.subcategoria || "—";
      const arr = map.get(sub) || [];
      arr.push(ex);
      map.set(sub, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sub, items]) => [sub, items.sort((x, y) => x.nome.localeCompare(y.nome))] as const);
  }, [filtered, shouldGroup, grupoAlvo]);

  if (!canEdit) {
    return <>{triggerLabel}</>;
  }

  const renderItem = (ex: BankExercise) => {
    const hasVideo = !!(ex.video_url || ex.video_path);
    const isSelected = ex.id === currentId;
    return (
      <div
        key={ex.id}
        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
      >
        <button
          onClick={() => { onSelect(ex); setOpen(false); }}
          className="flex-1 flex items-start gap-2 px-2 py-2 text-sm text-left min-w-0"
        >
          {isSelected && <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />}
          <span className="break-words leading-snug">{ex.nome}</span>
        </button>
        {hasVideo && onPreviewVideo && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPreviewVideo(ex); }}
            className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/10"
            aria-label="Ver demonstração"
            title="Ver demonstração antes de escolher"
          >
            <Video className="w-4 h-4" />
            Demo
          </button>
        )}
        {hasVideo && !onPreviewVideo && (
          <Video className="w-3 h-3 text-primary shrink-0 mr-2" />
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-left hover:underline decoration-dotted underline-offset-2">
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-[1200px] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">Selecionar exercício</DialogTitle>
        </DialogHeader>
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar em ${subcategoriaOverride || CODE_TO_SUBCATEGORIA[categoria.toUpperCase()] || CODE_TO_GRUPO[categoria.toUpperCase()] || categoria}...`}
              className="h-10 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-sm text-muted-foreground text-center">
              {candidates.length === 0
                ? "Nenhum exercício cadastrado nesta categoria."
                : `Nenhum resultado para "${query}".`}
            </div>
          ) : grouped ? (
            grouped.map(([sub, items]) => (
              <div key={sub}>
                <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b border-border font-semibold">
                  {sub} · {items.length}
                </div>
                {items.map(renderItem)}
              </div>
            ))
          ) : (
            filtered.map(renderItem)
          )}
        </div>
        {currentId && onClear && (
          <div className="border-t border-border p-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-9 text-sm text-destructive hover:text-destructive"
              onClick={() => { onClear(); setOpen(false); }}
            >
              <X className="w-3 h-3 mr-1" /> Remover escolha
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExerciseRow({
  ex,
  bank,
  showDays,
  onOpenVideo,
  templateFase,
  treinoNome,
  escolha,
  onSaveChoice,
  onClearChoice,
  onSaveOverride,
  canEdit,
  aquecimentoBloco,
}: {
  ex: WorkoutExercise;
  bank: BankExercise[];
  showDays?: boolean;
  onOpenVideo: (b: BankExercise) => void;
  templateFase: string;
  treinoNome: string;
  escolha?: Escolha;
  onSaveChoice: (ex: BankExercise) => void;
  onClearChoice: () => void;
  onSaveOverride: (patch: OverridePatch) => void;
  canEdit: boolean;
  aquecimentoBloco?: "LIB" | "MOB" | "ATI";
}) {
  // (valores efetivos declarados abaixo, junto com a lógica de subcategoria)

  // Para aquecimento (LIB/MOB/ATI), o select "Categoria" carrega a subcategoria
  // (o grupo é fixo pelo bloco). Default = ex.subcategoria do template, e o
  // override é gravado em `categoria_override` (legado).
  // Para linhas de força/principais, agora também temos um seletor de subcategoria
  // dedicado, gravado em `subcategoria_override`. Default = subcategoria derivada
  // do código (CODE_TO_SUBCATEGORIA) ou ex.subcategoria do template.
  const defaultSubcategoria = ex.subcategoria;
  const effSubcategoriaAquec = aquecimentoBloco
    ? (escolha?.categoria_override ?? defaultSubcategoria ?? "")
    : undefined;

  const effCategoria = escolha?.categoria_override ?? ex.categoria;
  const effSeries = escolha?.series_override ?? ex.series;
  const effReps = escolha?.repeticoes_override ?? ex.repeticoes;
  const effDias = escolha?.dias_override ?? ex.dias ?? [];

  // Para força/principais: subcategoria efetiva (override > derivada do código > template)
  const grupoForca = !aquecimentoBloco ? CODE_TO_GRUPO[effCategoria.toUpperCase()] : undefined;
  const subcategoriasGrupo = grupoForca ? GRUPO_SUBCATEGORIAS[grupoForca] || [] : [];
  const defaultSubForca = !aquecimentoBloco
    ? (CODE_TO_SUBCATEGORIA[effCategoria.toUpperCase()] ?? defaultSubcategoria ?? "")
    : "";
  const effSubcategoriaForca = !aquecimentoBloco
    ? (escolha?.subcategoria_override ?? defaultSubForca)
    : "";

  // Subcategoria efetiva passada ao picker (filtro) — válida para ambos os casos.
  const effSubcategoria = aquecimentoBloco ? effSubcategoriaAquec : effSubcategoriaForca;

  // Local state for text inputs (commit on blur / Enter)
  const [seriesInput, setSeriesInput] = useState(String(effSeries ?? ""));
  const [repsInput, setRepsInput] = useState(String(effReps ?? ""));
  useEffect(() => { setSeriesInput(String(effSeries ?? "")); }, [effSeries]);
  useEffect(() => { setRepsInput(String(effReps ?? "")); }, [effReps]);

  const escolhaEx = escolha?.exercicio_id ? bank.find((b) => b.id === escolha.exercicio_id) : null;
  const match = escolhaEx || findBankMatch(ex, bank);
  const candidatesCount = getCandidatesForCode(
    aquecimentoBloco ?? effCategoria,
    bank,
    effSubcategoria || undefined,
  ).length;
  const hasVideo = match && (match.video_url || match.video_path);
  const isSlotVazio = !ex.exercicio && !escolhaEx;


  const commitSeries = () => {
    const trimmed = seriesInput.trim();
    const num = trimmed === "" ? null : Number(trimmed);
    if (num !== null && (Number.isNaN(num) || num < 0)) {
      setSeriesInput(String(effSeries ?? ""));
      return;
    }
    const newVal = num;
    const oldVal = escolha?.series_override ?? Number(ex.series);
    if (newVal === oldVal || (newVal === Number(ex.series) && escolha?.series_override == null)) return;
    onSaveOverride({ series_override: newVal });
  };

  const commitReps = () => {
    const trimmed = repsInput.trim();
    const newVal = trimmed === "" ? null : trimmed;
    const oldVal = escolha?.repeticoes_override ?? String(ex.repeticoes ?? "");
    if (newVal === oldVal || (newVal === String(ex.repeticoes ?? "") && escolha?.repeticoes_override == null)) return;
    onSaveOverride({ repeticoes_override: newVal });
  };

  const toggleDia = (dia: string) => {
    const current = effDias;
    const next = current.includes(dia) ? current.filter((d) => d !== dia) : [...current, dia];
    next.sort();
    onSaveOverride({ dias_override: next });
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">{ex.ordem}</TableCell>
      <TableCell>
        {aquecimentoBloco ? (
          canEdit ? (
            <select
              value={effSubcategoria || ""}
              onChange={(e) => {
                const v = e.target.value;
                onSaveOverride({
                  categoria_override: !v || v === (defaultSubcategoria ?? "") ? null : v,
                });
              }}
              className="bg-background border border-input rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring max-w-[180px]"
            >
              {!effSubcategoria && <option value="">Selecione...</option>}
              {AQUECIMENTO_SUBCATEGORIAS[aquecimentoBloco].map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          ) : (
            <Badge variant="outline" className="text-xs">
              {effSubcategoria || "—"}
            </Badge>
          )
        ) : canEdit ? (
          <div className="flex flex-col gap-1">
            <select
              value={effCategoria}
              onChange={(e) => {
                const v = e.target.value;
                // Ao trocar o código, limpa override de subcategoria para reusar o default do novo grupo.
                onSaveOverride({
                  categoria_override: v === ex.categoria ? null : v,
                  subcategoria_override: null,
                });
              }}
              className="bg-background border border-input rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.keys(CATEGORY_LABELS).map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            {subcategoriasGrupo.length > 0 && (
              <select
                value={effSubcategoriaForca || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onSaveOverride({
                    subcategoria_override: !v || v === defaultSubForca ? null : v,
                  });
                }}
                title={`Subcategoria (${grupoForca})`}
                className="bg-background border border-input rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring max-w-[180px]"
              >
                <option value="">— qualquer —</option>
                {subcategoriasGrupo.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className="text-xs w-fit">{effCategoria}</Badge>
            {effSubcategoriaForca && (
              <span className="text-[10px] text-muted-foreground">{effSubcategoriaForca}</span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {!isSlotVazio ? (
          <div className="flex items-center gap-2 flex-wrap">
            <ExercisePicker
              categoria={aquecimentoBloco ?? effCategoria}
              subcategoriaOverride={effSubcategoria || undefined}
              bank={bank}
              currentId={escolhaEx?.id}
              canEdit={canEdit && candidatesCount > 0}
              onSelect={(b) => onSaveChoice(b)}
              onClear={escolhaEx ? onClearChoice : undefined}
              onPreviewVideo={(b) => onOpenVideo(b)}
              triggerLabel={<span>{match?.nome || ex.exercicio}</span>}
            />
            {escolhaEx && (
              <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                escolhido
              </Badge>
            )}
            {match ? (
              hasVideo ? (
                <button
                  onClick={() => onOpenVideo(match)}
                  className="text-primary hover:text-primary/80"
                  aria-label="Ver vídeo"
                >
                  <Video className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Badge variant="outline" className="text-[10px] border-warning/40 text-warning gap-1">
                  <AlertTriangle className="w-3 h-3" /> sem vídeo
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                não cadastrado
              </Badge>
            )}
          </div>
        ) : (
          <ExercisePicker
            categoria={aquecimentoBloco ?? effCategoria}
            subcategoriaOverride={effSubcategoria || undefined}
            bank={bank}
            canEdit={canEdit && candidatesCount > 0}
            onSelect={(b) => onSaveChoice(b)}
            onPreviewVideo={(b) => onOpenVideo(b)}
            triggerLabel={
              <span className="text-muted-foreground italic text-xs">
                {candidatesCount > 0
                  ? `A definir — ${candidatesCount} opções no Banco`
                  : aquecimentoBloco && !effSubcategoria
                    ? "Escolha uma subcategoria"
                    : "A definir"}
              </span>
            }
          />
        )}
      </TableCell>
      <TableCell className="text-center text-sm">
        {canEdit ? (
          <Input
            value={seriesInput}
            onChange={(e) => setSeriesInput(e.target.value)}
            onBlur={commitSeries}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            inputMode="numeric"
            className="h-7 w-14 mx-auto text-center text-xs px-1"
          />
        ) : (
          effSeries
        )}
      </TableCell>
      <TableCell className="text-center text-sm">
        {canEdit ? (
          <Input
            value={repsInput}
            onChange={(e) => setRepsInput(e.target.value)}
            onBlur={commitReps}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="h-7 w-20 mx-auto text-center text-xs px-1"
          />
        ) : (
          effReps
        )}
      </TableCell>
      {showDays && (
        <TableCell className="text-center">
          <div className="flex gap-1 justify-center flex-wrap">
            {DAY_OPTIONS.map((d) => {
              const active = effDias.includes(d);
              if (!canEdit) {
                return active ? (
                  <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">{d}</Badge>
                ) : null;
              }
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDia(d)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    active
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-transparent border-border text-muted-foreground hover:bg-accent/40"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}



function ExerciseTable({
  exercicios,
  bank,
  showDays,
  onOpenVideo,
  templateFase,
  treinoNome,
  escolhasMap,
  onSaveChoice,
  onClearChoice,
  onSaveOverride,
  canEdit,
  aquecimentoBloco,
}: {
  exercicios: WorkoutExercise[];
  bank: BankExercise[];
  showDays?: boolean;
  onOpenVideo: (b: BankExercise) => void;
  templateFase: string;
  treinoNome: string;
  escolhasMap: Map<string, Escolha>;
  onSaveChoice: (ex: WorkoutExercise, treino: string, b: BankExercise) => void;
  onClearChoice: (ex: WorkoutExercise, treino: string) => void;
  onSaveOverride: (ex: WorkoutExercise, treino: string, patch: OverridePatch) => void;
  canEdit: boolean;
  aquecimentoBloco?: "LIB" | "MOB" | "ATI";
}) {
  if (exercicios.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Sem exercícios cadastrados.</p>;
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead className="w-24">Categoria</TableHead>
            <TableHead>Exercício</TableHead>
            <TableHead className="w-20 text-center">Séries</TableHead>
            <TableHead className="w-24 text-center">Reps</TableHead>
            {showDays && <TableHead className="w-36 text-center">Dias</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {exercicios.map((ex, i) => {
            const key = `${templateFase}|${treinoNome}|${ex.ordem}`;
            return (
              <ExerciseRow
                key={i}
                ex={ex}
                bank={bank}
                showDays={showDays}
                onOpenVideo={onOpenVideo}
                templateFase={templateFase}
                treinoNome={treinoNome}
                escolha={escolhasMap.get(key)}
                onSaveChoice={(b) => onSaveChoice(ex, treinoNome, b)}
                onClearChoice={() => onClearChoice(ex, treinoNome)}
                onSaveOverride={(patch) => onSaveOverride(ex, treinoNome, patch)}
                canEdit={canEdit}
                aquecimentoBloco={aquecimentoBloco}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TemplateDetail({
  template,
  bank,
  onBack,
  onOpenVideo,
  escolhasMap,
  onSaveChoice,
  onClearChoice,
  onSaveOverride,
  canEdit,
}: {
  template: WorkoutTemplate;
  bank: BankExercise[];
  onBack: () => void;
  onOpenVideo: (b: BankExercise) => void;
  escolhasMap: Map<string, Escolha>;
  onSaveChoice: (ex: WorkoutExercise, treino: string, b: BankExercise) => void;
  onClearChoice: (ex: WorkoutExercise, treino: string) => void;
  onSaveOverride: (ex: WorkoutExercise, treino: string, patch: OverridePatch) => void;
  canEdit: boolean;
}) {
  const blocks = ["LIB", "MOB", "ATI"] as const;
  const blockLabels: Record<string, string> = { LIB: "Liberação", MOB: "Mobilidade", ATI: "Ativação" };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{template.fase}</h2>
          <p className="text-sm text-muted-foreground">Frequência: {template.frequencia}</p>
        </div>
        {!canEdit && (
          <Badge variant="outline" className="text-xs">Somente leitura</Badge>
        )}
      </div>

      {template.aquecimento.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-warning" /> Aquecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocks.map(block => {
              const items = template.aquecimento.filter(e => e.categoria === block);
              if (items.length === 0) return null;
              return (
                <div key={block} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {blockLabels[block]} ({block})
                  </h4>
                  <ExerciseTable
                    exercicios={items}
                    bank={bank}
                    showDays
                    onOpenVideo={onOpenVideo}
                    templateFase={template.fase}
                    treinoNome="__aquecimento__"
                    escolhasMap={escolhasMap}
                    onSaveChoice={onSaveChoice}
                    onClearChoice={onClearChoice}
                        onSaveOverride={onSaveOverride}
                    canEdit={canEdit}
                    aquecimentoBloco={block}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks className="h-5 w-5 text-primary" /> Treinos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={template.treinos[0]?.nome}>
            <TabsList className="flex-wrap h-auto">
              {template.treinos.map(t => (
                <TabsTrigger key={t.nome} value={t.nome}>{t.nome}</TabsTrigger>
              ))}
            </TabsList>
            {template.treinos.map(t => {
              const block1 = t.exercicios.filter(e => e.ordem <= 2);
              const block2 = t.exercicios.filter(e => e.ordem >= 3);
              return (
                <TabsContent key={t.nome} value={t.nome} className="space-y-4 mt-4">
                  {block1.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bloco 1 (Principais)</h4>
                      <ExerciseTable
                        exercicios={block1}
                        bank={bank}
                        onOpenVideo={onOpenVideo}
                        templateFase={template.fase}
                        treinoNome={t.nome}
                        escolhasMap={escolhasMap}
                        onSaveChoice={onSaveChoice}
                        onClearChoice={onClearChoice}
                        onSaveOverride={onSaveOverride}
                        canEdit={canEdit}
                      />
                    </div>
                  )}
                  {block2.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bloco 2 (Acessórios)</h4>
                      <ExerciseTable
                        exercicios={block2}
                        bank={bank}
                        onOpenVideo={onOpenVideo}
                        templateFase={template.fase}
                        treinoNome={t.nome}
                        escolhasMap={escolhasMap}
                        onSaveChoice={onSaveChoice}
                        onClearChoice={onClearChoice}
                        onSaveOverride={onSaveOverride}
                        canEdit={canEdit}
                      />
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legenda de Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{key}</Badge>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BancoTreinos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.role);
    },
    staleTime: 5 * 60_000,
  });
  const canEdit = userRoles.includes("admin") || userRoles.includes("coordenador");

  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ nome: string; src: string; kind: "youtube" | "file" } | null>(null);
  const [personalizadoOpen, setPersonalizadoOpen] = useState<
    | null
    | { mode: "new"; variante?: "personalizado" | "personalizado2" }
    | { mode: "edit"; id: string; nome: string; conteudo: PersonalizadoConteudo }
  >(null);

  const { data: modelosPersonalizados = [], refetch: refetchModelos } = useQuery({
    queryKey: ["banco-treinos-personalizados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_treinos_personalizados")
        .select("id, nome, conteudo, criado_por, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const handleDeleteModelo = async (id: string) => {
    if (!confirm("Excluir este modelo personalizado?")) return;
    const { error } = await supabase.from("banco_treinos_personalizados").delete().eq("id", id);
    if (error) {
      toast.error("Falha ao excluir: " + error.message);
      return;
    }
    toast.success("Modelo excluído");
    refetchModelos();
  };


  const { data: bank = [] } = useQuery({
    queryKey: ["exercicios-bank-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercicios_personalizados")
        .select("id, nome, grupos, video_url, video_path")
        .order("nome");
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        grupos: (r.grupos as unknown as GroupSelection[]) || [],
        video_url: r.video_url,
        video_path: r.video_path,
      })) as BankExercise[];
    },
    staleTime: 60_000,
  });

  const { data: escolhas = [] } = useQuery({
    queryKey: ["banco-treinos-escolhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_treinos_escolhas")
        .select("id, template_fase, treino_nome, ordem, exercicio_id, categoria_override, subcategoria_override, series_override, repeticoes_override, dias_override");
      if (error) throw error;
      return (data || []) as Escolha[];
    },
    staleTime: 60_000,
  });

  const escolhasMap = useMemo(() => {
    const m = new Map<string, Escolha>();
    escolhas.forEach((e) => m.set(`${e.template_fase}|${e.treino_nome}|${e.ordem}`, e));
    return m;
  }, [escolhas]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      template_fase: string;
      treino_nome: string;
      ordem: number;
      categoria: string;
      exercicio_id: string;
    }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("banco_treinos_escolhas")
        .upsert(
          { ...payload, escolhido_por: user.id },
          { onConflict: "template_fase,treino_nome,ordem" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banco-treinos-escolhas"] });
      toast.success("Escolha salva no template");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao salvar"),
  });

  const clearMutation = useMutation({
    mutationFn: async (payload: { template_fase: string; treino_nome: string; ordem: number }) => {
      const { error } = await supabase
        .from("banco_treinos_escolhas")
        .delete()
        .match(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banco-treinos-escolhas"] });
      toast.success("Escolha removida");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao remover"),
  });

  const overrideMutation = useMutation({
    mutationFn: async (payload: {
      template_fase: string;
      treino_nome: string;
      ordem: number;
      categoria: string;
      patch: OverridePatch;
    }) => {
      if (!user) throw new Error("Não autenticado");
      const { template_fase, treino_nome, ordem, categoria, patch } = payload;
      const { error } = await supabase
        .from("banco_treinos_escolhas")
        .upsert(
          {
            template_fase,
            treino_nome,
            ordem,
            categoria,
            escolhido_por: user.id,
            ...patch,
          },
          { onConflict: "template_fase,treino_nome,ordem" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banco-treinos-escolhas"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao salvar alteração"),
  });

  const handleSaveChoice = (template: WorkoutTemplate, ex: WorkoutExercise, treino: string, b: BankExercise) => {
    saveMutation.mutate({
      template_fase: template.fase,
      treino_nome: treino,
      ordem: ex.ordem,
      categoria: ex.categoria,
      exercicio_id: b.id,
    });
  };

  const handleClearChoice = (template: WorkoutTemplate, ex: WorkoutExercise, treino: string) => {
    clearMutation.mutate({
      template_fase: template.fase,
      treino_nome: treino,
      ordem: ex.ordem,
    });
  };

  const handleSaveOverride = (template: WorkoutTemplate, ex: WorkoutExercise, treino: string, patch: OverridePatch) => {
    overrideMutation.mutate({
      template_fase: template.fase,
      treino_nome: treino,
      ordem: ex.ordem,
      categoria: ex.categoria,
      patch,
    });
  };


  const handleOpenVideo = async (ex: BankExercise) => {
    if (ex.video_url) {
      const embed = getYouTubeEmbedUrl(ex.video_url);
      if (embed) {
        setVideoPreview({ nome: ex.nome, src: embed, kind: "youtube" });
      } else {
        window.open(ex.video_url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (ex.video_path) {
      const { data, error } = await supabase.storage
        .from("exercicios-videos")
        .createSignedUrl(ex.video_path, 60 * 60);
      if (error || !data) {
        toast.error("Falha ao carregar vídeo");
        return;
      }
      setVideoPreview({ nome: ex.nome, src: data.signedUrl, kind: "file" });
    }
  };

  const renderVideoModal = () => (
    <Dialog open={!!videoPreview} onOpenChange={(o) => !o && setVideoPreview(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-[1400px] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] p-0 gap-0 overflow-hidden flex flex-col bg-black">
        <DialogHeader className="px-4 py-3 border-b border-border/40 bg-background shrink-0">
          <DialogTitle className="text-base pr-8 truncate">{videoPreview?.nome}</DialogTitle>
        </DialogHeader>
        {videoPreview && (
          <div className="flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
            {videoPreview.kind === "youtube" ? (
              <iframe
                src={`${videoPreview.src}${videoPreview.src.includes("?") ? "&" : "?"}autoplay=1&rel=0`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                title={videoPreview.nome}
              />
            ) : (
              <video
                src={videoPreview.src}
                controls
                autoPlay
                controlsList="nodownload"
                className="w-full h-full object-contain bg-black"
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (personalizadoOpen) {
    const isP2 = personalizadoOpen.mode === "new" && personalizadoOpen.variante === "personalizado2";
    const initialData =
      personalizadoOpen.mode === "edit"
        ? personalizadoOpen.conteudo
        : isP2
          ? emptyPersonalizado2()
          : emptyPersonalizado();
    const initialName =
      personalizadoOpen.mode === "edit"
        ? personalizadoOpen.nome
        : isP2
          ? "Modelo Personalizado 2"
          : "Modelo Personalizado";
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <PersonalizadoEditor
          initial={initialData}
          initialName={initialName}
          modeloId={personalizadoOpen.mode === "edit" ? personalizadoOpen.id : undefined}
          onBack={() => setPersonalizadoOpen(null)}
          onSaved={() => { refetchModelos(); }}
        />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <TemplateDetail
          template={selected}
          bank={bank}
          onBack={() => setSelected(null)}
          onOpenVideo={handleOpenVideo}
          escolhasMap={escolhasMap}
          onSaveChoice={(ex, treino, b) => handleSaveChoice(selected, ex, treino, b)}
          onClearChoice={(ex, treino) => handleClearChoice(selected, ex, treino)}
          onSaveOverride={(ex, treino, patch) => handleSaveOverride(selected, ex, treino, patch)}
          canEdit={canEdit}
        />
        {renderVideoModal()}
      </div>
    );
  }


  return (
    <div className="container mx-auto p-6 max-w-6xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Library className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Banco de Treinos</h1>
          <p className="text-sm text-muted-foreground">
            Modelos base — clique em um exercício para escolher do Banco de Exercícios
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {PHASE_GROUPS.map(group => {
          const items = WORKOUT_TEMPLATES.filter(group.filter);
          if (items.length === 0) return null;
          return (
            <section key={group.label}>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                {group.label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(template => (
                  <Card
                    key={template.fase}
                    className="cursor-pointer hover:border-primary transition-colors group"
                    onClick={() => {
                      if (template.fase === "Personalizado") {
                        setPersonalizadoOpen({ mode: "new" });
                      } else {
                        setSelected(template);
                      }
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          {template.fase === "Personalizado"
                            ? <Sparkles className="h-5 w-5 text-primary" />
                            : <Dumbbell className="h-5 w-5 text-primary" />}
                        </div>
                        <Badge variant="outline">{template.frequencia}</Badge>
                      </div>
                      <CardTitle className="text-lg mt-3">{template.fase}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{template.treinos.length} treinos</span>
                        <span>
                          {template.treinos.reduce((acc, t) => acc + t.exercicios.length, 0)} exercícios
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}

        {modelosPersonalizados.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Meus modelos personalizados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelosPersonalizados.map((m) => {
                const conteudo = (m.conteudo as unknown) as PersonalizadoConteudo;
                const isOwner = m.criado_por === user?.id;
                return (
                  <Card key={m.id} className="hover:border-primary transition-colors group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-1">
                          {(isOwner || canEdit) && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setPersonalizadoOpen({ mode: "edit", id: m.id, nome: m.nome, conteudo })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDeleteModelo(m.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg mt-3 cursor-pointer" onClick={() => setPersonalizadoOpen({ mode: "edit", id: m.id, nome: m.nome, conteudo })}>
                        {m.nome}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        {conteudo?.treinos?.length || 0} treinos · atualizado {new Date(m.updated_at).toLocaleDateString("pt-BR")}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {renderVideoModal()}
    </div>
  );
}
