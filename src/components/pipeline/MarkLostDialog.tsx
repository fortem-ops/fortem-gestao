import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const MOTIVOS_SUGERIDOS = ["Sem retorno", "Preço", "Concorrente", "Mudou de cidade", "Sem interesse", "Outro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
  alunoNome: string;
  /** Stage de destino: "Aluno perdido" para prospects, "Aluno inativo" para aluno. */
  destinoStage: string;
}

export function MarkLostDialog({ open, onOpenChange, alunoId, alunoNome, destinoStage }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const m = motivo.trim();
    if (!m) return toast.error("Informe o motivo da perda");
    setBusy(true);
    const { error: e1 } = await supabase.from("alunos").update({ motivo_perda: m } as any).eq("id", alunoId);
    if (e1) { setBusy(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: alunoId,
      _to_stage_name: destinoStage,
      _source: "manual",
      _notes: `Perdido: ${m}`,
      _moved_by: user?.id ?? null,
    } as any);
    setBusy(false);
    if (e2) return toast.error(e2.message);
    toast.success("Marcado como perdido");
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar {alunoNome} como perdido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Motivo *</label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo..." />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_SUGERIDOS.map((m) => (
              <Badge key={m} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setMotivo(m)}>
                {m}
              </Badge>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} variant="destructive">Confirmar perda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
