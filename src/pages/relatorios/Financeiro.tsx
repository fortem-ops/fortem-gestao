import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { PeriodoFilter, defaultPeriodo } from "@/components/relatorios/PeriodoFilter";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { DollarSign, AlertCircle, Clock } from "lucide-react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RelatoriosFinanceiro() {
  const [periodo, setPeriodo] = useState(defaultPeriodo());

  const { data: recebidos = [] } = useQuery({
    queryKey: ["rel-fin-rec", periodo],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_financeiro_recebimentos")
        .select("*")
        .gte("data_pagamento", periodo.inicio)
        .lte("data_pagamento", periodo.fim)
        .order("data_pagamento", { ascending: false });
      return data ?? [];
    },
  });

  const { data: abertos = [] } = useQuery({
    queryKey: ["rel-fin-abertos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_financeiro_aberto")
        .select("*")
        .order("vencimento", { ascending: true });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const totalRec = recebidos.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const vencidos = abertos.filter((a: any) => a.status === "vencido");
    const totalVencido = vencidos.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
    const totalAberto = abertos.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
    return { totalRec, totalVencido, totalAberto, qtdVencidos: vencidos.length };
  }, [recebidos, abertos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodoFilter value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Recebido no período" value={brl(stats.totalRec)} icon={DollarSign} tone="success" />
        <KpiCard label="A receber" value={brl(stats.totalAberto - stats.totalVencido)} icon={Clock} />
        <KpiCard label="Vencido" value={brl(stats.totalVencido)} icon={AlertCircle} tone="danger" />
        <KpiCard label="Parcelas vencidas" value={stats.qtdVencidos} tone="warning" />
      </div>

      <Tabs defaultValue="recebidos">
        <TabsList>
          <TabsTrigger value="recebidos">Recebidos</TabsTrigger>
          <TabsTrigger value="abertos">Em aberto</TabsTrigger>
          <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
        </TabsList>

        <TabsContent value="recebidos">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recebimentos</CardTitle>
              <ExportMenu filename={`recebidos-${periodo.inicio}-${periodo.fim}`} rows={recebidos as any[]} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recebidos.slice(0, 200).map((r: any) => (
                    <TableRow key={r.parcela_id}>
                      <TableCell>{new Date(r.data_pagamento).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{r.aluno_nome}</TableCell>
                      <TableCell>{r.forma_pagamento ?? "—"}</TableCell>
                      <TableCell className="text-right">{brl(Number(r.valor))}</TableCell>
                    </TableRow>
                  ))}
                  {recebidos.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum recebimento</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abertos">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Em aberto</CardTitle>
              <ExportMenu filename="parcelas-abertas" rows={abertos.filter((a: any) => a.status === "aberto") as any[]} />
            </CardHeader>
            <CardContent>
              <ParcelasTable rows={abertos.filter((a: any) => a.status === "aberto")} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vencidos">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Vencidos</CardTitle>
              <ExportMenu filename="parcelas-vencidas" rows={abertos.filter((a: any) => a.status === "vencido") as any[]} />
            </CardHeader>
            <CardContent>
              <ParcelasTable rows={abertos.filter((a: any) => a.status === "vencido")} showAtraso />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ParcelasTable({ rows, showAtraso }: { rows: any[]; showAtraso?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vencimento</TableHead>
          <TableHead>Aluno</TableHead>
          {showAtraso && <TableHead>Atraso</TableHead>}
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 200).map((r: any) => (
          <TableRow key={r.parcela_id}>
            <TableCell>{new Date(r.vencimento).toLocaleDateString("pt-BR")}</TableCell>
            <TableCell>{r.aluno_nome}</TableCell>
            {showAtraso && <TableCell>{r.dias_atraso} dias</TableCell>}
            <TableCell className="text-right">{brl(Number(r.valor))}</TableCell>
            <TableCell>
              <Badge variant={r.status === "vencido" ? "destructive" : "secondary"}>{r.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={showAtraso ? 5 : 4} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}
