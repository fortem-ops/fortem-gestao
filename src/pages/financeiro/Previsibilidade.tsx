import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, AreaChart, Area, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { CalendarDays, Clock, AlertCircle, TrendingUp, Wallet } from "lucide-react";
import {
  useKpisPrevisibilidade, useResumoMensalPrevisibilidade, useDiaADiaPrevisibilidade,
} from "@/hooks/usePrevisibilidade";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function proximos12Meses(): string[] {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

function labelMes(mes: string, anoCompleto = false) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const mmm = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${mmm}/${anoCompleto ? y : String(y).slice(2)}`;
}

const SERIES = [
  { key: "mensalidade", label: "Mensalidade", color: "hsl(var(--primary))" },
  { key: "servico", label: "Serviço", color: "hsl(217 91% 60%)" },
  { key: "produto", label: "Produto", color: "hsl(38 92% 50%)" },
] as const;

export default function Previsibilidade() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold">Previsibilidade Financeira</h1>
        <p className="text-sm text-muted-foreground">Quanto está previsto para entrar nos próximos meses e dias úteis.</p>
      </div>
      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="dias">Dias úteis</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><VisaoGeral /></TabsContent>
        <TabsContent value="dias"><DiasUteis /></TabsContent>
      </Tabs>
    </div>
  );
}

function VisaoGeral() {
  const { data: k } = useKpisPrevisibilidade();
  const { data: resumo = [] } = useResumoMensalPrevisibilidade();
  const meses = useMemo(proximos12Meses, []);

  const chartData = useMemo(() => meses.map((mes) => {
    const row: Record<string, number | string> = { mes, label: labelMes(mes), mensalidade: 0, servico: 0, produto: 0 };
    resumo.filter((r) => r.mes === mes).forEach((r) => {
      row[r.origem] = num(row[r.origem]) + num(r.total_bruto);
    });
    row.total = num(row.mensalidade) + num(row.servico) + num(row.produto);
    return row;
  }), [meses, resumo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="A receber no mês" value={brl(num(k?.mes_atual_bruto))} hint={`líquido: ${brl(num(k?.mes_atual_liquido))}`} icon={Wallet} />
        <KpiCard label="Próximos 30 dias" value={brl(num(k?.proximos_30_bruto))} icon={Clock} />
        <KpiCard label="Próximos 60 dias" value={brl(num(k?.proximos_60_bruto))} icon={Clock} />
        <KpiCard label="Próximos 90 dias" value={brl(num(k?.proximos_90_bruto))} icon={TrendingUp} />
        <KpiCard label="Em atraso" value={brl(num(k?.em_atraso_bruto))} tone="danger" icon={AlertCircle} hint={`${num(k?.em_atraso_qtd)} recebível(is)`} />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Previsto por mês e origem</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => brl(Number(v))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Total bruto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((r) => (
                <TableRow key={String(r.mes)}>
                  <TableCell className="py-1.5">{labelMes(String(r.mes))}</TableCell>
                  <TableCell className="py-1.5 text-right">{brl(num(r.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DiasUteis() {
  const meses = useMemo(proximos12Meses, []);
  const [mes, setMes] = useState(meses[0]);
  const [y, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const fim = ymd(new Date(y, m, 0));
  const hoje = ymd(new Date());
  const ehMesAtual = mes === meses[0];

  const { data: dias = [], isLoading } = useDiaADiaPrevisibilidade(inicio, fim);

  const { linhas, stats } = useMemo(() => {
    let accPrev = 0, accReal = 0;
    const linhas = dias.map((d) => {
      const prev = num(d.previsto_bruto);
      const passou = d.dia <= hoje;
      const real = passou ? num(d.realizado_bruto) : null;
      accPrev += prev;
      if (real !== null) accReal += real;
      return { ...d, prev, real, passou, accPrev, accReal: passou ? accReal : null };
    });
    const uteis = dias.filter((d) => d.dia_util).length;
    const passados = ehMesAtual ? dias.filter((d) => d.dia_util && d.dia < hoje).length : 0;
    const restantes = uteis - passados;
    const totalPrev = accPrev;
    const media = uteis > 0 ? totalPrev / uteis : 0;
    const necessario = ehMesAtual && restantes > 0 ? Math.max(0, (totalPrev - accReal) / restantes) : null;
    return { linhas, stats: { uteis, passados, restantes, media, necessario } };
  }, [dias, hoje, ehMesAtual]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {meses.map((mm) => <SelectItem key={mm} value={mm}>{labelMes(mm, true)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Dias úteis no mês" value={stats.uteis} icon={CalendarDays} />
        <KpiCard label="Dias úteis já passados" value={stats.passados} />
        <KpiCard label="Dias úteis restantes" value={stats.restantes} />
        <KpiCard label="Média prevista por dia útil" value={brl(stats.media)} />
        {stats.necessario !== null && (
          <KpiCard label="Necessário por dia útil restante" value={brl(stats.necessario)} tone="warning" />
        )}
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Acumulado no mês</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={linhas.map((l) => ({ dia: l.dia.slice(8, 10), previsto: l.accPrev, realizado: l.accReal }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => (v == null ? "—" : brl(Number(v)))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                <Area type="monotone" dataKey="previsto" name="Previsto acumulado" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                <Line type="monotone" dataKey="realizado" name="Realizado acumulado" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Acumulado previsto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => {
                const d = new Date(`${l.dia}T12:00:00`);
                const sem = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
                return (
                  <TableRow key={l.dia} className={l.dia_util ? "" : "text-muted-foreground"}>
                    <TableCell className="py-1.5">{l.dia.slice(8, 10)}/{l.dia.slice(5, 7)} <span className="text-xs text-muted-foreground">{sem}</span></TableCell>
                    <TableCell className="py-1.5">
                      {l.dia_util ? <Badge variant="secondary">Útil</Badge> : <Badge variant="outline" className="text-muted-foreground">Não útil</Badge>}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">{brl(l.prev)}</TableCell>
                    <TableCell className="py-1.5 text-right">{l.real === null ? "—" : brl(l.real)}</TableCell>
                    <TableCell className="py-1.5 text-right">{brl(l.accPrev)}</TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && linhas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum dado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
