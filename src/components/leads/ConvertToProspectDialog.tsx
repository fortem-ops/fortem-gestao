import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEXO_OPTIONS, convertLeadToProspect, type OrigemLead } from "@/lib/leads";
import { useLeadOrigens } from "@/hooks/useLeadOrigens";

interface Props {
  alunoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ConvertToProspectDialog({ alunoId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data_nascimento: "",
    email: "",
    sexo: "",
    origem: "" as OrigemLead | "",
    limitacoes: "",
    atividade_fisica: "",
    objetivo_treinamento: "",
  });

  const { data } = useQuery({
    queryKey: ["convert-lead", alunoId],
    queryFn: async () => {
      if (!alunoId) return null;
      const { data: a } = await supabase
        .from("alunos")
        .select("nome,telefone,email,data_nascimento,sexo")
        .eq("id", alunoId)
        .maybeSingle();
      const { data: m } = await supabase
        .from("pipeline_metadata")
        .select("origem_lead")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      const { data: an } = await supabase
        .from("prospect_anamnese" as any)
        .select("limitacoes,atividade_fisica,objetivo_treinamento")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      return { aluno: a, meta: m, anamnese: an };
    },
    enabled: !!alunoId && open,
  });

  useEffect(() => {
    if (data) {
      const an = (data.anamnese as any) || {};
      setForm({
        data_nascimento: data.aluno?.data_nascimento || "",
        email: data.aluno?.email || "",
        sexo: data.aluno?.sexo || "",
        origem: (data.meta?.origem_lead as OrigemLead) || "",
        limitacoes: an.limitacoes || "",
        atividade_fisica: an.atividade_fisica || "",
        objetivo_treinamento: an.objetivo_treinamento || "",
      });
    }
  }, [data]);

  async function save() {
    if (!alunoId) return;
    if (!form.data_nascimento || !form.email.trim() || !form.sexo || !form.origem ||
        !form.limitacoes.trim() || !form.atividade_fisica.trim() || !form.objetivo_treinamento.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await convertLeadToProspect({
        alunoId,
        data_nascimento: form.data_nascimento,
        email: form.email.trim(),
        sexo: form.sexo,
        origem: form.origem as OrigemLead,
        limitacoes: form.limitacoes.trim(),
        atividade_fisica: form.atividade_fisica.trim(),
        objetivo_treinamento: form.objetivo_treinamento.trim(),
      });
      toast.success("Convertido em Prospect");
      qc.invalidateQueries({ queryKey: ["leads-list"] });
      qc.invalidateQueries({ queryKey: ["prospects-list"] });
      qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
      qc.invalidateQueries({ queryKey: ["pipeline-last-moves"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao converter");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter em Prospect</DialogTitle>
          <DialogDescription>Complete os dados qualificados e a anamnese inicial.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de nascimento *</Label>
              <Input type="date" value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo *</Label>
              <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {SEXO_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Como conheceu? *</Label>
            <Select value={form.origem || ""} onValueChange={(v) => setForm({ ...form, origem: v as OrigemLead })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ORIGEM_LEAD_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Anamnese inicial</p>
            <div className="space-y-1.5">
              <Label>Limitações de movimento, patologias, dores ou lesões? *</Label>
              <Textarea rows={2} value={form.limitacoes}
                onChange={(e) => setForm({ ...form, limitacoes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pratica atividade física? Se sim, qual? Se não, há quanto tempo está parado(a)? *</Label>
              <Textarea rows={2} value={form.atividade_fisica}
                onChange={(e) => setForm({ ...form, atividade_fisica: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Qual é o objetivo com o treinamento funcional? *</Label>
              <Textarea rows={2} value={form.objetivo_treinamento}
                onChange={(e) => setForm({ ...form, objetivo_treinamento: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Convertendo..." : "Converter em Prospect"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
