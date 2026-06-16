import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Library, Dumbbell, Loader2, Sparkles } from "lucide-react";
import { WORKOUT_TEMPLATES, type WorkoutTemplate, type WorkoutExercise } from "./workoutTemplates";
import { WorkoutDetail } from "./WorkoutDetail";
import { flattenPersonalizado, type PersonalizadoConteudo } from "./personalizadoTypes";

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

type PreparedData = { aquecimento: WorkoutExercise[]; treinos: { nome: string; exercicios: WorkoutExercise[] }[] };
type Selected =
  | { kind: "template"; template: WorkoutTemplate }
  | { kind: "personalizado"; nome: string; data: PreparedData };

function applyEscolhas(
  template: WorkoutTemplate,
  escolhas: Escolha[],
  bank: BankExercise[],
): PreparedData {
  const bankById = new Map(bank.map((b) => [b.id, b]));
  const bankByNome = new Map(bank.map((b) => [b.nome.toLowerCase().trim(), b]));

  const escolhaMap = new Map<string, BankExercise>();
  const overrideMap = new Map<string, string>();
  escolhas
    .filter((e) => e.template_fase === template.fase)
    .forEach((e) => {
      const key = `${e.treino_nome}|${e.ordem}`;
      if (e.exercicio_id) {
        const b = bankById.get(e.exercicio_id);
        if (b) escolhaMap.set(key, b);
      }
      if (e.categoria_override) overrideMap.set(key, e.categoria_override);
    });

  const applyToList = (treinoNome: string, list: WorkoutExercise[]) =>
    list.map((ex) => {
      const key = `${treinoNome}|${ex.ordem}`;
      const escolhido = escolhaMap.get(key);
      const fallback = !escolhido ? bankByNome.get(ex.exercicio.toLowerCase().trim()) : undefined;
      const link = escolhido || fallback;

      const overrideSub = treinoNome === "__aquecimento__" ? overrideMap.get(key) : undefined;
      const sub =
        overrideSub ||
        ex.subcategoria ||
        (link ? pickSubcategoria(ex.categoria, link.grupos) : undefined);

      const base: WorkoutExercise = {
        ...ex,
        ...(sub ? { subcategoria: sub } : {}),
      };
      if (!link) return base;
      return {
        ...base,
        exercicio: link.nome,
        exercicio_id: link.id,
        video_url: link.video_url,
        video_path: link.video_path,
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);

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
        .select("template_fase, treino_nome, ordem, exercicio_id, categoria_override");
      if (error) throw error;
      return data as Escolha[];
    },
  });

  const { data: personalizados = [], isLoading: loadingPers } = useQuery({
    queryKey: ["banco-treinos-personalizados-import"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_treinos_personalizados")
        .select("id, nome, conteudo, criado_por, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: autoresMap = {} } = useQuery({
    queryKey: ["banco-treinos-autores-import", personalizados.map((m) => m.criado_por).join(",")],
    enabled: open && personalizados.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(personalizados.map((m) => m.criado_por).filter(Boolean)));
      if (ids.length === 0) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name || "Professor"; });
      return map;
    },
  });

  const escolhasPorFase = useMemo(() => {
    const map = new Map<string, number>();
    escolhas.forEach((e) => map.set(e.template_fase, (map.get(e.template_fase) || 0) + 1));
    return map;
  }, [escolhas]);

  const modelosPorAutor = useMemo(() => {
    const corridaNomes = new Set(
      WORKOUT_TEMPLATES.filter((t) => t.fase.startsWith("Corrida")).map((t) => t.fase),
    );
    const visiveis = personalizados.filter((m) => !corridaNomes.has(m.nome));
    const groups = new Map<string, typeof personalizados>();
    visiveis.forEach((m) => {
      const arr = groups.get(m.criado_por) || [];
      arr.push(m);
      groups.set(m.criado_por, arr);
    });
    const result: { autorId: string; titulo: string; isMine: boolean; modelos: typeof personalizados }[] = [];
    if (user?.id && groups.has(user.id)) {
      result.push({ autorId: user.id, titulo: "Meus Modelos", isMine: true, modelos: groups.get(user.id)! });
    }
    Array.from(groups.entries())
      .filter(([id]) => id !== user?.id)
      .sort((a, b) => (autoresMap[a[0]] || "").localeCompare(autoresMap[b[0]] || ""))
      .forEach(([id, modelos]) => {
        result.push({ autorId: id, titulo: `Modelos ${autoresMap[id] || "Professor"}`, isMine: false, modelos });
      });
    return result;
  }, [personalizados, autoresMap, user?.id]);

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
  };

  const prepared = useMemo<PreparedData | null>(() => {
    if (!selected) return null;
    if (selected.kind === "personalizado") return selected.data;
    return applyEscolhas(selected.template, escolhas, bank);
  }, [selected, escolhas, bank]);

  const selectedFase = selected?.kind === "template" ? selected.template.fase : selected?.kind === "personalizado" ? selected.nome : "";

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

            {(loadingBank || loadingEscolhas || loadingPers) ? (
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
                              onClick={() => setSelected({ kind: "template", template: tmpl })}
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

                {modelosPorAutor.map((grupo) => (
                  <div key={grupo.autorId}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {grupo.titulo}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {grupo.modelos.map((m) => {
                        const conteudo = (m.conteudo as unknown) as PersonalizadoConteudo;
                        const nTreinos = conteudo?.treinos?.length || 0;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelected({
                              kind: "personalizado",
                              nome: m.nome,
                              data: flattenPersonalizado(conteudo),
                            })}
                            className="glass-card rounded-lg p-4 text-left hover:border-primary/50 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Sparkles className="w-5 h-5 text-primary" />
                              </div>
                              {grupo.isMine && (
                                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                  Meu
                                </Badge>
                              )}
                            </div>
                            <div className="mt-3">
                              <p className="font-heading font-bold text-foreground text-sm line-clamp-2">{m.nome}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {nTreinos} treinos · {new Date(m.updated_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          prepared && (
            <>
              <DialogHeader>
                <DialogTitle>Prescrever — {selectedFase}</DialogTitle>
                <DialogDescription>
                  Revise os exercícios (já preenchidos com as escolhas do Banco) e ajuste o que for necessário antes de salvar.
                </DialogDescription>
              </DialogHeader>
              <WorkoutDetail
                alunoId={alunoId}
                templateData={prepared}
                fase={selectedFase}
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
