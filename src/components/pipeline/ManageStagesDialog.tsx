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
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Plus, Trash2, Save } from "lucide-react";
import { STAGE_COLORS, stageColor, slugifyFunnel, type PipelineFunnelRow } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_active: boolean;
  funnel_id: string;
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
  const [newFunnelId, setNewFunnelId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Stage | null>(null);

  // Funnel management state
  const [editingFunnel, setEditingFunnel] = useState<Record<string, { label: string; description: string }>>({});
  const [newFunnelLabel, setNewFunnelLabel] = useState("");
  const [confirmDeleteFunnel, setConfirmDeleteFunnel] = useState<PipelineFunnelRow | null>(null);

  const { data: funnels = [], isLoading: funnelsLoading } = useQuery<PipelineFunnelRow[]>({
    queryKey: ["pipeline-funnels-manage"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pipeline_funnels")
        .select("id,slug,label,description,position,is_system,is_active")
        .order("position");
      if (error) throw error;
      return (data || []) as PipelineFunnelRow[];
    },
    enabled: open,
  });

  const { data: stages = [], isLoading } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages-manage"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pipeline_stages")
        .select("id,name,position,color,is_active,funnel_id")
        .order("position") as any);
      if (error) throw error;
      return (data || []) as Stage[];
    },
    enabled: open,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["pipeline-stages-manage"] });
    qc.invalidateQueries({ queryKey: ["pipeline-funnels-manage"] });
    qc.invalidateQueries({ queryKey: ["pipeline-funnels"] });
    qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
    qc.invalidateQueries({ queryKey: ["pipeline-stages-all"] });
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    qc.invalidateQueries({ queryKey: ["dashboard-pipeline-widget"] });
  }

  // ============ Funil ops ============
  async function createFunnel() {
    const label = newFunnelLabel.trim();
    if (!label) return toast.error("Informe o nome do funil");
    const slug = slugifyFunnel(label);
    const maxPos = funnels.reduce((m, f) => Math.max(m, f.position), -1);
    setBusy(true);
    const { error } = await (supabase as any).from("pipeline_funnels").insert({
      slug,
      label,
      description: null,
      position: maxPos + 1,
      is_active: true,
      is_system: false,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Funil criado");
    setNewFunnelLabel("");
    invalidate();
  }

  async function updateFunnel(id: string, patch: Partial<PipelineFunnelRow>) {
    const { error } = await (supabase as any).from("pipeline_funnels").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function saveFunnelLabel(f: PipelineFunnelRow) {
    const draft = editingFunnel[f.id];
    if (!draft) return;
    const label = draft.label.trim();
    const description = draft.description.trim() || null;
    if (!label) return toast.error("Nome não pode ser vazio");
    if (label === f.label && description === (f.description ?? null)) {
      setEditingFunnel((p) => { const c = { ...p }; delete c[f.id]; return c; });
      return;
    }
    await updateFunnel(f.id, { label, description });
    setEditingFunnel((p) => { const c = { ...p }; delete c[f.id]; return c; });
    toast.success("Funil atualizado");
  }

  async function moveFunnel(f: PipelineFunnelRow, dir: -1 | 1) {
    const idx = funnels.findIndex((x) => x.id === f.id);
    const swap = funnels[idx + dir];
    if (!swap) return;
    const tmp = -1000 - idx;
    await (supabase as any).from("pipeline_funnels").update({ position: tmp }).eq("id", f.id);
    await (supabase as any).from("pipeline_funnels").update({ position: f.position }).eq("id", swap.id);
    await (supabase as any).from("pipeline_funnels").update({ position: swap.position }).eq("id", f.id);
    invalidate();
  }

  async function doDeleteFunnel(f: PipelineFunnelRow) {
    const { error } = await (supabase as any).from("pipeline_funnels").delete().eq("id", f.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Funil excluído");
      invalidate();
    }
    setConfirmDeleteFunnel(null);
  }

  // ============ Stage ops ============
  async function createStage() {
    const name = newName.trim();
    if (!name) return toast.error("Informe o nome da etapa");
    const funnelId = newFunnelId || funnels[0]?.id;
    if (!funnelId) return toast.error("Nenhum funil disponível — crie um funil primeiro");
    setBusy(true);
    const maxPos = stages.reduce((m, s) => Math.max(m, s.position), -1);
    const { error } = await (supabase.from("pipeline_stages").insert({
      name,
      color: newColor,
      position: maxPos + 1,
      is_active: true,
      funnel_id: funnelId,
    } as any) as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Etapa criada");
    setNewName("");
    setNewColor("blue");
    invalidate();
  }

  async function updateStage(id: string, patch: Partial<Stage>) {
    const { error } = await (supabase.from("pipeline_stages").update(patch as any).eq("id", id) as any);
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
            <DialogTitle>Gerenciar funis e etapas</DialogTitle>
          </DialogHeader>

          {/* ============ Funis ============ */}
          <div className="space-y-2 border-b border-border pb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerenciar funis</h3>
            {funnelsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-1.5">
                {funnels.map((f, i) => {
                  const isEditing = editingFunnel[f.id] !== undefined;
                  return (
                    <div key={f.id} className="rounded-md border border-border/60 bg-card/40 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isEditing ? (
                          <Input
                            value={editingFunnel[f.id].label}
                            onChange={(e) => setEditingFunnel((p) => ({ ...p, [f.id]: { ...p[f.id], label: e.target.value } }))}
                            className="h-8 flex-1 min-w-[140px]"
                            autoFocus
                          />
                        ) : (
                          <button
                            className="flex-1 min-w-[140px] text-left text-sm font-medium hover:underline"
                            onClick={() => setEditingFunnel((p) => ({ ...p, [f.id]: { label: f.label, description: f.description || "" } }))}
                          >
                            {f.label}
                            <span className="ml-2 text-[10px] text-muted-foreground font-normal">/{f.slug}</span>
                          </button>
                        )}
                        {f.is_system && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">(sistema)</Badge>
                        )}
                        {isEditing && (
                          <Button size="sm" variant="ghost" onClick={() => saveFunnelLabel(f)} className="h-8">
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveFunnel(f, -1)}>
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === funnels.length - 1} onClick={() => moveFunnel(f, 1)}>
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">Ativo</span>
                          <Switch
                            checked={f.is_active}
                            onCheckedChange={(v) => updateFunnel(f.id, { is_active: v })}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-rose-400 hover:text-rose-300"
                          onClick={() => setConfirmDeleteFunnel(f)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {isEditing && (
                        <Input
                          value={editingFunnel[f.id].description}
                          onChange={(e) => setEditingFunnel((p) => ({ ...p, [f.id]: { ...p[f.id], description: e.target.value } }))}
                          placeholder="Descrição (opcional)"
                          className="h-8"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Input
                placeholder="Nome do novo funil"
                value={newFunnelLabel}
                onChange={(e) => setNewFunnelLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createFunnel()}
                className="h-9 flex-1"
              />
              <Button onClick={createFunnel} disabled={busy} className="gap-1.5" size="sm">
                <Plus className="w-4 h-4" /> Criar funil
              </Button>
            </div>
          </div>

          {/* ============ Etapas por funil ============ */}
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            funnels.map((f) => {
              const funnelStages = stages.filter((s) => s.funnel_id === f.id);
              return (
                <div key={f.id} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3">
                    Etapas · {f.label}
                  </h3>
                  {funnelStages.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic pl-2">Nenhuma etapa neste funil.</p>
                  ) : (
                    funnelStages.map((s, i) => {
                      const c = stageColor(s.color);
                      const isEditing = editing[s.id] !== undefined;
                      return (
                        <div key={s.id} className={cn("rounded-md border p-3 space-y-2", c.border, c.bg)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={cn("w-3 h-3 rounded-full shrink-0", c.dot)} />
                            {isEditing ? (
                              <Input
                                value={editing[s.id].name}
                                onChange={(e) => setEditing((p) => ({ ...p, [s.id]: { name: e.target.value } }))}
                                className="h-8 flex-1 min-w-[140px]"
                                autoFocus
                              />
                            ) : (
                              <button
                                className="flex-1 min-w-[140px] text-left text-sm font-medium hover:underline"
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
                            <Select value={s.funnel_id} onValueChange={(v) => updateStage(s.id, { funnel_id: v })}>
                              <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {funnels.map((ff) => (
                                  <SelectItem key={ff.id} value={ff.id}>{ff.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(s, -1)}>
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === funnelStages.length - 1} onClick={() => move(s, 1)}>
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
              );
            })
          )}

          {/* Criar nova etapa */}
          <div className="rounded-md border border-dashed p-3 space-y-2 mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova etapa</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Nome da etapa"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createStage()}
                className="h-9 flex-1 min-w-[160px]"
              />
              <Select value={newFunnelId || funnels[0]?.id || ""} onValueChange={(v) => setNewFunnelId(v)}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Funil" /></SelectTrigger>
                <SelectContent>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>Funil · {f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <AlertDialog open={!!confirmDeleteFunnel} onOpenChange={(v) => !v && setConfirmDeleteFunnel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil "{confirmDeleteFunnel?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Funis de sistema ou com etapas vinculadas não podem ser excluídos — a operação falhará caso alguma dessas condições seja verdadeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteFunnel && doDeleteFunnel(confirmDeleteFunnel)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
