import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { PeriodoFilter, defaultPeriodo } from "@/components/relatorios/PeriodoFilter";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { BarChart3, TrendingUp, ShoppingBag } from "lucide-react";
import { calcStats, calcPorPlano, formatBrl, type VendaRow } from "@/lib/vendas-calc";

const PAGE_SIZE = 50;

type VendaViewRow = {
  venda_id: string;
  data_venda: string;
  aluno_nome: string | null;
  item: string | null;
  tipo: string | null;
  valor_final: number | null;
  status_pagamento: string | null;
  vendedor_nome: string | null;
  forma_pagamento: string | null;
  parcelas: number | null;
  plano_tipo: string | null;
};

const toVendaRow = (r: { valor_final: number | null; status_pagamento: string | null; plano_tipo?: string | null; item?: string | null }): VendaRow => ({
  valor: Number(r.valor_final ?? 0),
  status: r.status_pagamento,
  plano_tipo: r.plano_tipo ?? null,
  item: r.item ?? null,
});

export default function RelatoriosVendas() {
  const [periodo, setPeriodo] = useState(defaultPeriodo());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodo]);

  // Página atual (server-side pagination)
  const { data: pageData, isLoading } = useQuery({
    queryKey: ["rel-vendas-page", periodo, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("v_vendas_resumo")
        .select("*", { count: "exact" })
        .gte("data_venda", periodo.inicio)
        .lte("data_venda", periodo.fim)
        .order("data_venda", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as VendaViewRow[], total: count ?? 0 };
    },
  });

  const rows: VendaViewRow[] = pageData?.rows ?? [];
  const totalCount = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Agregado do período inteiro (para KPIs e gráfico por plano)
  const { data: aggRows = [] } = useQuery({
    queryKey: ["rel-vendas-agg", periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_vendas_resumo")
        .select("valor_final,status_pagamento,plano_tipo,item")
        .gte("data_venda", periodo.inicio)
        .lte("data_venda", periodo.fim);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => calcStats(aggRows.map(toVendaRow)), [aggRows]);
  const porPlano = useMemo(() => calcPorPlano(aggRows.map(toVendaRow)), [aggRows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodoFilter value={periodo} onChange={setPeriodo} />
        <ExportMenu
          filename={`vendas-${periodo.inicio}-${periodo.fim}`}
          rows={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "data_venda", label: "Data" },
            { key: "aluno_nome", label: "Aluno" },
            { key: "item", label: "Item" },
            { key: "tipo", label: "Tipo" },
            { key: "valor_final", label: "Valor" },
            { key: "status_pagamento", label: "Status" },
            { key: "vendedor_nome", label: "Vendedor" },
            { key: "forma_pagamento", label: "Forma" },
            { key: "parcelas", label: "Parc." },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento" value={formatBrl(stats.total)} icon={TrendingUp} />
        <KpiCard label="Vendas" value={stats.qtd} icon={ShoppingBag} />
        <KpiCard label="Ticket médio" value={formatBrl(stats.ticket)} icon={BarChart3} />
        <KpiCard label="Cancelamentos" value={stats.cancelados} tone="danger" />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Por plano/item</CardTitle></CardHeader>
        <CardContent>
          {porPlano.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-2">
              {porPlano.slice(0, 8).map((p) => {
                const pct = (p.valor / (stats.total || 1)) * 100;
                return (
                  <div key={p.plano}>
                    <div className="flex justify-between text-sm">
                      <span>{p.plano}</span>
                      <span className="text-muted-foreground">{p.qtd} • {formatBrl(p.valor)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded mt-1 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.venda_id}>
                      <TableCell>{new Date(r.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{r.aluno_nome}</TableCell>
                      <TableCell>{r.item}</TableCell>
                      <TableCell>{r.vendedor_nome ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatBrl(Number(r.valor_final))}</TableCell>
                      <TableCell>
                        <Badge variant={r.status_pagamento === "pago" ? "default" : r.status_pagamento === "cancelado" ? "destructive" : "secondary"}>
                          {r.status_pagamento}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {totalCount === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem vendas no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>

              {totalCount > 0 && (
                <div className="flex items-center justify-between gap-3 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages} — {totalCount} registros
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
