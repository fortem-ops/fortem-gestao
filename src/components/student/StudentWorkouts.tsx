import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Dumbbell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportFromBankDialog } from "./workout/ImportFromBankDialog";

export function StudentWorkouts({ student }: { student: Tables<"alunos"> }) {
  const navigate = useNavigate();

  const { data: treinos, refetch } = useQuery({
    queryKey: ["treinos", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinos")
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Histórico de Treinos</h3>
        <ImportFromBankDialog alunoId={student.id} onSaved={() => refetch()} />
      </div>

      {(!treinos || treinos.length === 0) ? (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhum treino registrado para este aluno.
        </div>
      ) : (
        <div className="space-y-2">
          {treinos.map(t => (
            <div
              key={t.id}
              className="glass-card rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all"
              onClick={() => navigate(`/treinos?aluno=${student.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{t.descricao}</span>
                    {t.status === "atual" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                        Atual
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    v{t.versao} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
