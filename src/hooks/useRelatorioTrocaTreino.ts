import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { destinoRelatorioTreino } from "@/lib/relatorioTreino";
import { toast } from "sonner";

/** Abre o relatório apenas para uma prescrição nova, nunca nos autosaves de sessões. */
export function useRelatorioTrocaTreino() {
  const navigate = useNavigate();
  const inicio = useRef(new Date().toISOString());
  const abertos = useRef(new Set<string>());
  return async (alunoId: string) => {
    const { data, error } = await supabase.from("treinos")
      .select("id, template_fase, descricao")
      .eq("aluno_id", alunoId).gte("created_at", inicio.current)
      .in("status", ["atual", "aguardando"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { toast.error("Treino salvo; abra o Relatório Técnico pela ficha do aluno."); return; }
    if (!data || abertos.current.has(data.id)) return;
    abertos.current.add(data.id);
    navigate(destinoRelatorioTreino(alunoId, data.id, data.template_fase ?? data.descricao));
  };
}