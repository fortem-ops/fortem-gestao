import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MembershipCard } from "@/components/clube/MembershipCard";
import { BenefitHistory } from "@/components/clube/BenefitHistory";
import { NIVEL_LABEL, STATUS_LABEL } from "@/lib/clube";
import { Sparkles } from "lucide-react";

interface Props {
  student: { id: string; nome: string; email?: string | null; telefone?: string | null };
}

/**
 * Painel do Clube FORTEM dentro do perfil do aluno.
 * Membership é automática — criada/atualizada por triggers no banco a partir de
 * `alunos` e `planos`. Aqui apenas exibimos a carteirinha e o histórico.
 */
export function StudentClubePanel({ student }: Props) {
  const { data: membro, isLoading } = useQuery({
    queryKey: ["student-clube-membro", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_fortem_membros")
        .select("*")
        .eq("aluno_id", student.id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;

  if (!membro) {
    return (
      <Card className="p-6 max-w-xl mx-auto text-center">
        <Sparkles className="w-10 h-10 mx-auto text-primary mb-2 opacity-70" />
        <h3 className="font-semibold">Carteirinha sendo gerada…</h3>
        <p className="text-sm text-muted-foreground mt-1">
          A associação ao Clube FORTEM é automática. Atualize a página em alguns instantes.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground flex-wrap">
        <Badge variant="outline">{membro.fortem_id}</Badge>
        <Badge variant="outline">{NIVEL_LABEL[membro.nivel_membro]}</Badge>
        <Badge variant={membro.status_membro === "ativo" ? "default" : "secondary"}>
          {STATUS_LABEL[membro.status_membro]}
        </Badge>
      </div>

      <MembershipCard
        membro={membro}
        alunoNome={student.nome}
        alunoEmail={student.email}
        contato={student.telefone}
      />

      {membro.nivel_membro === "agregador" && (
        <Card className="p-4 text-xs text-center text-muted-foreground border-dashed">
          Alunos com plano <strong>Gympass/Wellhub</strong> ou <strong>Total Pass</strong> são membros <strong>Agregador</strong> e não recebem benefícios do Clube FORTEM.
        </Card>
      )}

      <div>
        <h4 className="font-semibold mb-3 mt-8">Histórico de uso</h4>
        <BenefitHistory alunoId={student.id} />
      </div>
    </div>
  );
}
