import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { ConvertToAlunoDialog } from "@/components/pipeline/ConvertToAlunoDialog";

interface Props {
  alunoId: string;
  alunoNome: string;
  variant?: "icon" | "compact" | "default";
  onConverted?: () => void;
}

export function ConvertToAlunoButton({ alunoId, alunoNome, variant = "default", onConverted }: Props) {
  const { data: roles } = useUserRoles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  if (!roles?.isCoordAdmin) return null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <span onPointerDown={stop} onClick={stop}>
      {variant === "icon" ? (
        <Button size="icon" variant="ghost" title="Converter em aluno ativo" onClick={() => setOpen(true)}>
          <GraduationCap className="w-4 h-4 text-primary" />
        </Button>
      ) : variant === "compact" ? (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => setOpen(true)}>
          <GraduationCap className="w-3 h-3" /> Aluno
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <GraduationCap className="w-4 h-4" /> Converter em aluno ativo
        </Button>
      )}
      {open && (
        <ConvertToAlunoDialog
          open={open}
          onOpenChange={setOpen}
          alunoId={alunoId}
          alunoNome={alunoNome}
          destinoStage="Aluno ativo"
          fullConvert
          onConverted={() => {
            for (const k of ["pipeline-last-moves", "leads-list", "student", "aluno", "alunos", "pipeline-history"]) {
              qc.invalidateQueries({ queryKey: [k] });
            }
            onConverted?.();
          }}
        />
      )}
    </span>
  );
}
