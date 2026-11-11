import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCancelamentoMotivos } from "@/hooks/useCancelamentoMotivos";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import { podeCancelarSemestral } from "@/lib/semestral";

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const db = supabase as unknown as Rpc;

/** Cancelamento do Plano Semestral (só admin; o servidor confere de novo): sem multa, acesso até o fim do ciclo pago. */
export function CancelarSemestral({ planoId, alunoId, isAdmin }: { planoId: string; alunoId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivoId, setMotivoId] = useState("");
  const { data: motivos = [] } = useCancelamentoMotivos();
  const { data: contrato } = useQuery({
    queryKey: ["semestral-contrato", planoId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("contratos").select("id,plano_tipo,status,data_cancelamento,data_fim")
        .eq("plano_id", planoId).eq("plano_tipo", "semestral_2027").maybeSingle();
      return data;
    },
  });
  const cancelar = useMutation({
    mutationFn: async () => {
      const motivo = motivos.find((m) => m.id === motivoId)?.nome ?? "";
      const { data, error } = await db.rpc("fn_semestral_cancelar", { p_contrato: contrato?.id, p_motivo: motivo });
      if (error) throw new Error(error.message);
      return data as { acesso_ate?: string };
    },
    onSuccess: (r) => {
      toast.success(`Plano Semestral cancelado sem multa. Acesso até ${r.acesso_ate ? r.acesso_ate.split("-").reverse().join("/") : "o fim do ciclo pago"}.`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["semestral-contrato", planoId] });
      qc.invalidateQueries({ queryKey: ["contratos", alunoId] });
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      invalidatePlanoCaches(qc, alunoId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!podeCancelarSemestral(isAdmin, contrato)) return null;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">Cancelar Plano Semestral</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar o Plano Semestral?</AlertDialogTitle>
          <AlertDialogDescription>
            Sem multa. As mensalidades futuras são canceladas e a cobrança automática para. O aluno mantém o acesso até o fim do ciclo pago.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label>Motivo do cancelamento</Label>
          <RadioGroup value={motivoId} onValueChange={setMotivoId} className="space-y-1.5">
            {motivos.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <RadioGroupItem value={m.id} id={`sem-mot-${m.id}`} />
                <Label htmlFor={`sem-mot-${m.id}`} className="text-sm font-normal">{m.nome}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <Button variant="destructive" disabled={!motivoId || cancelar.isPending} onClick={() => cancelar.mutate()}>
            {cancelar.isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
