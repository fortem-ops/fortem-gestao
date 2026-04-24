import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, TrendingUp, Award, CheckCircle2 } from "lucide-react";

interface DashboardData {
  usos_periodo: number;
  usos_hoje: number;
  membros_ativos: number;
  taxa_ativacao: number;
  ranking_parceiros: { nome: string; usos: number }[];
  beneficio_top?: string;
  uso_por_categoria: { categoria: string; usos: number }[];
  parceiro_destaque?: string;
}

export function AdminClubeDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["clube-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_clube_dashboard", { _periodo_dias: 30 });
      if (error) throw error;
      return data as unknown as DashboardData;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={CheckCircle2} label="Usos no mês" value={data.usos_periodo} accent="text-emerald-500" />
        <KPI icon={Sparkles} label="Usos hoje" value={data.usos_hoje} accent="text-amber-500" />
        <KPI icon={Users} label="Membros ativos" value={data.membros_ativos} accent="text-blue-500" />
        <KPI icon={TrendingUp} label="Taxa ativação" value={`${data.taxa_ativacao}%`} accent="text-rose-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Ranking de parceiros (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ranking_parceiros?.length ? (
              data.ranking_parceiros.map((p, i) => (
                <div key={p.nome} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="text-muted-foreground mr-2">#{i + 1}</span>
                    {p.nome}
                  </span>
                  <Badge variant="outline">{p.usos} usos</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uso por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.uso_por_categoria?.length ? (
              data.uso_por_categoria.map((c) => (
                <div key={c.categoria} className="flex items-center justify-between text-sm">
                  <span>{c.categoria}</span>
                  <Badge variant="secondary">{c.usos}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Benefício mais usado</p>
            <p className="font-semibold">{data.beneficio_top || "—"}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <Award className="w-6 h-6 text-rose-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Parceiro destaque</p>
            <p className="font-semibold">{data.parceiro_destaque || "—"}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${accent}`} />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
