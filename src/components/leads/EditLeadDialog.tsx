import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useLeadOrigens } from "@/hooks/useLeadOrigens";

interface Props {
  alunoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EditLeadDialog({ alunoId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: origens = [] } = useLeadOrigens();
  const [form, setForm] = useState<{ nome: string; telefone: string; email: string; origem: string; created_at: Date | undefined }>({
    nome: "", telefone: "", email: "", origem: "", created_at: undefined,
  });
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["lead-edit", alunoId],
    queryFn: async () => {
      if (!alunoId) return null;
      const { data: a } = await supabase.from("alunos").select("nome,telefone,email,created_at").eq("id", alunoId).maybeSingle();
      const { data: m } = await supabase.from("pipeline_metadata").select("origem_lead").eq("aluno_id", alunoId).maybeSingle();
      return { ...a, origem: m?.origem_lead || "" };
    },
    enabled: !!alunoId && open,
  });

  useEffect(() => {
    if (data) {
      setForm({
        nome: data.nome || "",
        telefone: data.telefone || "",
        email: data.email || "",
        origem: data.origem || "",
        created_at: data.created_at ? new Date(data.created_at) : undefined,
      });
    }
  }, [data]);

  async function save() {
    if (!alunoId) return;
    setSaving(true);
    try {
      const update: any = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
      };
      if (form.created_at) update.created_at = form.created_at.toISOString();
      const { error } = await supabase.from("alunos").update(update).eq("id", alunoId);
      if (error) throw error;
      if (form.origem) {
        await supabase.from("pipeline_metadata").upsert(
          { aluno_id: alunoId, origem_lead: form.origem },
          { onConflict: "aluno_id" }
        );
      }
      toast.success("Lead atualizado");
      qc.invalidateQueries({ queryKey: ["leads-list"] });
      qc.invalidateQueries({ queryKey: ["prospects-list"] });
      qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>Editar dados</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de cadastro</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !form.created_at && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.created_at ? format(form.created_at, "dd/MM/yyyy") : "Selecionar..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.created_at}
                  onSelect={(d) => setForm({ ...form, created_at: d })}
                  locale={ptBR}
                  disabled={(d) => d > new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>Como conheceu?</Label>
            <Select value={form.origem || "none"} onValueChange={(v) => setForm({ ...form, origem: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {origens.map((o) => <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
