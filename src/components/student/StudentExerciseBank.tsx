import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft, Dumbbell, Plus, Loader2, Trash2, Search, Video, Upload, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

interface Category {
  name: string;
  subcategories: string[];
}

const CATEGORIES: Category[] = [
  {
    name: "Liberação Miofascial",
    subcategories: [
      "Pé/Tornozelo", "Perna", "Joelho/Coxa", "Quadril",
      "Lombar", "Torácica", "Ombro/Escápula", "Cervical", "Cotovelo/Punho",
    ],
  },
  {
    name: "Mobilidade Articular",
    subcategories: [
      "Pé/Tornozelo", "Joelho", "Quadril", "Quadril RE", "Quadril RI",
      "Flexibilidade Posterior MI", "Flexibilidade Anterior MI",
      "Torácica", "Torácica Rotação", "Glenoumeral", "Glenoumeral RE",
      "Glenoumeral RI", "Cotovelo/Punho", "Padrão Geral",
    ],
  },
  {
    name: "Ativação Muscular",
    subcategories: [
      "Pé/Tornozelo", "Perna", "Estabilidade de Joelho", "Quadril",
      "Estabilidade Lombar PA", "Estabilidade Lombar PP", "Torácica",
      "Ombro/Escápula", "Cotovelo/Punho", "Padrão Geral",
      "Estabilidade Escapular", "Desassociação Lombar/Quadril",
      "Extensão Torácica", "Kettlebell", "Barra", "LPO",
      "Pliométrico", "Coordenativo Corrida", "Solo",
    ],
  },
  {
    name: "Preventivo",
    subcategories: [
      "Tornozelo", "Joelho", "Quadril-Glúteos", "Quadril-Isquios",
      "Quadril-Flexores", "Cotovelo", "Ombro",
    ],
  },
  {
    name: "Força",
    subcategories: [
      "Anti-Rotação", "Rotação", "Anti-Hiperextensão", "Anti-flexão",
      "Estabilidade Posterior", "Dominante de Joelho Simétrico",
      "Dominante de Joelhos Assimétrico", "Dominante de Quadril",
      "Dominante de Quadril Posterior", "Empurrar Horizontal",
      "Empurrar Vertical", "Puxar Horizontal", "Puxar Vertical",
      "Auxiliares", "Estabilidade Escapular", "Extensão Torácica",
      "Plioetria", "Abdominais", "Kettlebell", "Isoiniercial",
      "LPO", "Coordenativo Corrida",
    ],
  },
  {
    name: "Cardio",
    subcategories: ["Cardio"],
  },
];

interface GroupSelection {
  grupo: string;
  subcategoria: string;
}

interface ExercicioRow {
  id: string;
  nome: string;
  grupos: GroupSelection[];
  video_url: string | null;
  video_path: string | null;
}

const exerciseSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120, "Máx. 120 caracteres"),
  grupos: z.array(z.object({
    grupo: z.string().min(1),
    subcategoria: z.string().min(1),
  })).min(1, "Selecione pelo menos um grupo e subcategoria"),
  video_url: z.string().trim().url("URL inválida").max(500).optional().or(z.literal("")),
});

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export function StudentExerciseBank() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGrupo, setFilterGrupo] = useState<string>("");
  const [filterSub, setFilterSub] = useState<string>("");
  const [videoPreview, setVideoPreview] = useState<{ nome: string; src: string } | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const resetForm = () => {
    setNome("");
    setSelecoes({});
    setVideoUrl("");
    setVideoFile(null);
  };

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["isCoordAdmin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const { data: exercicios = [] } = useQuery({
    queryKey: ["exercicios-personalizados"],
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
      })) as ExercicioRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      nome: string;
      grupos: GroupSelection[];
      video_url: string | null;
      video_file: File | null;
    }) => {
      if (!user) throw new Error("Não autenticado");
      let video_path: string | null = null;
      if (payload.video_file) {
        const ext = payload.video_file.name.split(".").pop() || "mp4";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("exercicios-videos")
          .upload(path, payload.video_file, { contentType: payload.video_file.type });
        if (upErr) throw upErr;
        video_path = path;
      }
      const { error } = await supabase.from("exercicios_personalizados").insert({
        nome: payload.nome,
        grupos: payload.grupos as any,
        criado_por: user.id,
        video_url: payload.video_url,
        video_path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício criado");
      queryClient.invalidateQueries({ queryKey: ["exercicios-personalizados"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ex: ExercicioRow) => {
      if (ex.video_path) {
        await supabase.storage.from("exercicios-videos").remove([ex.video_path]);
      }
      const { error } = await supabase.from("exercicios_personalizados").delete().eq("id", ex.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício removido");
      queryClient.invalidateQueries({ queryKey: ["exercicios-personalizados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpenVideo = async (ex: ExercicioRow) => {
    if (ex.video_url) {
      window.open(ex.video_url, "_blank", "noopener,noreferrer");
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
      setVideoPreview({ nome: ex.nome, src: data.signedUrl });
    }
  };

  const exerciciosBusca = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return exercicios.filter((ex) => ex.nome.toLowerCase().includes(q));
  }, [exercicios, search]);

  const exerciciosPorSub = useMemo(() => {
    if (!selectedCategory || !selectedSub) return [];
    return exercicios.filter((ex) =>
      ex.grupos.some((g) => g.grupo === selectedCategory.name && g.subcategoria === selectedSub),
    );
  }, [exercicios, selectedCategory, selectedSub]);

  const handleSave = () => {
    const grupos: GroupSelection[] = Object.entries(selecoes)
      .filter(([, sub]) => !!sub)
      .map(([grupo, subcategoria]) => ({ grupo, subcategoria }));
    const result = exerciseSchema.safeParse({ nome, grupos, video_url: videoUrl });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    if (videoFile && videoFile.size > MAX_VIDEO_BYTES) {
      toast.error("Vídeo excede 100 MB");
      return;
    }
    createMutation.mutate({
      nome: result.data.nome!,
      grupos: result.data.grupos as GroupSelection[],
      video_url: videoUrl.trim() ? videoUrl.trim() : null,
      video_file: videoFile,
    });
  };

  const toggleGrupo = (grupo: string, checked: boolean) => {
    setSelecoes((prev) => {
      const next = { ...prev };
      if (checked) next[grupo] = "";
      else delete next[grupo];
      return next;
    });
  };

  const renderExerciseCard = (ex: ExercicioRow, showGroups = false) => {
    const hasVideo = !!ex.video_url || !!ex.video_path;
    return (
      <div key={ex.id} className="glass-card rounded-lg p-4 flex items-center gap-3 group">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Dumbbell className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{ex.nome}</p>
          {showGroups && ex.grupos.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {ex.grupos.map((g) => `${g.grupo} · ${g.subcategoria}`).join(" • ")}
            </p>
          )}
        </div>
        {hasVideo && (
          <button
            onClick={() => handleOpenVideo(ex)}
            className="text-muted-foreground hover:text-primary"
            aria-label="Ver vídeo"
          >
            <Video className="w-4 h-4" />
          </button>
        )}
        {isCoordAdmin && (
          <button
            onClick={() => deleteMutation.mutate(ex)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            aria-label="Remover exercício"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // VIEW: Subcategoria selecionada
  if (selectedCategory && selectedSub) {
    return (
      <div className="space-y-4 mt-4 animate-fade-in">
        <button
          onClick={() => setSelectedSub(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar a {selectedCategory.name}
        </button>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-heading font-bold text-foreground">
            {selectedCategory.name} · {selectedSub}
          </h3>
          <Badge variant="secondary">{exerciciosPorSub.length} exercícios</Badge>
        </div>

        {exerciciosPorSub.length === 0 ? (
          <div className="glass-card rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum exercício cadastrado nesta subcategoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exerciciosPorSub.map((ex) => renderExerciseCard(ex))}
          </div>
        )}

        {renderVideoModal()}
      </div>
    );
  }

  // VIEW: Categoria selecionada
  if (selectedCategory) {
    return (
      <div className="space-y-4 mt-4 animate-fade-in">
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar às categorias
        </button>

        <h3 className="text-lg font-heading font-bold text-foreground">
          {selectedCategory.name}
        </h3>

        {selectedCategory.subcategories.length === 0 ? (
          <div className="glass-card rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma subcategoria cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedCategory.subcategories.map((sub) => {
              const count = exercicios.filter((ex) =>
                ex.grupos.some((g) => g.grupo === selectedCategory.name && g.subcategoria === sub),
              ).length;
              return (
                <button
                  key={sub}
                  onClick={() => setSelectedSub(sub)}
                  className="glass-card rounded-lg p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left w-full"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1">{sub}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // VIEW: Categorias + busca
  return (
    <div className="space-y-4 mt-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-heading font-bold text-foreground">Banco de Exercícios</h3>
        {isCoordAdmin && (
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Novo Exercício
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          className="pl-9"
          maxLength={120}
        />
      </div>

      {search.trim() ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {exerciciosBusca.length} resultado(s) para "{search.trim()}"
          </p>
          {exerciciosBusca.length === 0 ? (
            <div className="glass-card rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhum exercício encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exerciciosBusca.map((ex) => renderExerciseCard(ex, true))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat)}
              className="glass-card rounded-lg p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors text-left w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.subcategories.length > 0
                      ? `${cat.subcategories.length} subcategorias`
                      : "Em breve"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Dialog: Novo Exercício */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Exercício</DialogTitle>
            <DialogDescription>
              Defina nome, grupos com subcategoria e (opcional) vídeo demonstrativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ex-nome">Nome do exercício</Label>
              <Input
                id="ex-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Agachamento Búlgaro"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label>Vídeo (opcional)</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Cole um link (YouTube, Vimeo, Drive...)"
                maxLength={500}
              />
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="ex-video-file"
                  className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-accent/30"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {videoFile ? "Trocar arquivo" : "Enviar arquivo"}
                </Label>
                <input
                  id="ex-video-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
                {videoFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate max-w-[180px]">{videoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setVideoFile(null)}
                      className="hover:text-destructive"
                      aria-label="Remover arquivo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Use link OU arquivo (máx. 100 MB). Se ambos forem informados, o link tem prioridade.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Grupos</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.name}
                    className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-border hover:bg-accent/30"
                  >
                    <Checkbox
                      checked={cat.name in selecoes}
                      onCheckedChange={(c) => toggleGrupo(cat.name, !!c)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {Object.keys(selecoes).length > 0 && (
              <div className="space-y-3">
                <Label>Subcategoria por grupo</Label>
                {Object.keys(selecoes).map((grupoName) => {
                  const cat = CATEGORIES.find((c) => c.name === grupoName);
                  if (!cat) return null;
                  return (
                    <div key={grupoName} className="glass-card rounded-md p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">{grupoName}</p>
                      {cat.subcategories.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem subcategorias</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {cat.subcategories.map((sub) => {
                            const active = selecoes[grupoName] === sub;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() =>
                                  setSelecoes((prev) => ({ ...prev, [grupoName]: sub }))
                                }
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:border-primary/40"
                                }`}
                              >
                                {sub}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderVideoModal()}
    </div>
  );

  function renderVideoModal() {
    return (
      <Dialog open={!!videoPreview} onOpenChange={(o) => !o && setVideoPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{videoPreview?.nome}</DialogTitle>
          </DialogHeader>
          {videoPreview && (
            <video src={videoPreview.src} controls className="w-full rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    );
  }
}
