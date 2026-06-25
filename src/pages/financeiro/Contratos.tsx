import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, AlertTriangle, RefreshCw, Search, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTodosContratos, type StatusPagamento } from '@/hooks/useContratos';
import {
  PLANO_LABELS, FREQUENCIA_LABELS, STATUS_CONTRATO_LABELS,
  FORMA_PAGAMENTO_LABELS, formatBRL, ContratoStatus,
} from '@/types/financeiro';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<ContratoStatus, string> = {
  ativo:        'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  suspenso:     'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  inadimplente: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  cancelado:    'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  encerrado:    'bg-muted text-muted-foreground border-border',
};

const PAG_VARIANT: Record<StatusPagamento, string> = {
  pago:         'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  pendente:     'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  vencida:      'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  sem_cobranca: 'bg-muted text-muted-foreground border-border',
};
const PAG_LABEL: Record<StatusPagamento, string> = {
  pago: 'Pago', pendente: 'Pendente', vencida: 'Vencida', sem_cobranca: '—',
};

type PeriodoPreset = 'todos' | 'passado' | 'presente' | 'futuro' | 'mes_atual' | 'mes_passado' | 'proximo_mes' | 'custom';

const PERIODO_LABELS: Record<PeriodoPreset, string> = {
  todos: 'Todos os períodos',
  passado: 'Passado (vencidas)',
  presente: 'Presente / atual',
  futuro: 'Futuro',
  mes_atual: 'Mês atual',
  mes_passado: 'Mês passado',
  proximo_mes: 'Próximo mês',
  custom: 'Período entre…',
};

function getRange(p: PeriodoPreset, de?: Date, ate?: Date): { from: Date | null; to: Date | null } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const y = hoje.getFullYear(); const m = hoje.getMonth();
  const startMonth = (yy: number, mm: number) => new Date(yy, mm, 1);
  const endMonth = (yy: number, mm: number) => { const d = new Date(yy, mm + 1, 0); d.setHours(23,59,59,999); return d; };
  switch (p) {
    case 'passado':    return { from: null, to: new Date(hoje.getTime() - 1) };
    case 'futuro':     { const d = new Date(hoje); d.setDate(d.getDate() + 1); return { from: d, to: null }; }
    case 'presente':
    case 'mes_atual':  return { from: startMonth(y, m), to: endMonth(y, m) };
    case 'mes_passado':return { from: startMonth(y, m - 1), to: endMonth(y, m - 1) };
    case 'proximo_mes':return { from: startMonth(y, m + 1), to: endMonth(y, m + 1) };
    case 'custom':     return { from: de ?? null, to: ate ? new Date(ate.getFullYear(), ate.getMonth(), ate.getDate(), 23,59,59,999) : null };
    default:           return { from: null, to: null };
  }
}

export default function Contratos() {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPlano, setFiltroPlano] = useState<string>('todos');
  const [filtroPgto, setFiltroPgto] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoPreset>('todos');
  const [customDe, setCustomDe] = useState<Date | undefined>();
  const [customAte, setCustomAte] = useState<Date | undefined>();
  const [busca, setBusca] = useState('');

  const { data: contratos, isLoading, refetch, isRefetching } = useTodosContratos(filtroStatus);

  const filtrados = useMemo(() => {
    let list = (contratos ?? []).slice();
    if (filtroPlano !== 'todos') list = list.filter((c) => c.plano_tipo === filtroPlano);
    if (filtroPgto !== 'todos') list = list.filter((c) => c.forma_pagamento === filtroPgto);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((c) => c.alunos?.nome?.toLowerCase().includes(q));
    }
    if (filtroPeriodo !== 'todos') {
      const { from, to } = getRange(filtroPeriodo, customDe, customAte);
      list = list.filter((c) => {
        const px = (c as any).proxima_cobranca as string | null;
        if (!px) return false;
        const d = new Date(px + 'T00:00:00');
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
    // Ordem cronológica crescente por próxima cobrança
    list.sort((a, b) => {
      const pa = (a as any).proxima_cobranca as string | null;
      const pb = (b as any).proxima_cobranca as string | null;
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;
      return pa.localeCompare(pb);
    });
    return list;
  }, [contratos, filtroPlano, filtroPgto, busca, filtroPeriodo, customDe, customAte]);

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
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
            <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as PeriodoPreset)}>
              <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtroPeriodo === 'custom' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <DateField label="De" value={customDe} onChange={setCustomDe} />
              <DateField label="Até" value={customAte} onChange={setCustomAte} />
              {(customDe || customAte) && (
                <Button variant="ghost" size="sm" onClick={() => { setCustomDe(undefined); setCustomAte(undefined); }}>
                  Limpar
                </Button>
              )}
            </div>
          )}
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
                <TableHead>Status pagamento</TableHead>
                <TableHead>Status contrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
              ) : filtrados.map((c) => {
                const isInad = c.status === 'inadimplente' || c.status === 'suspenso';
                const pag = (c as any).status_pagamento as StatusPagamento;
                return (
                  <TableRow key={c.id} className={isInad ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">
                      {c.aluno_id ? (
                        <Link to={`/alunos/${c.aluno_id}?tab=contrato`} className="hover:text-primary hover:underline">
                          {c.alunos?.nome ?? '—'}
                        </Link>
                      ) : (c.alunos?.nome ?? '—')}
                    </TableCell>
                    <TableCell>{PLANO_LABELS[c.plano_tipo]}</TableCell>
                    <TableCell>{FREQUENCIA_LABELS[c.frequencia_semanal]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(c.valor_cobrado)}</TableCell>
                    <TableCell>{(c as any).proxima_cobranca ? new Date((c as any).proxima_cobranca + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PAG_VARIANT[pag]}>{PAG_LABEL[pag]}</Badge>
                    </TableCell>
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

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-[200px] justify-start text-left font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={ptBR} className={cn('p-3 pointer-events-auto')} />
        </PopoverContent>
      </Popover>
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
