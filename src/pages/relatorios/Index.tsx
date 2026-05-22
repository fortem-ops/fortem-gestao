import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, DollarSign, Users, AlertTriangle } from "lucide-react";

export default function RelatoriosHome() {
  const { data: kpis } = useQuery({
    queryKey: ["relatorios-home-kpis"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const sinceStr = since.toISOString().slice(0, 10);

      const [vendas, recebidos, alunos, alertas] = await Promise.all([
        supabase.from("v_vendas_resumo").select("valor_final,status_pagamento,data_venda").gte("data_venda", sinceStr),
        supabase.from("v_financeiro_recebimentos").select("valor,data_pagamento").gte("data_pagamento", sinceStr),
        supabase.from("alunos").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("v_tecnico_alertas").select("aluno_id,avaliacao_atrasada,treino_desatualizado"),
      ]);

      const vendasOk = (vendas.data ?? []).filter((v: any) => v.status_pagamento !== "cancelado");
      const totalVendas = vendasOk.reduce((s: number, v: any) => s + Number(v.valor_final || 0), 0);
      const totalRecebido = (recebidos.data ?? []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
      const totalAlertas = (alertas.data ?? []).filter((a: any) => a.avaliacao_atrasada || a.treino_desatualizado).length;
      return {
        totalVendas,
        totalRecebido,
        qtdVendas: vendasOk.length,
        alunosAtivos: alunos.count ?? 0,
        alertas: totalAlertas,
      };
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["relatorios-insights"],
    queryFn: async () => {
      const { data } = await supabase
        .from("relatorios_insights")
        .select("*")
        .order("gerado_em", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Indicadores dos últimos 30 dias.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Vendas (valor)" value={brl(kpis?.totalVendas ?? 0)} icon={BarChart3} />
        <KpiCard label="Vendas (qtd)" value={kpis?.qtdVendas ?? 0} icon={BarChart3} />
        <KpiCard label="Recebido" value={brl(kpis?.totalRecebido ?? 0)} icon={DollarSign} tone="success" />
        <KpiCard label="Alunos ativos" value={kpis?.alunosAtivos ?? 0} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Insights da Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(insights ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum insight gerado ainda.</p>
            ) : (
              insights!.map((i: any) => (
                <div key={i.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">{i.titulo}</p>
                  {i.descricao && <p className="text-sm text-muted-foreground mt-1">{i.descricao}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Alertas técnicos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display font-semibold text-amber-500">{kpis?.alertas ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Alunos com avaliação ou treino pendente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
