import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  alunoId?: string | null;
  treinoId?: string | null;
  exercicio: string;
  className?: string;
}

/** Campo "CARGA" do Portal do Aluno — grava em treino_cargas (1 registro por aluno/treino/exercício). */
export function CargaInput({ alunoId, treinoId, exercicio, className }: Props) {
  const qc = useQueryClient();
  const key = ["portal-treino-cargas", alunoId, treinoId];
  const { data: cargas = [] } = useQuery({
    queryKey: key,
    enabled: !!alunoId && !!treinoId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_cargas")
        .select("exercicio_nome, kg")
        .eq("aluno_id", alunoId)
        .eq("treino_id", treinoId);
      return data || [];
    },
  });
  const salvo = (cargas as any[]).find((c) => c.exercicio_nome === exercicio)?.kg ?? "";
  const [valor, setValor] = useState(salvo);
  useEffect(() => setValor(salvo), [salvo]);

  if (!alunoId || !treinoId || !exercicio) return null;

  const salvar = async () => {
    if (valor === salvo) return;
    const { error } = await (supabase as any).from("treino_cargas").upsert(
      {
        aluno_id: alunoId,
        treino_id: treinoId,
        exercicio_nome: exercicio,
        kg: valor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "aluno_id,treino_id,exercicio_nome" },
    );
    if (error) {
      toast.error("Não foi possível salvar a carga.");
      return;
    }
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? "mt-2"}`} onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] text-muted-foreground font-semibold w-11">CARGA</span>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        placeholder="— kg"
        aria-label={`Carga usada em ${exercicio}`}
        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
      />
    </div>
  );
}
