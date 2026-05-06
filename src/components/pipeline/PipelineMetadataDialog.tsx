import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  alunoId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

import { ORIGEM_LEAD_OPTIONS } from "@/lib/leads";
const ORIGEM_OPTIONS = ORIGEM_LEAD_OPTIONS;

export function PipelineMetadataDialog({ alunoId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    temperatura_lead: "",
    probabilidade_fechamento: "",
    origem_lead: "",
    valor_estimado_plano: "",
    data_prevista_fechamento: "",
    responsavel_comercial_id: "",
    next_followup_at: "",
  });

  const { data: existing } = useQuery({
    queryKey: ["pipeline-metadata", alunoId],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_metadata").select("*").eq("aluno_id", alunoId).maybeSingle();
      return data;
    },
    enabled: open,
  });

  const { data: professors = [] } = useQuery({
    queryKey: ["pipeline-meta-professors"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const ids = (roles || []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return (data || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        temperatura_lead: existing.temperatura_lead || "",
        probabilidade_fechamento: existing.probabilidade_fechamento?.toString() || "",
        origem_lead: existing.origem_lead || "",
        valor_estimado_plano: existing.valor_estimado_plano?.toString() || "",
        data_prevista_fechamento: existing.data_prevista_fechamento || "",
        responsavel_comercial_id: existing.responsavel_comercial_id || "",
        next_followup_at: existing.next_followup_at ? existing.next_followup_at.slice(0, 16) : "",
      });
    } else if (open) {
      setForm({ temperatura_lead: "", probabilidade_fechamento: "", origem_lead: "", valor_estimado_plano: "", data_prevista_fechamento: "", responsavel_comercial_id: "", next_followup_at: "" });
    }
  }, [existing, open]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = {
        aluno_id: alunoId,
        temperatura_lead: form.temperatura_lead || null,
        probabilidade_fechamento: form.probabilidade_fechamento ? Number(form.probabilidade_fechamento) : null,
        origem_lead: form.origem_lead || null,
        valor_estimado_plano: form.valor_estimado_plano ? Number(form.valor_estimado_plano) : null,
        data_prevista_fechamento: form.data_prevista_fechamento || null,
        responsavel_comercial_id: form.responsavel_comercial_id || null,
        next_followup_at: form.next_followup_at ? new Date(form.next_followup_at).toISOString() : null,
      };
      const { error } = await supabase.from("pipeline_metadata").upsert(payload, { onConflict: "aluno_id" });
      if (error) throw error;
      toast.success("Dados comerciais salvos");
      queryClient.invalidateQueries({ queryKey: ["pipeline-metadata"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-metadata", alunoId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Dados comerciais</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperatura</Label>
              <Select value={form.temperatura_lead || "none"} onValueChange={(v) => setForm({ ...form, temperatura_lead: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="frio">Frio</SelectItem>
                  <SelectItem value="morno">Morno</SelectItem>
                  <SelectItem value="quente">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Probabilidade (%)</Label>
              <Input type="number" min="0" max="100" value={form.probabilidade_fechamento}
                onChange={(e) => setForm({ ...form, probabilidade_fechamento: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.origem_lead || "none"} onValueChange={(v) => setForm({ ...form, origem_lead: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ORIGEM_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_estimado_plano}
                onChange={(e) => setForm({ ...form, valor_estimado_plano: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data prevista fechamento</Label>
              <Input type="date" value={form.data_prevista_fechamento}
                onChange={(e) => setForm({ ...form, data_prevista_fechamento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Próximo follow-up</Label>
              <Input type="datetime-local" value={form.next_followup_at}
                onChange={(e) => setForm({ ...form, next_followup_at: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Responsável comercial</Label>
            <Select value={form.responsavel_comercial_id || "none"} onValueChange={(v) => setForm({ ...form, responsavel_comercial_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {professors.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
