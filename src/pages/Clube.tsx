import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MembershipCard } from "@/components/clube/MembershipCard";
import { PartnersList } from "@/components/clube/PartnersList";
import { BenefitHistory } from "@/components/clube/BenefitHistory";
import { Sparkles } from "lucide-react";

/**
 * Página do Clube FORTEM (visão do aluno / professor que cuida do aluno).
 * Coordenadores podem trocar entre seus alunos via select.
 */
export default function Clube() {
  const { user } = useAuth();
  const [alunoId, setAlunoId] = useState<string>("");

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["clube-isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: alunosOpts = [] } = useQuery({
    queryKey: ["clube-alunos-membros", user?.id, isCoordAdmin],
    queryFn: async () => {
      const { data: membros } = await supabase
        .from("clube_fortem_membros")
        .select("aluno_id")
        .order("created_at", { ascending: false });
      const ids = (membros || []).map((m) => m.aluno_id);
      if (!ids.length) return [];

      let query = supabase.from("alunos").select("id, nome, responsavel_id").in("id", ids);
      if (!isCoordAdmin) query = query.eq("responsavel_id", user!.id);
      const { data } = await query.order("nome");
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!alunoId && alunosOpts.length > 0) setAlunoId(alunosOpts[0].id);
  }, [alunosOpts, alunoId]);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["clube-membro-ctx", alunoId],
    queryFn: async () => {
      const { data: membro } = await supabase
        .from("clube_fortem_membros")
        .select("*")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      const { data: aluno } = await supabase
        .from("alunos")
        .select("nome, email, telefone")
        .eq("id", alunoId)
        .single();
      return { membro, aluno };
    },
    enabled: !!alunoId,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Clube FORTEM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Carteirinha digital, parceiros e benefícios exclusivos.
          </p>
        </div>

        {alunosOpts.length > 0 && (
          <Select value={alunoId} onValueChange={setAlunoId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecione o aluno" />
            </SelectTrigger>
            <SelectContent>
              {alunosOpts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      {alunosOpts.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum aluno seu é membro do Clube FORTEM ainda.</p>
          <p className="text-xs mt-2">Coordenadores podem cadastrar membros pela área Admin → Clube.</p>
        </Card>
      ) : isLoading ? (
        <Skeleton className="h-[540px] w-full max-w-md mx-auto" />
      ) : !ctx?.membro ? (
        <Card className="p-10 text-center text-muted-foreground">Aluno sem associação ao Clube.</Card>
      ) : (
        <Tabs defaultValue="carteirinha" className="w-full">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="carteirinha">Carteirinha</TabsTrigger>
            <TabsTrigger value="parceiros" id="clube-tab-parceiros">Parceiros</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="carteirinha" className="pt-6">
            <MembershipCard
              membro={ctx.membro}
              alunoNome={ctx.aluno?.nome || "—"}
              alunoEmail={ctx.aluno?.email}
              contato={ctx.aluno?.telefone}
              categoria={ctx.membro.nivel_membro.toUpperCase()}
            />
          </TabsContent>

          <TabsContent value="parceiros" className="pt-6">
            <PartnersList nivelAluno={ctx.membro.nivel_membro} />
          </TabsContent>

          <TabsContent value="historico" className="pt-6">
            <BenefitHistory alunoId={alunoId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
