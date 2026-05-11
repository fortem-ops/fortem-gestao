import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Trash2, Save } from "lucide-react";
import { STAGE_COLORS, stageColor, FUNNELS, type Funnel } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_active: boolean;
  funnel: Funnel;
}

const COLOR_KEYS = Object.keys(STAGE_COLORS);
const PROTECTED_NAMES = new Set(["Risco de evasão", "Recuperado", "Lead", "Aluno ativo", "Aluno inativo", "Renovação de plano"]);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ManageStagesDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, { name: string }>>({});
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Stage | null>(null);

  const { data: stages = [], isLoading } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages-manage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id,name,position,color,is_active")
        .order("position");
      if (error) throw error;
      return data as Stage[];
    },
    enabled: open,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["pipeline-stages-manage"] });
    qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    qc.invalidateQueries({ queryKey: ["dashboard-pipeline-widget"] });
  }

  async function createStage() {
    const name = newName.trim();
    if (!name) return toast.error("Informe o nome da etapa");
    setBusy(true);
    const maxPos = stages.reduce((m, s) => Math.max(m, s.position), -1);
    const { error } = await supabase.from("pipeline_stages").insert({
      name,
      color: newColor,
      position: maxPos + 1,
      is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Etapa criada");
    setNewName("");
    setNewColor("blue");
    invalidate();
  }

  async function updateStage(id: string, patch: Partial<Stage>) {
    const { error } = await supabase.from("pipeline_stages").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function saveName(stage: Stage) {
    const next = editing[stage.id]?.name?.trim();
    if (!next || next === stage.name) {
      setEditing((p) => { const c = { ...p }; delete c[stage.id]; return c; });
      return;
    }
    if (PROTECTED_NAMES.has(stage.name)) {
      const ok = confirm(`A etapa "${stage.name}" é referenciada por automações (detecção de evasão). Renomear pode quebrar a regra. Continuar?`);
      if (!ok) return;
    }
    await updateStage(stage.id, { name: next });
    setEditing((p) => { const c = { ...p }; delete c[stage.id]; return c; });
    toast.success("Nome atualizado");
  }

  async function move(stage: Stage, dir: -1 | 1) {
    const idx = stages.findIndex((s) => s.id === stage.id);
    const swap = stages[idx + dir];
    if (!swap) return;
    // Two-step swap to avoid unique conflicts (if any)
    const tmp = -1 - idx;
    await supabase.from("pipeline_stages").update({ position: tmp }).eq("id", stage.id);
    await supabase.from("pipeline_stages").update({ position: stage.position }).eq("id", swap.id);
    await supabase.from("pipeline_stages").update({ position: swap.position }).eq("id", stage.id);
    invalidate();
  }

  async function doDelete(stage: Stage) {
    const { count } = await supabase
      .from("alunos")
      .select("id", { count: "exact", head: true })
      .eq("current_pipeline_stage_id", stage.id);
    if ((count ?? 0) > 0) {
      toast.error(`Não é possível excluir: ${count} aluno(s) nesta etapa. Mova-os primeiro.`);
      setConfirmDelete(null);
      return;
    }
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", stage.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Etapa excluída");
      invalidate();
    }
    setConfirmDelete(null);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar etapas do funil</DialogTitle>
          </DialogHeader>

          {/* Lista */}
          <div className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              stages.map((s, i) => {
                const c = stageColor(s.color);
                const isEditing = editing[s.id] !== undefined;
                return (
                  <div key={s.id} className={cn("rounded-md border p-3 space-y-2", c.border, c.bg)}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full shrink-0", c.dot)} />
                      {isEditing ? (
                        <Input
                          value={editing[s.id].name}
                          onChange={(e) => setEditing((p) => ({ ...p, [s.id]: { name: e.target.value } }))}
                          className="h-8 flex-1"
                          autoFocus
                        />
                      ) : (
                        <button
                          className="flex-1 text-left text-sm font-medium hover:underline"
                          onClick={() => setEditing((p) => ({ ...p, [s.id]: { name: s.name } }))}
                        >
                          {s.name}
                          {PROTECTED_NAMES.has(s.name) && (
                            <span className="ml-2 text-[10px] text-amber-400">(automação)</span>
                          )}
                        </button>
                      )}
                      {isEditing && (
                        <Button size="sm" variant="ghost" onClick={() => saveName(s)} className="h-8">
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(s, -1)}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === stages.length - 1} onClick={() => move(s, 1)}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Ativa</span>
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(v) => updateStage(s.id, { is_active: v })}
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-rose-400 hover:text-rose-300"
                        onClick={() => setConfirmDelete(s)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5 pl-5">
                      <span className="text-[10px] text-muted-foreground mr-1">Cor:</span>
                      {COLOR_KEYS.map((k) => {
                        const cc = STAGE_COLORS[k];
                        return (
                          <button
                            key={k}
                            onClick={() => updateStage(s.id, { color: k })}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 transition-all",
                              cc.dot,
                              s.color === k ? "border-foreground scale-110" : "border-transparent opacity-70 hover:opacity-100"
                            )}
                            title={k}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Criar nova */}
          <div className="rounded-md border border-dashed p-3 space-y-2 mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova etapa</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome da etapa"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createStage()}
                className="h-9"
              />
              <Button onClick={createStage} disabled={busy} className="gap-1.5">
                <Plus className="w-4 h-4" /> Criar
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground mr-1">Cor:</span>
              {COLOR_KEYS.map((k) => {
                const cc = STAGE_COLORS[k];
                return (
                  <button
                    key={k}
                    onClick={() => setNewColor(k)}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-all",
                      cc.dot,
                      newColor === k ? "border-foreground scale-110" : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    title={k}
                  />
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && PROTECTED_NAMES.has(confirmDelete.name)
                ? "Esta etapa é referenciada por automações (ex.: detecção de evasão). Excluir pode quebrar regras automáticas."
                : "Esta ação não pode ser desfeita. Alunos atualmente na etapa precisam ser movidos antes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && doDelete(confirmDelete)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
