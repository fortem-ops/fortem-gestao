import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { CalendarDays, Clock, AlertCircle, TrendingUp, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useKpisPrevisibilidade, useResumoMensalPrevisibilidade, useDiaADiaPrevisibilidade,
} from "@/hooks/usePrevisibilidade";
import { CalendarioCaixa, RecebiveisList, RiscoCarteira } from "@/components/financeiro/PrevisibilidadeFase2";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;

function proximos12Meses(): string[] {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => format(addMonths(startOfMonth(hoje), i), "yyyy-MM"));
}

function labelMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const mmm = format(new Date(y, m - 1, 1), "MMM", { locale: ptBR }).replace(".", "");
  return `${mmm}/${String(y).slice(2)}`;
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
        <h1 className="text-2xl font-display font-semibold">Previsibilidade</h1>
        <p className="text-sm text-muted-foreground">Quanto está previsto para entrar nos próximos meses e dias úteis.</p>
      </div>
      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="dias">Dias úteis</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="recebiveis">Recebíveis</TabsTrigger>
          <TabsTrigger value="risco">Risco</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><VisaoGeral /></TabsContent>
        <TabsContent value="dias"><DiasUteis /></TabsContent>
        <TabsContent value="calendario"><CalendarioCaixa /></TabsContent>
        <TabsContent value="recebiveis"><RecebiveisList /></TabsContent>
        <TabsContent value="risco"><RiscoCarteira /></TabsContent>
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
      row[r.origem] = num(row[r.origem]) + num(r.total_liquido);
    });
    return row;
  }), [meses, resumo]);

  const atrasoQtd = num(k?.em_atraso_qtd);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="A receber este mês" value={brl(num(k?.mes_atual_liquido))} icon={Wallet} />
        <KpiCard label="Próximos 30 dias" value={brl(num(k?.proximos_30_liquido))} icon={Clock} />
        <KpiCard label="Próximos 60 dias" value={brl(num(k?.proximos_60_liquido))} icon={Clock} />
        <KpiCard label="Próximos 90 dias" value={brl(num(k?.proximos_90_liquido))} icon={TrendingUp} />
        <KpiCard
          label="Em atraso"
          value={brl(num(k?.em_atraso_bruto))}
          tone={atrasoQtd > 0 ? "danger" : "default"}
          icon={AlertCircle}
          hint={`${atrasoQtd} cobrança(s)`}
        />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Previsto por mês e origem</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
          <p className="text-xs text-muted-foreground">
            Valores líquidos de taxa. Contratos anuais que vencem sem renovação lançada aparecem como queda na carteira — isso é esperado, não é um erro.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DiasUteis() {
  const [mesRef, setMesRef] = useState(() => startOfMonth(new Date()));
  const inicio = format(startOfMonth(mesRef), "yyyy-MM-dd");
  const fim = format(endOfMonth(mesRef), "yyyy-MM-dd");
  const hoje = format(new Date(), "yyyy-MM-dd");

  const { data: dias = [], isLoading } = useDiaADiaPrevisibilidade(inicio, fim);

  const { linhas, stats } = useMemo(() => {
    let accPrev = 0;
    const linhas = dias.map((d) => {
      const prev = num(d.previsto_liquido);
      accPrev += prev;
      return { ...d, prev, real: num(d.realizado_bruto), accPrev };
    });
    const uteis = dias.filter((d) => d.dia_util).length;
    const passados = dias.filter((d) => d.dia_util && d.dia <= hoje).length;
    const restantes = uteis - passados;
    const totalPrev = accPrev;
    const media = uteis > 0 ? totalPrev / uteis : 0;
    const prevRestante = dias
      .filter((d) => d.dia > hoje)
      .reduce((s, d) => s + num(d.previsto_liquido), 0);
    const falta = restantes > 0 ? prevRestante / restantes : null;
    return { linhas, stats: { uteis, passados, restantes, media, falta } };
  }, [dias, hoje]);

  const blocos = [
    { label: "Dias úteis no mês", value: String(stats.uteis) },
    { label: "Dias úteis já passados", value: String(stats.passados) },
    { label: "Dias úteis restantes", value: String(stats.restantes) },
    { label: "Média prevista por dia útil", value: brl(stats.media) },
    { label: "Falta por dia útil restante", value: stats.falta === null ? "—" : brl(stats.falta) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMesRef((d) => addMonths(d, -1))} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-40 text-center font-medium capitalize">
          {format(mesRef, "MMMM/yyyy", { locale: ptBR })}
        </span>
        <Button variant="outline" size="icon" onClick={() => setMesRef((d) => addMonths(d, 1))} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {blocos.map((b) => (
          <Card key={b.label} className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{b.label}</p>
              <p className="text-2xl font-display font-semibold mt-1 text-primary">{b.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                const sem = format(new Date(`${l.dia}T12:00:00`), "EEE", { locale: ptBR }).replace(".", "");
                return (
                  <TableRow key={l.dia} className={l.dia_util ? "" : "opacity-60 bg-muted/30"}>
                    <TableCell className="py-1.5">
                      {l.dia.slice(8, 10)}/{l.dia.slice(5, 7)}{" "}
                      <span className="text-xs text-muted-foreground">{sem}</span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {l.dia_util
                        ? <Badge variant="secondary">Dia útil</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Fim de semana/feriado</Badge>}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">{brl(l.prev)}</TableCell>
                    <TableCell className="py-1.5 text-right">{brl(l.real)}</TableCell>
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
