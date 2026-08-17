import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StudentWorkouts } from "@/components/student/StudentWorkouts";
import type { Tables } from "@/integrations/supabase/types";
import { Dumbbell } from "lucide-react";

export default function MeusTreinos() {
  const { user } = useAuth();

  const { data: ficha, isLoading, error } = useQuery({
    queryKey: ["ficha-equipe", user?.id],
    queryFn: async () => {
      const { data: id, error: rpcErr } = await (
        supabase.rpc as unknown as (n: string) => Promise<{ data: string | null; error: unknown }>
      )("fn_get_or_create_ficha_equipe");
      if (rpcErr) throw rpcErr;
      if (!id) throw new Error("Não foi possível criar a sua ficha de treino.");

      const { data, error: selErr } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", id)
        .single();
      if (selErr) throw selErr;
      return data as Tables<"alunos">;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Dumbbell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Meus Treinos</h1>
          <p className="text-sm text-muted-foreground">
            Suas fichas de treino pessoais — use o mesmo banco de treinos dos alunos.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
          Carregando sua ficha...
        </div>
      )}

      {error && (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-destructive">
          {(error as Error).message || "Erro ao carregar sua ficha de treino."}
        </div>
      )}

      {ficha && <StudentWorkouts student={ficha} />}
    </div>
  );
}
