import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Library, Dumbbell, Loader2 } from "lucide-react";
import { WORKOUT_TEMPLATES, type WorkoutTemplate, type WorkoutExercise } from "./workoutTemplates";
import { WorkoutDetail } from "./WorkoutDetail";

interface Escolha {
  template_fase: string;
  treino_nome: string;
  ordem: number;
  exercicio_id: string | null;
  categoria_override: string | null;
}

interface BankExerciseGrupo {
  grupo: string;
  subcategoria: string;
}

interface BankExercise {
  id: string;
  nome: string;
  video_url: string | null;
  video_path: string | null;
  grupos: BankExerciseGrupo[];
}

const CATEGORIA_TO_GRUPO: Record<string, string> = {
  LIB: "Liberação Miofascial",
  MOB: "Mobilidade Articular",
  ATI: "Ativação Muscular",
};

function pickSubcategoria(
  categoria: string | undefined,
  grupos: BankExerciseGrupo[] | undefined,
): string | undefined {
  if (!categoria || !grupos?.length) return undefined;
  const target = CATEGORIA_TO_GRUPO[categoria];
  if (!target) return undefined;
  return grupos.find((g) => g.grupo === target)?.subcategoria;
}

interface Props {
  alunoId: string;
  onSaved?: () => void;
}

const PHASE_GROUPS = [
  { label: "Fases", filter: (t: WorkoutTemplate) => /^Fase \d/.test(t.fase) },
  { label: "Métodos", filter: (t: WorkoutTemplate) => ["Personalizado", "Planilha 5RM", "5-3-1", "M102"].includes(t.fase) },
  { label: "Corrida", filter: (t: WorkoutTemplate) => t.fase.startsWith("Corrida") },
];

function applyEscolhas(
  template: WorkoutTemplate,
  escolhas: Escolha[],
  bank: BankExercise[],
): { aquecimento: WorkoutExercise[]; treinos: { nome: string; exercicios: WorkoutExercise[] }[] } {
  const bankById = new Map(bank.map((b) => [b.id, b]));
  // Fallback: também resolver por nome (caso o template já traga o nome certo,
  // sem registro em banco_treinos_escolhas, ainda conseguimos puxar o vídeo).
  const bankByNome = new Map(bank.map((b) => [b.nome.toLowerCase().trim(), b]));

  const escolhaMap = new Map<string, BankExercise>();
  escolhas
    .filter((e) => e.template_fase === template.fase)
    .forEach((e) => {
      const b = bankById.get(e.exercicio_id);
      if (b) escolhaMap.set(`${e.treino_nome}|${e.ordem}`, b);
    });

  const applyToList = (treinoNome: string, list: WorkoutExercise[]) =>
    list.map((ex) => {
      const escolhido = escolhaMap.get(`${treinoNome}|${ex.ordem}`);
      const fallback = !escolhido ? bankByNome.get(ex.exercicio.toLowerCase().trim()) : undefined;
      const link = escolhido || fallback;
      if (!link) return { ...ex };
      // Para linhas de aquecimento (LIB/MOB/ATI), tenta resolver subcategoria do banco
      // se o template ainda não trouxer uma — mantém retrocompatibilidade.
      const sub = ex.subcategoria || pickSubcategoria(ex.categoria, link.grupos);
      return {
        ...ex,
        exercicio: link.nome,
        exercicio_id: link.id,
        video_url: link.video_url,
        video_path: link.video_path,
        ...(sub ? { subcategoria: sub } : {}),
      };
    });

  return {
    aquecimento: applyToList("__aquecimento__", template.aquecimento),
    treinos: template.treinos.map((t) => ({
      nome: t.nome,
      exercicios: applyToList(t.nome, t.exercicios),
    })),
  };
}

export function ImportFromBankDialog({ alunoId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);

  const { data: bank = [], isLoading: loadingBank } = useQuery({
    queryKey: ["banco-exercicios-min"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercicios_personalizados")
        .select("id, nome, video_url, video_path, grupos");
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        video_url: r.video_url,
        video_path: r.video_path,
        grupos: ((r.grupos as unknown) as BankExerciseGrupo[]) || [],
      })) as BankExercise[];
    },
  });

  const { data: escolhas = [], isLoading: loadingEscolhas } = useQuery({
    queryKey: ["banco-treinos-escolhas-import"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_treinos_escolhas")
        .select("template_fase, treino_nome, ordem, exercicio_id");
      if (error) throw error;
      return data as Escolha[];
    },
  });

  const escolhasPorFase = useMemo(() => {
    const map = new Map<string, number>();
    escolhas.forEach((e) => map.set(e.template_fase, (map.get(e.template_fase) || 0) + 1));
    return map;
  }, [escolhas]);

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
  };

  const prepared = useMemo(() => {
    if (!selected) return null;
    return applyEscolhas(selected, escolhas, bank);
  }, [selected, escolhas, bank]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Library className="w-4 h-4 mr-1" /> Importar do Banco de Treinos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {!selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Importar do Banco de Treinos</DialogTitle>
              <DialogDescription>
                Selecione um modelo. As escolhas de exercícios já vinculadas no Banco de Treinos serão aplicadas automaticamente.
              </DialogDescription>
            </DialogHeader>

            {(loadingBank || loadingEscolhas) ? (
              <div className="py-12 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : (
              <div className="space-y-6 mt-2">
                {PHASE_GROUPS.map((group) => {
                  const items = WORKOUT_TEMPLATES.filter(group.filter);
                  if (items.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {group.label}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {items.map((tmpl) => {
                          const count = escolhasPorFase.get(tmpl.fase) || 0;
                          return (
                            <button
                              key={tmpl.fase}
                              onClick={() => setSelected(tmpl)}
                              className="glass-card rounded-lg p-4 text-left hover:border-primary/50 transition-all group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                  <Dumbbell className="w-5 h-5 text-primary" />
                                </div>
                                {count > 0 && (
                                  <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                                    {count} vínculos
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-3">
                                <p className="font-heading font-bold text-foreground text-sm">{tmpl.fase}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {tmpl.frequencia}/semana · {tmpl.treinos.length} treinos
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          prepared && (
            <>
              <DialogHeader>
                <DialogTitle>Prescrever — {selected.fase}</DialogTitle>
                <DialogDescription>
                  Revise os exercícios (já preenchidos com as escolhas do Banco) e ajuste o que for necessário antes de salvar.
                </DialogDescription>
              </DialogHeader>
              <WorkoutDetail
                alunoId={alunoId}
                templateData={prepared}
                fase={selected.fase}
                onBack={() => setSelected(null)}
                onSaved={() => {
                  onSaved?.();
                  handleClose();
                }}
              />
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
