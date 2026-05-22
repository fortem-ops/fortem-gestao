import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
  alunoNome: string;
}

export function NaoConversaoDialog({ open, onOpenChange, alunoId, alunoNome }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [motivoId, setMotivoId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: motivos = [], refetch } = useQuery({
    queryKey: ["prospect-nao-conv-motivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_nao_conversao_motivos" as any)
        .select("id,nome,ordem,ativo")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    if (!open) {
      setMotivoId("");
      setAddOpen(false);
      setNovoNome("");
    }
  }, [open]);

  async function adicionarMotivo() {
    const nome = novoNome.trim();
    if (!nome) return toast.error("Informe o nome do motivo");
    setBusy(true);
    const { data, error } = await supabase
      .from("prospect_nao_conversao_motivos" as any)
      .insert({ nome, ordem: (motivos[motivos.length - 1]?.ordem ?? 0) + 1, created_by: user?.id ?? null })
      .select("id,nome")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    await refetch();
    setMotivoId((data as any).id);
    setNovoNome("");
    setAddOpen(false);
    toast.success("Motivo adicionado");
  }

  async function confirmar() {
    if (!motivoId) return toast.error("Selecione um motivo");
    const motivo = motivos.find((m) => m.id === motivoId);
    if (!motivo) return;
    setBusy(true);
    const { error: e1 } = await supabase
      .from("alunos")
      .update({ motivo_perda: motivo.nome } as any)
      .eq("id", alunoId);
    setBusy(false);
    if (e1) return toast.error(e1.message);
    toast.success("Marcado como não conversão");
    qc.invalidateQueries({ queryKey: ["prospects-list"] });
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Não conversão — {alunoNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Motivo *</Label>
            <RadioGroup value={motivoId} onValueChange={setMotivoId} className="mt-2 space-y-2">
              {motivos.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <RadioGroupItem value={m.id} id={`motivo-${m.id}`} />
                  <Label htmlFor={`motivo-${m.id}`} className="font-normal cursor-pointer">{m.nome}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {addOpen ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Novo motivo</Label>
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Mudou de cidade"
                  autoFocus
                />
              </div>
              <Button onClick={adicionarMotivo} disabled={busy} size="sm">Salvar</Button>
              <Button onClick={() => { setAddOpen(false); setNovoNome(""); }} size="sm" variant="ghost">Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar motivo
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={busy || !motivoId}>Confirmar não conversão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
