import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheck2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { FechamentoMensalTable } from "@/components/ponto/FechamentoMensalTable";

export default function PontoFechamento() {
  const { user, loading } = useAuth();

  const { data: isCoordAdmin, isLoading: checking } = useQuery({
    queryKey: ["ponto-fechamento-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  if (loading || checking) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isCoordAdmin) {
    return <Card className="p-10 text-center text-muted-foreground">Acesso restrito a coordenadores e administradores.</Card>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FileCheck2 className="w-6 h-6 text-primary" /> Fechamento mensal — Ponto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revise pendências, recalcule horas e aprove o fechamento de cada professor. Após aprovado, os registros ficam bloqueados.
        </p>
      </header>
      <FechamentoMensalTable />
    </div>
  );
}
