import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardData {
  usos_periodo: number;
  usos_hoje: number;
  membros_ativos: number;
  taxa_ativacao: number;
  beneficio_top?: string;
}

/**
 * Widget compacto do Clube FORTEM no Dashboard.
 */
export function ClubeWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["clube-widget"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_clube_dashboard", { _periodo_dias: 30 });
      if (error) throw error;
      return data as unknown as DashboardData;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Clube FORTEM
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !data ? (
          <Skeleton className="h-20" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={Users} label="Membros" value={data.membros_ativos} />
              <Stat icon={TrendingUp} label="Usos (30d)" value={data.usos_periodo} />
            </div>
            <div className="text-xs text-muted-foreground border-t pt-3">
              <span className="block">Hoje: <strong className="text-foreground">{data.usos_hoje}</strong> usos</span>
              {data.beneficio_top && (
                <span className="block mt-1 truncate">Top: {data.beneficio_top}</span>
              )}
            </div>
            <Link
              to="/clube"
              className="text-xs text-primary hover:underline inline-block mt-1"
            >
              Abrir Clube →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
