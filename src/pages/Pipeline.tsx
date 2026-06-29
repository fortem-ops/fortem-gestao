import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Settings2, ChevronDown, ChevronRight, RefreshCw, Plug } from "lucide-react";
import { PipelineKanban } from "@/components/pipeline/PipelineKanban";
import { PipelineFilters, type PipelineFiltersValue } from "@/components/pipeline/PipelineFilters";
import { ManageStagesDialog } from "@/components/pipeline/ManageStagesDialog";
import { PipedriveImportSheet } from "@/components/pipeline/PipedriveImportSheet";
import { FUNNELS, type Funnel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

export default function Pipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PipelineFiltersValue>({ search: "", professorId: null, origem: null, quick: "todos" });
  const [scanning, setScanning] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pipedriveOpen, setPipedriveOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<Funnel, boolean>>({ prospects: false, aluno: false, inativo: false });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  // Auto-sync Aluno Ativo / Renovação / Inativo com a data final do plano ao abrir o Pipeline
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    supabase.rpc("fn_detect_evasao" as any).then(({ error }) => {
      if (!error) queryClient.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    });
  }, [queryClient]);

  async function runEvasaoScan() {
    setScanning(true);
    try {
      const { data, error } = await supabase.rpc("fn_detect_evasao" as any);
      if (error) throw error;
      const r = (data || {}) as any;
      toast.success(`Scan: ${r.movidos_para_risco || 0} risco · ${r.movidos_para_renovacao || 0} renovação · ${r.movidos_para_inativo || 0} inativo`);
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={runEvasaoScan} disabled={scanning} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{scanning ? "Recalculando..." : "Recalcular status"}</span>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPipedriveOpen(true)} className="gap-2">
                <Plug className="w-4 h-4" />
                <span className="hidden sm:inline">Importar do Pipedrive</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} className="gap-2">
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Gerenciar etapas</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <PipelineFilters value={filters} onChange={setFilters} />

      <div className="space-y-6">
        {FUNNELS.map((f) => (
          <section key={f.id} className="space-y-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [f.id]: !c[f.id] }))}
              className="w-full flex items-center gap-2 text-left group"
            >
              {collapsed[f.id]
                ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              <h2 className="text-sm font-heading font-semibold uppercase tracking-wider text-foreground">{f.label}</h2>
              <span className="text-xs text-muted-foreground">· {f.description}</span>
              <div className="flex-1 h-px bg-border ml-2" />
            </button>
            <div className={cn(collapsed[f.id] && "hidden")}>
              <PipelineKanban funnel={f.id} filters={filters} />
            </div>
          </section>
        ))}
      </div>

      <ManageStagesDialog open={manageOpen} onOpenChange={setManageOpen} />
      <PipedriveImportSheet open={pipedriveOpen} onOpenChange={setPipedriveOpen} />
    </div>
  );
}
