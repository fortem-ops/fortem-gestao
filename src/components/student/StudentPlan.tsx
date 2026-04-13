import type { Tables } from "@/integrations/supabase/types";

export function StudentPlan({ student }: { student: Tables<"alunos"> }) {
  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
      <div className="glass-card rounded-lg p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Planos serão exibidos aqui quando conectados ao banco de dados.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Editável apenas por Coordenação e Administração</p>
    </div>
  );
}
