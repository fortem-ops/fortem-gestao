import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Settings2, ShieldAlert } from "lucide-react";
import { PipelineKanban } from "@/components/pipeline/PipelineKanban";
import { PipelineFilters, type PipelineFiltersValue } from "@/components/pipeline/PipelineFilters";
import { ManageStagesDialog } from "@/components/pipeline/ManageStagesDialog";

export default function Pipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PipelineFiltersValue>({ search: "", professorId: null, origem: null });
  const [scanning, setScanning] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  async function runEvasaoScan() {
    setScanning(true);
    try {
      const { data, error } = await supabase.rpc("fn_detect_evasao" as any);
      if (error) throw error;
      const r = (data || {}) as any;
      toast.success(`Scan concluído: ${r.movidos_para_risco || 0} em risco · ${r.movidos_para_recuperado || 0} recuperados`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar scan");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Pipeline Comercial</h1>
          <p className="text-sm text-muted-foreground mt-1">CRM Fortem — jornada do lead ao aluno ativo</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManageOpen(true)} className="gap-2">
              <Settings2 className="w-4 h-4" />
              Gerenciar etapas
            </Button>
            <Button variant="outline" onClick={runEvasaoScan} disabled={scanning} className="gap-2">
              <ShieldAlert className="w-4 h-4" />
              {scanning ? "Analisando..." : "Detectar evasão agora"}
            </Button>
          </div>
        )}
      </div>

      <PipelineFilters value={filters} onChange={setFilters} />

      <PipelineKanban filters={filters} />
    </div>
  );
}
