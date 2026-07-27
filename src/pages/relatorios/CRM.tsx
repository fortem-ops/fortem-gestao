import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { PeriodoFilter, defaultPeriodo } from "@/components/relatorios/PeriodoFilter";
import { Users2, TrendingUp, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type FunilRow = { stage_name: string; position: number; entradas: number; conversao_pct: number | null };
type TempoRow = { stage_name: string; dias_medio: number };
type MotivoRow = { motivo: string; quantidade: number };
type TendRow = { mes: string; prospects: number; alunos: number; alunos_ativos: number; perdidos: number; inativos: number };
type Relatorio = {
  funil: FunilRow[];
  tempo_medio_por_etapa: TempoRow[];
  ciclo_vendas_dias: number | null;
  motivos_perda: MotivoRow[];
  tendencia_mensal: TendRow[];
  convertidos_periodo: number | null;
  perdidos_periodo: number | null;
  taxa_ganho_pct: number | null;
};

const fmtMes = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

export default function RelatoriosCRM() {
  const [periodo, setPeriodo] = useState(defaultPeriodo());
  const [funnelId, setFunnelId] = useState<string | undefined>(undefined);

  const { data: funis = [] } = useQuery({
    queryKey: ["rel-crm-funis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_funnels")
        .select("id, slug, label, position, is_active")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Default para funil 'prospects' quando a lista carrega
  const effectiveFunnelId = useMemo(() => {
    if (funnelId) return funnelId;
    const prospects = funis.find((f) => f.slug === "prospects");
    return prospects?.id ?? funis[0]?.id;
  }, [funnelId, funis]);

  const { data: rel, isLoading } = useQuery({
    queryKey: ["rel-crm", effectiveFunnelId, periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_pipeline_relatorio", {
        p_funnel_id: effectiveFunnelId!,
        p_desde: periodo.inicio,
        p_ate: periodo.fim,
      });
      if (error) throw error;
      return data as unknown as Relatorio;
    },
    enabled: !!effectiveFunnelId,
  });

  const funil = rel?.funil ?? [];
  const tempos = rel?.tempo_medio_por_etapa ?? [];
  const motivos = rel?.motivos_perda ?? [];
  const tendencia = rel?.tendencia_mensal ?? [];

  const stats = useMemo(() => {
    const primeira = funil[0];
    const perdidos = motivos.reduce((s, m) => s + Number(m.quantidade ?? 0), 0);
    return {
      leads: Number(primeira?.entradas ?? 0),
      taxaGanho: rel?.taxa_ganho_pct ?? null,
      ciclo: rel?.ciclo_vendas_dias ?? null,
      perdidos,
    };
  }, [funil, motivos, rel]);

  const maxFunil = Math.max(1, ...funil.map((f) => Number(f.entradas ?? 0)));
  const maxTempo = Math.max(1, ...tempos.map((t) => Number(t.dias_medio ?? 0)));
  const maxMotivo = Math.max(1, ...motivos.map((m) => Number(m.quantidade ?? 0)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <PeriodoFilter value={periodo} onChange={setPeriodo} />
          <div>
            <Select value={effectiveFunnelId} onValueChange={setFunnelId}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ExportMenu
          filename="crm-funil"
          rows={funil.map((f) => ({
            posicao: f.position,
            etapa: f.stage_name,
            entradas: f.entradas,
            conversao_pct: f.conversao_pct,
          }))}
          columns={[
            { key: "posicao", label: "Posição" },
            { key: "etapa", label: "Etapa" },
            { key: "entradas", label: "Entradas" },
            { key: "conversao_pct", label: "Conversão %" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Leads no funil" value={stats.leads} icon={Users2} />
        <KpiCard
          label="Taxa de ganho"
          value={stats.taxaGanho == null ? "—" : `${Number(stats.taxaGanho).toFixed(1)}%`}
          icon={TrendingUp}
          tone="success"
          hint="Ganhos ÷ (ganhos + perdas) no período"
        />
        <KpiCard
          label="Ciclo de vendas médio"
          value={stats.ciclo == null ? "—" : `${Math.round(stats.ciclo)}d`}
          icon={Clock}
          hint="Do lead à conversão"
        />
        <KpiCard label="Perdidos no período" value={stats.perdidos} icon={XCircle} tone="danger" />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Funil de conversão</CardTitle>
          <p className="text-xs text-muted-foreground">
            Entradas = alunos que passaram por cada etapa no período. Como o funil não é sempre
            linear (leads podem pular etapas ou retroceder), os números não são necessariamente
            decrescentes.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && funil.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          )}
          {funil.map((f) => (
            <div key={`${f.position}-${f.stage_name}`} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{f.stage_name}</span>
                <span className="text-muted-foreground">
                  {f.entradas}
                  {f.conversao_pct != null && ` · ${Number(f.conversao_pct).toFixed(1)}%`}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(Number(f.entradas) / maxFunil) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Tempo médio por etapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tempos.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            )}
            {tempos.map((t) => {
              const dias = Number(t.dias_medio ?? 0);
              const alerta = dias >= 5;
              return (
                <div key={t.stage_name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t.stage_name}</span>
                    <span className={cn("text-muted-foreground", alerta && "text-amber-500")}>
                      {dias.toFixed(1)}d
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        alerta ? "bg-amber-500" : "bg-primary",
                      )}
                      style={{ width: `${(dias / maxTempo) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {motivos.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem perdas no período.</p>
            )}
            {motivos.map((m) => (
              <div key={m.motivo} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.motivo}</span>
                  <span className="text-muted-foreground">{m.quantidade}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-destructive transition-all"
                    style={{ width: `${(Number(m.quantidade) / maxMotivo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Tendência mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {tendencia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tendencia.map((t) => ({ ...t, mes: fmtMes(t.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="alunos_ativos"
                    name="Alunos ativos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="perdidos"
                    name="Perdidos"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
