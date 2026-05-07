import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLead, findAlunoByPhone, type OrigemLead } from "@/lib/leads";
import { useLeadOrigens } from "@/hooks/useLeadOrigens";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewLeadDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: origens = [] } = useLeadOrigens();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [origem, setOrigem] = useState<OrigemLead | "">("");
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; nome: string } | null>(null);

  function reset() {
    setNome(""); setTelefone(""); setOrigem(""); setDuplicate(null);
  }

  async function handleSave(force = false) {
    if (!nome.trim() || !telefone.trim() || !origem) {
      toast.error("Preencha nome, telefone e origem");
      return;
    }
    setSaving(true);
    try {
      if (!force) {
        const existing = await findAlunoByPhone(telefone);
        if (existing) {
          setDuplicate(existing);
          setSaving(false);
          return;
        }
      }
      await createLead({ nome, telefone, origem: origem as OrigemLead, responsavel_id: user?.id ?? null });
      toast.success("Lead criado");
      qc.invalidateQueries({ queryKey: ["leads-list"] });
      qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
          <DialogDescription>Captura rápida — leva até 15 segundos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maria Silva" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone *</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Como conheceu? *</Label>
            <Select value={origem} onValueChange={(v) => setOrigem(v as OrigemLead)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ORIGEM_LEAD_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {duplicate && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-semibold text-amber-300">Cadastro existente</p>
              <p className="text-muted-foreground mt-1">
                Já existe um cadastro com este telefone: <strong>{duplicate.nome}</strong>.
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/alunos/${duplicate.id}`)}>
                  Abrir cadastro
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleSave(true)} disabled={saving}>
                  Criar mesmo assim
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving ? "Salvando..." : "Criar Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
