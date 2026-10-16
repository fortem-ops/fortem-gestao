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
  useResumoMensalPrevisibilidade, useDiaADiaPrevisibilidade,
  useRecebiveisPrevistos, useProjecaoPrevisibilidade, type RecebivelRow,
} from "@/hooks/usePrevisibilidade";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { somaProjecaoJanela, limiteJanela } from "@/lib/previsibilidadeProjecao";
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
  const [mes, setMes] = useState<string | null>(null);
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
        <TabsContent value="calendario"><CalendarioCaixa mes={mes} onMes={setMes} /></TabsContent>
        <TabsContent value="recebiveis"><RecebiveisList mes={mes} onMes={setMes} /></TabsContent>
        <TabsContent value="risco"><RiscoCarteira /></TabsContent>
      </Tabs>
    </div>
  );
}

type Janela = { chave: string; titulo: string; filtro: (r: RecebivelRow) => boolean; bruto?: boolean };

const dataBR = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

function VisaoGeral() {
  const { data: resumo = [] } = useResumoMensalPrevisibilidade();
  const { data: recebiveis = [] } = useRecebiveisPrevistos();
  const [projecaoOn, setProjecaoOn] = useState(false);
  const { data: projecao = [] } = useProjecaoPrevisibilidade(projecaoOn);
  const [aberta, setAberta] = useState<Janela | null>(null);
  const meses = useMemo(proximos12Meses, []);
  const hoje = format(new Date(), "yyyy-MM-dd");
  const mesAtual = hoje.slice(0, 7);

  const janelas = useMemo(() => {
    const ate = (dias: number) => {
      const lim = limiteJanela(hoje, dias);
      return (r: RecebivelRow) => !!r.data_vencimento && r.data_vencimento >= hoje && r.data_vencimento <= lim;
    };
    return {
      mes: { chave: "mes", titulo: "A receber este mês", filtro: (r: RecebivelRow) => (r.data_recebimento_prevista ?? "").startsWith(mesAtual) },
      d30: { chave: "d30", titulo: "Próximos 30 dias", filtro: ate(30) },
      d60: { chave: "d60", titulo: "Próximos 60 dias", filtro: ate(60) },
      d90: { chave: "d90", titulo: "Próximos 90 dias", filtro: ate(90) },
      d365: { chave: "d365", titulo: "Total (1 ano)", filtro: ate(365) },
      atraso: { chave: "atraso", titulo: "Em atraso", bruto: true,
        filtro: (r: RecebivelRow) => !r.ja_cobrado && !!r.data_vencimento && r.data_vencimento < hoje },
    } satisfies Record<string, Janela>;
  }, [hoje, mesAtual]);

  const soma = (j: Janela) => recebiveis.filter(j.filtro).reduce((s, r) => s + num(j.bruto ? r.valor_bruto : r.valor_liquido), 0);
  const proj = (dias: number) => (projecaoOn ? somaProjecaoJanela(projecao, hoje, dias) : 0);
  const projMes = projecaoOn ? projecao.filter((p) => p.mes === mesAtual).reduce((s, p) => s + num(p.renovacao_liquido) + num(p.vendas_novas_liquido), 0) : 0;
  const extra = (v: number) => (projecaoOn && v > 0 ? `+ ${brl(v)} projeção` : undefined);

  const chartData = useMemo(() => meses.map((mes) => {
    const row: Record<string, number | string> = { mes, label: labelMes(mes), mensalidade: 0, servico: 0, produto: 0, projecao: 0 };
    resumo.filter((r) => r.mes === mes).forEach((r) => {
      row[r.origem] = num(row[r.origem]) + num(r.total_liquido);
    });
    if (projecaoOn) {
      const p = projecao.find((x) => x.mes === mes);
      row.projecao = num(p?.renovacao_liquido) + num(p?.vendas_novas_liquido);
    }
    return row;
  }), [meses, resumo, projecao, projecaoOn]);

  const atrasoLista = recebiveis.filter(janelas.atraso.filtro);
  const info = projecao[0];
  const itens = aberta ? recebiveis.filter(aberta.filtro) : [];
  const exportRows = itens.map((r) => ({
    data: dataBR(aberta?.chave === "mes" ? r.data_recebimento_prevista : r.data_vencimento),
    aluno: r.aluno_nome ?? "", descricao: r.descricao ?? "", origem: r.origem,
    ja_cobrado: r.ja_cobrado ? "Sim" : "Não",
    valor: num(aberta?.bruto ? r.valor_bruto : r.valor_liquido).toFixed(2).replace(".", ","),
  }));

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Switch id="projecao" checked={projecaoOn} onCheckedChange={setProjecaoOn} />
          <Label htmlFor="projecao" className="font-medium">Projeção de vendas</Label>
          <span className="text-xs text-muted-foreground">
            {projecaoOn && info
              ? `Taxa de renovação ${(num(info.taxa_renovacao) * 100).toFixed(0)}% · Média de vendas novas ${brl(num(info.media_vendas_novas))}/mês (últimos 6 meses) · já sem a taxa de ${num(info.taxa_cartao).toFixed(2).replace(".", ",")}%`
              : "Desligada: os cartões mostram só o que já está lançado."}
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard label="A receber este mês" value={brl(soma(janelas.mes))} icon={Wallet} extra={extra(projMes)} onClick={() => setAberta(janelas.mes)} />
        <KpiCard label="Próximos 30 dias" value={brl(soma(janelas.d30))} icon={Clock} hint="Valores a cobrar, já sem a taxa" extra={extra(proj(30))} onClick={() => setAberta(janelas.d30)} />
        <KpiCard label="Próximos 60 dias" value={brl(soma(janelas.d60))} icon={Clock} hint="Valores a cobrar, já sem a taxa" extra={extra(proj(60))} onClick={() => setAberta(janelas.d60)} />
        <KpiCard label="Próximos 90 dias" value={brl(soma(janelas.d90))} icon={TrendingUp} hint="Valores a cobrar, já sem a taxa" extra={extra(proj(90))} onClick={() => setAberta(janelas.d90)} />
        <KpiCard label="Total (1 ano)" value={brl(soma(janelas.d365))} icon={CalendarDays} hint="Valores a cobrar, já sem a taxa" extra={extra(proj(365))} onClick={() => setAberta(janelas.d365)} />
        <KpiCard
          label="Em atraso"
          value={brl(soma(janelas.atraso))}
          tone={atrasoLista.length > 0 ? "danger" : "default"}
          icon={AlertCircle}
          hint={`${atrasoLista.length} cobrança(s)`}
          onClick={() => setAberta(janelas.atraso)}
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
                {projecaoOn && <Bar dataKey="projecao" name="Projeção" stackId="a" fill="hsl(var(--muted-foreground))" fillOpacity={0.5} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            Valores líquidos de taxa. Contratos anuais que vencem sem renovação lançada aparecem como queda na carteira — isso é esperado, não é um erro.
            {projecaoOn && " A barra cinza é projeção (renovações esperadas + média de vendas novas), não valor lançado."}
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{aberta?.titulo}</DialogTitle></DialogHeader>
          <div className="flex justify-between items-center">
            <p className="text-sm">{itens.length} item(ns) · Total: <strong>{brl(itens.reduce((s, r) => s + num(aberta?.bruto ? r.valor_bruto : r.valor_liquido), 0))}</strong></p>
            <ExportMenu filename={`previsibilidade-${aberta?.chave ?? ""}`} rows={exportRows}
              columns={[{ key: "data", label: "Data" }, { key: "aluno", label: "Aluno" }, { key: "descricao", label: "Descrição" },
                { key: "origem", label: "Origem" }, { key: "ja_cobrado", label: "Já cobrado" }, { key: "valor", label: "Valor" }]} />
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Aluno</TableHead><TableHead>Descrição</TableHead>
                  <TableHead className="text-right">{aberta?.bruto ? "Valor" : "Valor líquido"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-1.5 whitespace-nowrap">{dataBR(aberta?.chave === "mes" ? r.data_recebimento_prevista : r.data_vencimento)}</TableCell>
                    <TableCell className="py-1.5">{r.aluno_nome ?? "—"}</TableCell>
                    <TableCell className="py-1.5">{r.descricao ?? "—"}{r.ja_cobrado ? <Badge variant="outline" className="ml-2">Já cobrado</Badge> : null}</TableCell>
                    <TableCell className="py-1.5 text-right">{brl(num(aberta?.bruto ? r.valor_bruto : r.valor_liquido))}</TableCell>
                  </TableRow>
                ))}
                {itens.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum item</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
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
