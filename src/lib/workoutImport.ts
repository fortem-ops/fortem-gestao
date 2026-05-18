import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { WORKOUT_TEMPLATES, type WorkoutTemplate, type WorkoutExercise } from "@/components/student/workout/workoutTemplates";

export interface Escolha {
  template_fase: string;
  treino_nome: string;
  ordem: number;
  exercicio_id: string | null;
  categoria_override: string | null;
}

export interface BankExerciseGrupo {
  grupo: string;
  subcategoria: string;
}

export interface BankExercise {
  id: string;
  nome: string;
  video_url: string | null;
  video_path: string | null;
  grupos: BankExerciseGrupo[];
}

export interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

const CATEGORIA_TO_GRUPO: Record<string, string> = {
  LIB: "Liberação Miofascial",
  MOB: "Mobilidade Articular",
  ATI: "Ativação Muscular",
};

function pickSubcategoria(categoria: string | undefined, grupos: BankExerciseGrupo[] | undefined): string | undefined {
  if (!categoria || !grupos?.length) return undefined;
  const target = CATEGORIA_TO_GRUPO[categoria];
  if (!target) return undefined;
  return grupos.find((g) => g.grupo === target)?.subcategoria;
}

export function applyEscolhas(template: WorkoutTemplate, escolhas: Escolha[], bank: BankExercise[]): WorkoutData {
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
      const sub = overrideSub || ex.subcategoria || (link ? pickSubcategoria(ex.categoria, link.grupos) : undefined);
      const base: WorkoutExercise = { ...ex, ...(sub ? { subcategoria: sub } : {}) };
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
    treinos: template.treinos.map((t) => ({ nome: t.nome, exercicios: applyToList(t.nome, t.exercicios) })),
  };
}

/** Opções de Fase Inicial agrupadas (derivadas de WORKOUT_TEMPLATES). */
export const FASE_INICIAL_GROUPS: { label: string; fases: string[] }[] = [
  { label: "Fases", fases: WORKOUT_TEMPLATES.filter((t) => /^Fase \d/.test(t.fase)).map((t) => t.fase) },
  {
    label: "Métodos",
    fases: WORKOUT_TEMPLATES.filter((t) =>
      ["Personalizado", "Personalizado 2", "Planilha 5RM", "5-3-1", "M102"].includes(t.fase),
    ).map((t) => t.fase),
  },
  { label: "Corrida", fases: WORKOUT_TEMPLATES.filter((t) => t.fase.startsWith("Corrida")).map((t) => t.fase) },
];

export const FASE_INICIAL_FASES: string[] = FASE_INICIAL_GROUPS.flatMap((g) => g.fases);

async function loadBankAndEscolhas(): Promise<{ bank: BankExercise[]; escolhas: Escolha[] }> {
  const [{ data: bankData, error: bErr }, { data: escData, error: eErr }] = await Promise.all([
    supabase.from("exercicios_personalizados").select("id, nome, video_url, video_path, grupos"),
    supabase.from("banco_treinos_escolhas").select("template_fase, treino_nome, ordem, exercicio_id, categoria_override"),
  ]);
  if (bErr) throw bErr;
  if (eErr) throw eErr;
  const bank: BankExercise[] = (bankData || []).map((r) => ({
    id: r.id,
    nome: r.nome,
    video_url: r.video_url,
    video_path: r.video_path,
    grupos: ((r.grupos as unknown) as BankExerciseGrupo[]) || [],
  }));
  return { bank, escolhas: (escData || []) as Escolha[] };
}

/** Verifica se o aluno já possui treino em status 'atual'. */
export async function hasTreinoAtual(alunoId: string): Promise<boolean> {
  const { data } = await supabase
    .from("treinos")
    .select("id")
    .eq("aluno_id", alunoId)
    .eq("status", "atual")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Importa a fase indicada e a prescreve como treino atual do aluno. */
export async function prescribeFaseInicial(faseNome: string, alunoId: string, autorId: string): Promise<void> {
  const template = WORKOUT_TEMPLATES.find((t) => t.fase === faseNome);
  if (!template) throw new Error(`Fase "${faseNome}" não encontrada no Banco de Treinos.`);

  const { bank, escolhas } = await loadBankAndEscolhas();
  const prepared = applyEscolhas(template, escolhas, bank);

  // Arquiva atuais
  const { error: archiveErr } = await supabase
    .from("treinos")
    .update({ status: "arquivado", updated_at: new Date().toISOString() })
    .eq("aluno_id", alunoId)
    .eq("status", "atual");
  if (archiveErr) throw archiveErr;

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
    autor_id: autorId,
    descricao: `${faseNome} — Indicação da aula experimental`,
    conteudo: prepared as unknown as Json,
    status: "atual",
    versao: proximaVersao,
  });
  if (error) throw error;
}
