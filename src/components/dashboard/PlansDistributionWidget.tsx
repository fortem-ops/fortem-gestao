import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const PLAN_ORDER = ["Start", "Start+", "Power", "Pro", "Max", "Gympass/Wellhub", "Total Pass"];

// Color palette using HSL design tokens (varied, on-brand)
const PLAN_COLORS: Record<string, string> = {
  "Start": "hsl(var(--info))",
  "Start+": "hsl(var(--primary))",
  "Power": "hsl(var(--warning))",
  "Pro": "hsl(var(--success))",
  "Max": "hsl(var(--destructive))",
  "Gympass/Wellhub": "hsl(217 91% 60%)",
  "Total Pass": "hsl(280 70% 60%)",
  "Outros": "hsl(var(--muted-foreground))",
};

const DURATION_COLORS = ["hsl(var(--primary))", "hsl(var(--info))"];

export function PlansDistributionWidget() {
  const { data } = useQuery({
    queryKey: ["dashboard-plans-distribution"],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos")
        .select("tipo, duracao_meses, aluno_id")
        .eq("ativo", true);

      if (!planos?.length) return { byPlan: [], byDuration: [], total: 0 };

      // Count by plan type
      const planCounts: Record<string, number> = {};
      planos.forEach((p) => {
        const key = PLAN_ORDER.includes(p.tipo) ? p.tipo : "Outros";
        planCounts[key] = (planCounts[key] || 0) + 1;
      });

      const total = planos.length;
      const byPlan = Object.entries(planCounts)
        .map(([name, value]) => ({
          name,
          value,
          percent: (value / total) * 100,
        }))
        .sort((a, b) => {
          const ai = PLAN_ORDER.indexOf(a.name);
          const bi = PLAN_ORDER.indexOf(b.name);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

      // Count mensal vs anual (>=12 months = anual, <12 = mensal/curto)
      let mensal = 0;
      let anual = 0;
      planos.forEach((p) => {
        if ((p.duracao_meses || 0) >= 12) anual++;
        else mensal++;
      });

      const byDuration = [
        { name: "Anual", value: anual, percent: total ? (anual / total) * 100 : 0 },
        { name: "Mensal", value: mensal, percent: total ? (mensal / total) * 100 : 0 },
      ].filter((d) => d.value > 0);

      return { byPlan, byDuration, total };
    },
  });

  const byPlan = data?.byPlan || [];
  const byDuration = data?.byDuration || [];
  const total = data?.total || 0;

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <div className="rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="font-medium text-foreground">{item.name}</div>
        <div className="text-muted-foreground">
          {item.value} aluno{item.value !== 1 ? "s" : ""} · {item.percent.toFixed(1)}%
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-lg p-5">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <PieIcon className="w-4 h-4 text-primary" />
        Distribuição de Planos
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {total} plano{total !== 1 ? "s" : ""} ativo{total !== 1 ? "s" : ""}
        </span>
      </h3>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum plano ativo</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pie 1: Plan types */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 text-center uppercase tracking-wide">
              Por Tipo de Plano
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byPlan}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {byPlan.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PLAN_COLORS[entry.name] || PLAN_COLORS.Outros}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={renderTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {byPlan.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: PLAN_COLORS[p.name] || PLAN_COLORS.Outros }}
                    />
                    <span className="text-foreground">{p.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {p.value} · {p.percent.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pie 2: Duration mensal/anual */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 text-center uppercase tracking-wide">
              Mensal vs Anual
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byDuration}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {byDuration.map((entry, idx) => (
                      <Cell
                        key={entry.name}
                        fill={DURATION_COLORS[idx % DURATION_COLORS.length]}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={renderTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {byDuration.map((d, idx) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: DURATION_COLORS[idx % DURATION_COLORS.length] }}
                    />
                    <span className="text-foreground">{d.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {d.value} · {d.percent.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
