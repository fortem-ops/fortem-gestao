import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { MembershipCard } from "@/components/clube/MembershipCard";
import { BenefitHistory } from "@/components/clube/BenefitHistory";
import { hashCpfClient, isValidCpf, formatCpfMask, NIVEL_LABEL, type NivelMembro } from "@/lib/clube";
import { Sparkles, UserPlus } from "lucide-react";

const NIVEIS: NivelMembro[] = ["start", "start_plus", "power", "pro", "max"];

interface Props {
  student: { id: string; nome: string; email?: string | null; telefone?: string | null };
}

export function StudentClubePanel({ student }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [cpf, setCpf] = useState("");
  const [nivel, setNivel] = useState<NivelMembro>("start");

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["clube-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

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

  async function criarMembro() {
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setCreating(true);
    try {
      const cpf_hash = await hashCpfClient(cpf);
      // fortem_id é gerado pelo trigger fn_clube_generate_fortem_id; passa string vazia
      const { error } = await supabase.from("clube_fortem_membros").insert({
        aluno_id: student.id,
        cpf_hash,
        nivel_membro: nivel,
        fortem_id: "",
      });
      if (error) throw error;
      toast.success("Aluno associado ao Clube FORTEM!");
      qc.invalidateQueries({ queryKey: ["student-clube-membro", student.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (isLoading) return <Skeleton className="h-96" />;

  if (!membro) {
    return (
      <Card className="p-6 max-w-xl mx-auto">
        <div className="text-center mb-6">
          <Sparkles className="w-10 h-10 mx-auto text-primary mb-2 opacity-70" />
          <h3 className="font-semibold">Aluno ainda não é membro do Clube FORTEM</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Associe ao Clube para gerar carteirinha digital e benefícios.
          </p>
        </div>

        {isCoordAdmin ? (
          <div className="space-y-3">
            <div>
              <Label>CPF do aluno</Label>
              <Input
                value={formatCpfMask(cpf)}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div>
              <Label>Nível inicial</Label>
              <Select value={nivel} onValueChange={(v) => setNivel(v as NivelMembro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEIS.map((n) => (
                    <SelectItem key={n} value={n}>{NIVEL_LABEL[n]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gap-2" onClick={criarMembro} disabled={creating}>
              <UserPlus className="w-4 h-4" />
              {creating ? "Criando..." : "Criar membro"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground">
            Apenas coordenadores podem associar alunos ao Clube.
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{membro.fortem_id}</Badge>
        <Badge variant="outline">{NIVEL_LABEL[membro.nivel_membro]}</Badge>
      </div>

      <MembershipCard
        membro={membro}
        alunoNome={student.nome}
        alunoEmail={student.email}
        contato={student.telefone}
      />

      <div>
        <h4 className="font-semibold mb-3 mt-8">Histórico de uso</h4>
        <BenefitHistory alunoId={student.id} />
      </div>
    </div>
  );
}
