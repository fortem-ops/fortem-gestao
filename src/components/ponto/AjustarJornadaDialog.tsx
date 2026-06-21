import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jornadaId: string | null;
  professorNome: string;
  data: string;
}

const CAMPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  intervalo_inicio: "Intervalo início",
  intervalo_fim: "Intervalo fim",
  saida: "Saída",
};

/** Coordenador ajusta um horário de jornada com motivo obrigatório. */
export function AjustarJornadaDialog({ open, onOpenChange, jornadaId, professorNome, data }: Props) {
  const qc = useQueryClient();
  const [campo, setCampo] = useState<string>("entrada");
  const [hora, setHora] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!jornadaId) throw new Error("Jornada inexistente");
      if (!hora) throw new Error("Informe o horário");
      if (motivo.trim().length < 3) throw new Error("Motivo obrigatório (mín. 3 caracteres)");
      const novoTs = new Date(`${data}T${hora}:00`).toISOString();
      const { error } = await supabase.rpc("fn_ponto_ajustar_jornada", {
        _jornada_id: jornadaId,
        _campo: campo,
        _novo_valor: novoTs,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajuste registrado", { description: "A alteração foi gravada no log de auditoria." });
      qc.invalidateQueries({ queryKey: ["ponto-equipe"] });
      qc.invalidateQueries({ queryKey: ["ponto-fechamento-mes"] });
      onOpenChange(false);
      setMotivo("");
      setHora("");
    },
    onError: (e: any) => toast.error("Falha ao ajustar", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar jornada</DialogTitle>
          <DialogDescription>
            {professorNome} — {new Date(data + "T00:00").toLocaleDateString("pt-BR")}. Toda alteração é auditada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Campo</Label>
              <Select value={campo} onValueChange={setCampo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMPO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Novo horário</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Motivo (obrigatório)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: professor esqueceu de bater a saída."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Salvar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
