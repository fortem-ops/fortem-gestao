import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Clock, Coffee, Scale, TrendingDown, TrendingUp, UserCheck } from "lucide-react";
import { formatMinutes } from "@/lib/ponto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { gerarRelatorioDivergencias } from "@/lib/pontoPdf";
import { Download } from "lucide-react";
import { STATUS_PONTO_LABEL, type StatusPonto } from "@/lib/pontoTolerancia";

interface DashboardPeriodo {
  periodo: { inicio: string; fim: string };
  kpis: {
    em_jornada_agora: number;
    em_intervalo_agora: number;
    fechadas_hoje: number;
    divergencias_consideradas_periodo: number;
    minutos_descontaveis_periodo: number;
    minutos_extras_periodo: number;
    jornadas_excedidas_periodo: number;
    banco_liquido_periodo: number;
  };
  ranking: Array<{
    usuario_id: string;
    nome: string;
    minutos_considerados: number;
    minutos_descontaveis: number;
    minutos_extras: number;
    dias_excedidos: number;
    dias_trabalhados: number;
  }>;
}

function todayMinusDays(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

export function DashboardCoordenadorKPIs() {
  const [inicio, setInicio] = useState(todayMinusDays(30));
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ponto-dashboard-periodo", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_dashboard_periodo", {
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data as unknown as DashboardPeriodo;
    },
  });

  const handleExportDivergencias = async () => {
    const { data: jornadas, error } = await supabase
      .from("ponto_jornadas")
      .select("data, status_ponto, divergencia_total_dia, minutos_descontaveis, minutos_extras_validos, usuario_id")
      .gte("data", inicio)
      .lte("data", fim)
      .eq("tolerancia_excedida", true)
      .order("data", { ascending: false });
    if (error || !jornadas) return;
    const userIds = Array.from(new Set(jornadas.map((j) => j.usuario_id)));
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
    gerarRelatorioDivergencias({
      periodoInicio: inicio,
      periodoFim: fim,
      linhas: jornadas.map((j: any) => ({
        nome: nameMap.get(j.usuario_id) || "Sem nome",
        data: j.data,
        status: (j.status_ponto ?? "em_analise") as StatusPonto,
        divergencia_total_dia: j.divergencia_total_dia,
        minutos_descontaveis: j.minutos_descontaveis,
        minutos_extras_validos: j.minutos_extras_validos,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Início</label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fim</label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Atualizar</Button>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportDivergencias}>
            <Download className="w-4 h-4" /> Divergências (PDF)
          </Button>
        </div>
      </Card>

      {/* KPIs */}
      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={Activity} label="Em jornada agora" value={data.kpis.em_jornada_agora} tone="success" />
          <Kpi icon={Coffee} label="Em intervalo agora" value={data.kpis.em_intervalo_agora} tone="warning" />
          <Kpi icon={UserCheck} label="Fechadas hoje" value={data.kpis.fechadas_hoje} tone="muted" />
          <Kpi icon={AlertTriangle} label="Jornadas com tolerância excedida" value={data.kpis.jornadas_excedidas_periodo} tone="destructive" />
          <Kpi icon={Clock} label="Divergências consideradas" value={`${data.kpis.divergencias_consideradas_periodo} min`} tone="warning" />
          <Kpi icon={TrendingDown} label="Descontáveis no período" value={`${data.kpis.minutos_descontaveis_periodo} min`} tone="destructive" />
          <Kpi icon={TrendingUp} label="Horas extras válidas" value={`${data.kpis.minutos_extras_periodo} min`} tone="success" />
          <Kpi icon={Scale} label="Saldo banco (período)" value={formatMinutes(data.kpis.banco_liquido_periodo)} tone={data.kpis.banco_liquido_periodo >= 0 ? "success" : "destructive"} />
        </div>
      )}

      {/* Ranking */}
      <Card className="p-4">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-base font-heading font-semibold">Ranking de divergências</h2>
          <span className="text-xs text-muted-foreground">Top 10 — período selecionado</span>
        </header>
        {isLoading || !data ? (
          <Skeleton className="h-40" />
        ) : data.ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma divergência no período. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Profissional</th>
                  <th className="text-right">Dias trab.</th>
                  <th className="text-right">Dias excedidos</th>
                  <th className="text-right">Considerados</th>
                  <th className="text-right">Descontáveis</th>
                  <th className="text-right">Extras</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r) => (
                  <tr key={r.usuario_id} className="border-b border-border/50">
                    <td className="py-2 font-medium">{r.nome}</td>
                    <td className="text-right">{r.dias_trabalhados}</td>
                    <td className="text-right text-destructive">{r.dias_excedidos}</td>
                    <td className="text-right">{r.minutos_considerados}m</td>
                    <td className="text-right text-destructive">{r.minutos_descontaveis}m</td>
                    <td className="text-right text-success">{r.minutos_extras}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  tone: "success" | "warning" | "destructive" | "muted";
}) {
  const toneClass = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-heading font-bold mt-1 ${toneClass}`}>{value}</p>
        </div>
        <Icon className={`w-5 h-5 ${toneClass}`} />
      </div>
    </Card>
  );
}
