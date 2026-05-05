import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface ReschedTask {
  id: string;
  descricao: string | null;
  data_limite: string | null;
}

export function RescheduleDialog({ task, onDone }: { task: ReschedTask; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(task.data_limite || "");
  const [motivo, setMotivo] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];

  const mut = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Data obrigatória");
      if (motivo.trim().length < 5) throw new Error("Motivo deve ter ao menos 5 caracteres");
      if (data < todayStr) throw new Error("Data não pode ser no passado");
      const stamp = new Date().toLocaleDateString("pt-BR");
      const novaDescricao = `${task.descricao || ""}\n\n[Reagendado em ${stamp}]: ${motivo.trim()}`.trim();
      const { error } = await supabase
        .from("tarefas")
        .update({ data_limite: data, descricao: novaDescricao })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa reagendada");
      setOpen(false);
      setMotivo("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao reagendar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
          Reagendar
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Reagendar tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nova data limite</Label>
            <Input type="date" min={todayStr} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Motivo (obrigatório)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do reagendamento..."
              rows={3}
            />
          </div>
          <Button className="w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
            Confirmar reagendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
