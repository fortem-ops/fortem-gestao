import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Clock, AlertCircle, CheckCircle } from "lucide-react";

export function StudentTasks({ student }: { student: Tables<"alunos"> }) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Tarefas</h3>
        <Button size="sm"><Plus className="w-3 h-3 mr-1" /> Nova Tarefa</Button>
      </div>
      <p className="text-sm text-muted-foreground text-center py-8">Tarefas serão exibidas aqui quando conectadas ao banco de dados.</p>
    </div>
  );
}
