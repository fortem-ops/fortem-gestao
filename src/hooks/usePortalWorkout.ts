import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Json } from "@/integrations/supabase/types";
import { isPersonalizadoContent, flattenPersonalizado } from "@/components/student/workout/personalizadoTypes";
import type { WorkoutExercise } from "@/components/student/workout/workoutTemplates";
import { format, startOfWeek, endOfWeek } from "date-fns";

export interface WorkoutData {
  aquecimento: WorkoutExercise[];
  treinos: { nome: string; exercicios: WorkoutExercise[] }[];
}

export interface TreinoAgendamento {
  id: string;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  status: string;
  observacoes: string | null;
}

function flatFromTreino(treino: Tables<"treinos">): WorkoutData {
  const c = treino.conteudo as Json | null;
  if (c && isPersonalizadoContent(c)) {
    return flattenPersonalizado(c.estrutura);
  }
  return (c as unknown as WorkoutData) || { aquecimento: [], treinos: [] };
}

export function usePortalWorkout(alunoId: string | undefined) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const treinoQuery = useQuery({
    queryKey: ["portal-treino", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      await (supabase.rpc as unknown as (n: string) => Promise<unknown>)("ativar_treinos_agendados");
      const { data, error } = await supabase
        .from("treinos")
        .select("*")
        .eq("aluno_id", alunoId)
        .eq("status", "atual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { treino: data as Tables<"treinos">, data: flatFromTreino(data) };
    },
  });

  const progressoQuery = useQuery({
    queryKey: ["portal-progress", alunoId, weekStart.toISOString()],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_workout_progress")
        .select("*")
        .eq("aluno_id", alunoId)
        .gte("data", format(weekStart, "yyyy-MM-dd"))
        .lte("data", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []) as Tables<"student_workout_progress">[];
    },
  });

  const agendamentosQuery = useQuery({
    queryKey: ["portal-agendamentos-treino", alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("treino_agendamentos")
        .select("id, data, horario_inicio, horario_fim, status, observacoes")
        .eq("aluno_id", alunoId)
        .gte("data", hoje)
        .in("status", ["confirmado", "realizado"])
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data || []) as TreinoAgendamento[];
    },
  });

  return {
    treino: treinoQuery.data?.treino ?? null,
    workout: treinoQuery.data?.data ?? null,
    isLoadingTreino: treinoQuery.isLoading,
    progresso: progressoQuery.data ?? [],
    isLoadingProgresso: progressoQuery.isLoading,
    agendamentos: agendamentosQuery.data ?? [],
    isLoadingAgendamentos: agendamentosQuery.isLoading,
    refetch: () => {
      treinoQuery.refetch();
      progressoQuery.refetch();
      agendamentosQuery.refetch();
    },
  };
}
