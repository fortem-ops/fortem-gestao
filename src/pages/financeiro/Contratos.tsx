import { useMemo, useState } from 'react';
import { FileText, Users, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTodosContratos } from '@/hooks/useContratos';
import {
  PLANO_LABELS, FREQUENCIA_LABELS, STATUS_CONTRATO_LABELS,
  FORMA_PAGAMENTO_LABELS, formatBRL, ContratoStatus,
} from '@/types/financeiro';

const STATUS_VARIANT: Record<ContratoStatus, string> = {
  ativo:        'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  suspenso:     'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  inadimplente: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  cancelado:    'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  encerrado:    'bg-muted text-muted-foreground border-border',
};

export default function Contratos() {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPlano, setFiltroPlano] = useState<string>('todos');
  const [filtroPgto, setFiltroPgto] = useState<string>('todos');
  const [busca, setBusca] = useState('');

  const { data: contratos, isLoading, refetch, isRefetching } = useTodosContratos(filtroStatus);

  const filtrados = useMemo(() => {
    let list = contratos ?? [];
    if (filtroPlano !== 'todos') list = list.filter((c) => c.plano_tipo === filtroPlano);
    if (filtroPgto !== 'todos') list = list.filter((c) => c.forma_pagamento === filtroPgto);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((c) => c.alunos?.nome?.toLowerCase().includes(q));
    }
    return list;
  }, [contratos, filtroPlano, filtroPgto, busca]);

  const kpis = useMemo(() => {
    const all = contratos ?? [];
    const ativos = all.filter((c) => c.status === 'ativo');
    const inadimplentes = all.filter((c) => c.status === 'inadimplente' || c.status === 'suspenso');
    const receitaPrevista = ativos.reduce((sum, c) => sum + Number(c.valor_cobrado || 0), 0);
    const em30dias = new Date();
    em30dias.setDate(em30dias.getDate() + 30);
    const renovacoes = ativos.filter((c) => c.data_renovacao && new Date(c.data_renovacao) <= em30dias);
    return {
      ativos: ativos.length,
      receita: receitaPrevista,
      inadimplentes: inadimplentes.length,
      renovacoes: renovacoes.length,
    };
  }, [contratos]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de contratos, vigência e cobranças</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Contratos ativos" value={String(kpis.ativos)} />
        <Kpi icon={FileText} label="Receita prevista (mês)" value={formatBRL(kpis.receita)} />
        <Kpi icon={AlertTriangle} label="Inadimplentes" value={String(kpis.inadimplentes)} tone="danger" />
        <Kpi icon={RefreshCw} label="Renovações em 30d" value={String(kpis.renovacoes)} />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar aluno..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_CONTRATO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os planos</SelectItem>
              {Object.entries(PLANO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroPgto} onValueChange={setFiltroPgto}>
            <SelectTrigger><SelectValue placeholder="Pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as formas</SelectItem>
              {Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Próxima cobrança</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
              ) : filtrados.map((c) => {
                const isInad = c.status === 'inadimplente' || c.status === 'suspenso';
                return (
                  <TableRow key={c.id} className={isInad ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{c.alunos?.nome ?? '—'}</TableCell>
                    <TableCell>{PLANO_LABELS[c.plano_tipo]}</TableCell>
                    <TableCell>{FREQUENCIA_LABELS[c.frequencia_semanal]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(c.valor_cobrado)}</TableCell>
                    <TableCell>{(c as any).proxima_cobranca ? new Date((c as any).proxima_cobranca + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_VARIANT[c.status]}>
                        {STATUS_CONTRATO_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: 'danger' }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone === 'danger' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
