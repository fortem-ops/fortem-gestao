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
  /** Necessário quando `permitirCriacao` está ativo e ainda não existe jornada. */
  usuarioId?: string;
  /** Quando true e `jornadaId` é null, cria a jornada antes de aplicar o ajuste. */
  permitirCriacao?: boolean;
}

const CAMPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  intervalo_inicio: "Intervalo início",
  intervalo_fim: "Intervalo fim",
  saida: "Saída",
};

/** Coordenador ajusta um horário de jornada com motivo obrigatório. */
export function AjustarJornadaDialog({
  open,
  onOpenChange,
  jornadaId,
  professorNome,
  data,
  usuarioId,
  permitirCriacao = false,
}: Props) {
  const qc = useQueryClient();
  const [campo, setCampo] = useState<string>("entrada");
  const [hora, setHora] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");

  const criando = !jornadaId && permitirCriacao;

  const mut = useMutation({
    mutationFn: async () => {
      if (!hora) throw new Error("Informe o horário");
      if (motivo.trim().length < 10) throw new Error("Motivo obrigatório (mín. 10 caracteres)");

      let idAlvo = jornadaId;

      if (!idAlvo) {
        if (!permitirCriacao || !usuarioId) throw new Error("Jornada inexistente");
        const { data: novoId, error: errCriar } = await supabase.rpc(
          "fn_ponto_criar_jornada_manual" as any,
          { _user_id: usuarioId, _data: data, _motivo: motivo },
        );
        if (errCriar) throw errCriar;
        idAlvo = novoId as unknown as string;
      }

      const novoTs = new Date(`${data}T${hora}:00`).toISOString();
      const { error } = await supabase.rpc("fn_ponto_ajustar_jornada", {
        _jornada_id: idAlvo!,
        _campo: campo,
        _novo_valor: novoTs,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(criando ? "Ponto registrado" : "Ajuste registrado", {
        description: "A alteração foi gravada no log de auditoria.",
      });
      qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && (k.startsWith("relatorio-") || k.startsWith("ponto-"));
        },
        refetchType: "active",
      });
      onOpenChange(false);
      setMotivo("");
      setHora("");
    },
    onError: (e: any) => toast.error("Falha ao salvar", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{criando ? "Registrar ponto retroativo" : "Ajustar jornada"}</DialogTitle>
          <DialogDescription>
            {professorNome} — {data ? new Date(data + "T00:00").toLocaleDateString("pt-BR") : ""}.
            {criando
              ? " Nenhum ponto foi batido neste dia. A jornada será criada com o horário informado."
              : " Toda alteração é auditada."}
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
              <Label>{criando ? "Horário" : "Novo horário"}</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Motivo (obrigatório)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                criando
                  ? "Ex.: professor esqueceu de bater o ponto neste dia."
                  : "Ex.: professor esqueceu de bater a saída."
              }
              rows={3}
            />
          </div>

          {criando && (
            <p className="text-xs text-muted-foreground">
              Dica: registre primeiro a <strong>Entrada</strong>. Depois reabra o ajuste para informar saída e
              intervalo, se aplicável.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {criando ? "Registrar ponto" : "Salvar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
