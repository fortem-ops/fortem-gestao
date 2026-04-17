import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Dumbbell, Library, ArrowLeft, Flame, ListChecks, Video, AlertTriangle, Search, X, Check } from "lucide-react";
import { WORKOUT_TEMPLATES, CATEGORY_LABELS, type WorkoutTemplate, type WorkoutExercise } from "@/components/student/workout/workoutTemplates";
import { CODE_TO_GRUPO, CODE_TO_SUBCATEGORIA } from "@/lib/exerciseMapping";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { toast } from "sonner";

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
  exercicio_id: string;
}

const PHASE_GROUPS = [
  { label: "Fases", filter: (t: WorkoutTemplate) => /^Fase \d/.test(t.fase) },
  { label: "Métodos", filter: (t: WorkoutTemplate) => ["Personalizado", "Planilha 5RM", "5-3-1", "M102"].includes(t.fase) },
  { label: "Corrida", filter: (t: WorkoutTemplate) => t.fase.startsWith("Corrida") },
];

function findBankMatch(ex: WorkoutExercise, bank: BankExercise[]): BankExercise | null {
  if (ex.exercicio?.trim()) {
    const nameLower = ex.exercicio.trim().toLowerCase();
    const exact = bank.find((b) => b.nome.trim().toLowerCase() === nameLower);
    if (exact) return exact;
  }
  return null;
}

function getCandidatesForCode(categoria: string, bank: BankExercise[]): BankExercise[] {
  const grupo = CODE_TO_GRUPO[categoria.toUpperCase()];
  const sub = CODE_TO_SUBCATEGORIA[categoria.toUpperCase()];
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
}: {
  categoria: string;
  bank: BankExercise[];
  currentId?: string;
  onSelect: (ex: BankExercise) => void;
  onClear?: () => void;
  canEdit: boolean;
  triggerLabel: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const candidates = useMemo(() => getCandidatesForCode(categoria, bank), [categoria, bank]);
  const filtered = useMemo(() => {
    if (!query) return candidates;
    const q = query.toLowerCase();
    return candidates.filter((c) => c.nome.toLowerCase().includes(q));
  }, [candidates, query]);

  if (!canEdit) {
    return <>{triggerLabel}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-left hover:underline decoration-dotted underline-offset-2">
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar em ${CODE_TO_SUBCATEGORIA[categoria.toUpperCase()] || CODE_TO_GRUPO[categoria.toUpperCase()] || categoria}...`}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {candidates.length === 0
                ? "Nenhum exercício cadastrado nesta categoria."
                : `Nenhum resultado para "${query}".`}
            </div>
          ) : (
            filtered.map((ex) => {
              const hasVideo = !!(ex.video_url || ex.video_path);
              const isSelected = ex.id === currentId;
              return (
                <button
                  key={ex.id}
                  onClick={() => { onSelect(ex); setOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="flex items-center gap-1.5 flex-1 truncate">
                    {isSelected && <Check className="w-3 h-3 text-success shrink-0" />}
                    <span className="truncate">{ex.nome}</span>
                  </span>
                  {hasVideo && <Video className="w-3 h-3 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        {currentId && onClear && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => { onClear(); setOpen(false); }}
            >
              <X className="w-3 h-3 mr-1" /> Remover escolha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
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
  canEdit,
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
  canEdit: boolean;
}) {
  // Resolve effective exercise: 1) saved choice, 2) name match in template
  const escolhaEx = escolha ? bank.find((b) => b.id === escolha.exercicio_id) : null;
  const match = escolhaEx || findBankMatch(ex, bank);
  const candidatesCount = getCandidatesForCode(ex.categoria, bank).length;
  const hasVideo = match && (match.video_url || match.video_path);
  const isSlotVazio = !ex.exercicio && !escolhaEx;

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">{ex.ordem}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">{ex.categoria}</Badge>
      </TableCell>
      <TableCell className="text-sm">
        {!isSlotVazio ? (
          <div className="flex items-center gap-2 flex-wrap">
            <ExercisePicker
              categoria={ex.categoria}
              bank={bank}
              currentId={escolhaEx?.id}
              canEdit={canEdit && !!match}
              onSelect={(b) => onSaveChoice(b)}
              onClear={escolha ? onClearChoice : undefined}
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
            categoria={ex.categoria}
            bank={bank}
            canEdit={canEdit && candidatesCount > 0}
            onSelect={(b) => onSaveChoice(b)}
            triggerLabel={
              <span className="text-muted-foreground italic text-xs">
                {candidatesCount > 0
                  ? `A definir — ${candidatesCount} opções no Banco`
                  : "A definir"}
              </span>
            }
          />
        )}
      </TableCell>
      <TableCell className="text-center text-sm">{ex.series}</TableCell>
      <TableCell className="text-center text-sm">{ex.repeticoes}</TableCell>
      {showDays && (
        <TableCell className="text-center">
          <div className="flex gap-1 justify-center flex-wrap">
            {(ex.dias || []).map(d => (
              <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">{d}</Badge>
            ))}
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
  canEdit,
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
  canEdit: boolean;
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
            {showDays && <TableHead className="w-32 text-center">Dias</TableHead>}
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
                canEdit={canEdit}
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
  canEdit,
}: {
  template: WorkoutTemplate;
  bank: BankExercise[];
  onBack: () => void;
  onOpenVideo: (b: BankExercise) => void;
  escolhasMap: Map<string, Escolha>;
  onSaveChoice: (ex: WorkoutExercise, treino: string, b: BankExercise) => void;
  onClearChoice: (ex: WorkoutExercise, treino: string) => void;
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
                    canEdit={canEdit}
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
        .select("id, template_fase, treino_nome, ordem, exercicio_id");
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{videoPreview?.nome}</DialogTitle>
        </DialogHeader>
        {videoPreview && (
          <div className="aspect-video w-full rounded-md overflow-hidden bg-black">
            {videoPreview.kind === "youtube" ? (
              <iframe
                src={videoPreview.src}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoPreview.nome}
              />
            ) : (
              <video src={videoPreview.src} controls className="w-full h-full" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

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
                    onClick={() => setSelected(template)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Dumbbell className="h-5 w-5 text-primary" />
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
      </div>

      {renderVideoModal()}
    </div>
  );
}
