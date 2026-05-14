import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { EquipeAoVivoTable } from "@/components/ponto/EquipeAoVivoTable";
import { DashboardCoordenadorKPIs } from "@/components/ponto/DashboardCoordenadorKPIs";
import { AlertasPontoPanel } from "@/components/ponto/AlertasPontoPanel";

export default function PontoEquipe() {
  const { user, loading } = useAuth();

  const { data: isCoordAdmin, isLoading: checking } = useQuery({
    queryKey: ["ponto-equipe-access", user?.id],
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
          <Users2 className="w-6 h-6 text-primary" /> Ponto — Equipe ao vivo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe quem está em jornada, em intervalo ou pendente. Atualização em tempo real.
        </p>
      </header>
      <DashboardCoordenadorKPIs />
      <EquipeAoVivoTable />
      <AlertasPontoPanel />
    </div>
  );
}
