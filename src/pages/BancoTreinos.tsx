import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dumbbell, Library, ArrowLeft, Flame, ListChecks, Video, AlertTriangle } from "lucide-react";
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

const PHASE_GROUPS = [
  { label: "Fases", filter: (t: WorkoutTemplate) => /^Fase \d/.test(t.fase) },
  { label: "Métodos", filter: (t: WorkoutTemplate) => ["Personalizado", "Planilha 5RM", "5-3-1", "M102"].includes(t.fase) },
  { label: "Corrida", filter: (t: WorkoutTemplate) => t.fase.startsWith("Corrida") },
];

function findBankMatch(ex: WorkoutExercise, bank: BankExercise[]): BankExercise | null {
  // 1) If template has a name, try exact match by name (case-insensitive)
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

function ExerciseRow({
  ex,
  bank,
  showDays,
  onOpenVideo,
}: {
  ex: WorkoutExercise;
  bank: BankExercise[];
  showDays?: boolean;
  onOpenVideo: (b: BankExercise) => void;
}) {
  const match = findBankMatch(ex, bank);
  const candidatesCount = ex.exercicio ? 0 : getCandidatesForCode(ex.categoria, bank).length;
  const hasVideo = match && (match.video_url || match.video_path);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">{ex.ordem}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">{ex.categoria}</Badge>
      </TableCell>
      <TableCell className="text-sm">
        {ex.exercicio ? (
          <div className="flex items-center gap-2">
            <span>{ex.exercicio}</span>
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
          <span className="text-muted-foreground italic text-xs">
            {candidatesCount > 0
              ? `A definir — ${candidatesCount} opções no Banco`
              : "A definir"}
          </span>
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
}: {
  exercicios: WorkoutExercise[];
  bank: BankExercise[];
  showDays?: boolean;
  onOpenVideo: (b: BankExercise) => void;
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
          {exercicios.map((ex, i) => (
            <ExerciseRow key={i} ex={ex} bank={bank} showDays={showDays} onOpenVideo={onOpenVideo} />
          ))}
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
}: {
  template: WorkoutTemplate;
  bank: BankExercise[];
  onBack: () => void;
  onOpenVideo: (b: BankExercise) => void;
}) {
  const blocks = ["LIB", "MOB", "ATI"] as const;
  const blockLabels: Record<string, string> = { LIB: "Liberação", MOB: "Mobilidade", ATI: "Ativação" };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{template.fase}</h2>
          <p className="text-sm text-muted-foreground">Frequência: {template.frequencia}</p>
        </div>
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
                  <ExerciseTable exercicios={items} bank={bank} showDays onOpenVideo={onOpenVideo} />
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
                      <ExerciseTable exercicios={block1} bank={bank} onOpenVideo={onOpenVideo} />
                    </div>
                  )}
                  {block2.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bloco 2 (Acessórios)</h4>
                      <ExerciseTable exercicios={block2} bank={bank} onOpenVideo={onOpenVideo} />
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
        <TemplateDetail template={selected} bank={bank} onBack={() => setSelected(null)} onOpenVideo={handleOpenVideo} />
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
            Modelos base — exercícios vinculados ao Banco de Exercícios
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
