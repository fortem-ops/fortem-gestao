import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  alunoId: string;
  alunoNome: string;
  /** "icon" = botão só com ícone; "compact" = botão pequeno do card do funil; "default" = botão normal */
  variant?: "icon" | "compact" | "default";
  onConverted?: () => void;
}

export function ConvertToAvulsoButton({ alunoId, alunoNome, variant = "default", onConverted }: Props) {
  const { data: roles } = useUserRoles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  if (!roles?.isCoordAdmin && !roles?.isNutriFisio) return null;

  async function confirmar() {
    setSaving(true);
    const { error } = await supabase.rpc("fn_converter_em_avulso" as any, {
      _aluno_id: alunoId,
      _observacao: obs.trim().slice(0, 500) || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao converter"); return; }
    toast.success(`${alunoNome} agora é cliente avulso`);
    for (const k of ["pipeline-alunos", "pipeline-last-moves", "leads-list", "prospects-list", "clientes-avulsos", "student", "aluno", "alunos"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
    setOpen(false);
    setObs("");
    onConverted?.();
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      {variant === "icon" ? (
        <Button size="icon" variant="ghost" title="Converter em cliente avulso" onClick={() => setOpen(true)}>
          <UserCheck className="w-4 h-4 text-sky-400" />
        </Button>
      ) : variant === "compact" ? (
        <Button
          size="sm" variant="outline"
          className="h-6 px-2 text-[10px] gap-1 border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
          onPointerDown={stop}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          <UserCheck className="w-3 h-3" /> Avulso
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <UserCheck className="w-4 h-4" /> Converter em cliente avulso
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onPointerDown={stop} onClick={stop}>
          <DialogHeader>
            <DialogTitle>Converter {alunoNome} em cliente avulso</DialogTitle>
            <DialogDescription>
              O cadastro sai do funil comercial e passa para Clientes Avulsos. Dados, histórico e anamnese são mantidos.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            maxLength={500}
            placeholder="Observação (opcional) — ex.: só quer Nutrição"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={confirmar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
