import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const MOTIVOS = ["Preço", "Sem tempo", "Escolheu concorrente", "Não respondeu", "Outro"] as const;

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
  const [motivo, setMotivo] = useState<string>("");
  const [detalhe, setDetalhe] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!motivo) return toast.error("Selecione o motivo da perda");
    const finalMotivo = motivo === "Outro" ? detalhe.trim() : motivo;
    if (motivo === "Outro" && !finalMotivo) return toast.error("Descreva o motivo");
    setBusy(true);
    const { error: e1 } = await supabase.from("alunos").update({ motivo_perda: finalMotivo } as any).eq("id", alunoId);
    if (e1) { setBusy(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: alunoId,
      _to_stage_name: destinoStage,
      _source: "manual",
      _notes: `Perdido: ${finalMotivo}`,
      _moved_by: user?.id ?? null,
    } as any);
    setBusy(false);
    if (e2) return toast.error(e2.message);
    toast.success("Marcado como perdido");
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    qc.invalidateQueries({ queryKey: ["pipeline-last-moves"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar {alunoNome} como perdido</DialogTitle>
          <DialogDescription>
            Selecione o motivo. Ele será gravado no histórico do lead e ficará visível no card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {motivo === "Outro" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descreva *</Label>
              <Textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={3} placeholder="Detalhe o motivo..." />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} variant="destructive">Confirmar perda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
