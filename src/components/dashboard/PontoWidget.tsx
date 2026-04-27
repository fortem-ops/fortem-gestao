import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { formatMinutes, type PontoEstado } from "@/lib/ponto";

interface EstadoAtual {
  status: PontoEstado;
  entrada: string | null;
  minutos_trabalhados: number | null;
}

interface DashCoord {
  resumo: { ativos: number; em_intervalo: number; nao_iniciaram: number; inconsistencias: number };
}

/** Widget compacto do módulo Ponto: visão de professor ou de coordenador. */
export function PontoWidget() {
  const { user } = useAuth();

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["ponto-widget-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: estado, isLoading: loadingEstado } = useQuery({
    queryKey: ["ponto-widget", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("fn_ponto_estado_atual", { _user_id: user!.id });
      return data as unknown as EstadoAtual;
    },
    enabled: !!user && !isCoordAdmin,
  });

  const { data: dashCoord, isLoading: loadingCoord } = useQuery({
    queryKey: ["ponto-widget-coord"],
    queryFn: async () => {
      const { data } = await supabase.rpc("fn_ponto_dashboard_coordenador", { _data: new Date().toISOString().slice(0, 10) });
      return data as unknown as DashCoord;
    },
    enabled: !!isCoordAdmin,
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Ponto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isCoordAdmin ? (
          loadingCoord || !dashCoord ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Em jornada</span><span className="font-semibold text-success">{dashCoord.resumo.ativos}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Em intervalo</span><span className="font-semibold text-warning">{dashCoord.resumo.em_intervalo}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Não iniciaram</span><span className="font-semibold text-destructive">{dashCoord.resumo.nao_iniciaram}</span></div>
              <Link to="/ponto/equipe" className="text-xs text-primary hover:underline block pt-1">Ver equipe ao vivo →</Link>
            </div>
          )
        ) : loadingEstado || !estado ? (
          <Skeleton className="h-16" />
        ) : estado.status === "em_jornada" || estado.status === "em_intervalo" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-success animate-pulse" />
              <span className="text-muted-foreground">{estado.status === "em_intervalo" ? "Em intervalo" : "Em jornada"}</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatMinutes(estado.minutos_trabalhados ?? 0)}</p>
            <Link to="/ponto" className="text-xs text-primary hover:underline">Abrir Ponto →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {estado.status === "encerrada" ? "Jornada encerrada hoje" : "Você ainda não bateu o ponto hoje"}
            </p>
            <Link to="/ponto" className="text-xs text-primary hover:underline">Abrir Ponto →</Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
