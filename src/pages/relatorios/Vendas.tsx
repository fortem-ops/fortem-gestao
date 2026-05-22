import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { PeriodoFilter, defaultPeriodo } from "@/components/relatorios/PeriodoFilter";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { BarChart3, TrendingUp, ShoppingBag } from "lucide-react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RelatoriosVendas() {
  const [periodo, setPeriodo] = useState(defaultPeriodo());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-vendas", periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_vendas_resumo")
        .select("*")
        .gte("data_venda", periodo.inicio)
        .lte("data_venda", periodo.fim)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const ok = rows.filter((r: any) => r.status_pagamento !== "cancelado");
    const total = ok.reduce((s: number, r: any) => s + Number(r.valor_final || 0), 0);
    const ticket = ok.length ? total / ok.length : 0;
    const cancelados = rows.length - ok.length;
    return { total, qtd: ok.length, ticket, cancelados };
  }, [rows]);

  const porPlano = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; qtd: number }>();
    rows.forEach((r: any) => {
      if (r.status_pagamento === "cancelado") return;
      const key = r.plano_tipo || r.item || "—";
      const cur = map.get(key) ?? { nome: key, valor: 0, qtd: 0 };
      cur.valor += Number(r.valor_final || 0);
      cur.qtd += 1;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodoFilter value={periodo} onChange={setPeriodo} />
        <ExportMenu
          filename={`vendas-${periodo.inicio}-${periodo.fim}`}
          rows={rows as any[]}
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
        <KpiCard label="Faturamento" value={brl(stats.total)} icon={TrendingUp} />
        <KpiCard label="Vendas" value={stats.qtd} icon={ShoppingBag} />
        <KpiCard label="Ticket médio" value={brl(stats.ticket)} icon={BarChart3} />
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
                  <div key={p.nome}>
                    <div className="flex justify-between text-sm">
                      <span>{p.nome}</span>
                      <span className="text-muted-foreground">{p.qtd} • {brl(p.valor)}</span>
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
                {rows.slice(0, 200).map((r: any) => (
                  <TableRow key={r.venda_id}>
                    <TableCell>{new Date(r.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{r.aluno_nome}</TableCell>
                    <TableCell>{r.item}</TableCell>
                    <TableCell>{r.vendedor_nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{brl(Number(r.valor_final))}</TableCell>
                    <TableCell>
                      <Badge variant={r.status_pagamento === "pago" ? "default" : r.status_pagamento === "cancelado" ? "destructive" : "secondary"}>
                        {r.status_pagamento}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem vendas no período</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
