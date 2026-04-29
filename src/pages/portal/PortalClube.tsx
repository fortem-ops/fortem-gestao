import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Card } from "@/components/ui/card";
import { Sparkles, Wallet } from "lucide-react";
import { MembershipCard } from "@/components/clube/MembershipCard";
import { PartnersList } from "@/components/clube/PartnersList";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function PortalClube() {
  const { student } = useStudentPortal();

  const { data: membro } = useQuery({
    queryKey: ["portal-membro", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_fortem_membros")
        .select("*")
        .eq("aluno_id", student!.id)
        .maybeSingle();
      return data as Tables<"clube_fortem_membros"> | null;
    },
  });

  if (!student) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-heading font-bold text-lg flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Clube FORTEM
      </h1>

      {!membro ? (
        <Card className="glass-card p-8 text-center text-sm text-muted-foreground">
          Você ainda não é membro do Clube FORTEM. Fale com seu professor.
        </Card>
      ) : (
        <>
          <MembershipCard membro={membro} alunoNome={student.nome} alunoEmail={student.email} />

          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Integração com Apple/Google Wallet em breve.")}
            >
              <Wallet className="w-4 h-4 mr-2" /> Adicionar à carteira
            </Button>
          </div>

          <section className="space-y-2" id="clube-tab-parceiros">
            <h2 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide">
              Parceiros & Benefícios
            </h2>
            <PartnersList nivelAluno={membro.nivel_membro} />
          </section>
        </>
      )}
    </div>
  );
}
