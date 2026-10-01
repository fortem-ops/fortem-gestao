import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { format, startOfMonth, endOfMonth, addMonths, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Receipt, Wallet, TrendingUp, TrendingDown, Check, ChevronsUpDown, CircleDollarSign, Copy, X } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useDespesasPeriodo, useCategoriasDespesa, useDespesaMutations, useFornecedores } from "@/hooks/useDespesas";
import { LancarFolhaDialog } from "@/components/financeiro/LancarFolhaDialog";
import {
  CategoriasHierarquia, FornecedoresCadastro, nomeCategoria, useArvoreCategorias,
} from "@/components/financeiro/DespesasCadastros";
import {
  STATUS_LABELS, FORMAS_DESPESA, CONTAS_DESPESA, type Despesa, type DespesaCategoria, type DespesaInput,
  type DespesaStatus, type DespesaTipo, type Fornecedor,
} from "@/types/despesas";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;
const fmtData = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ANO_INICIO = 2017;
const ANO_ATUAL = new Date().getFullYear();

type Periodo = "mes" | "mes_ant" | "3m" | "ano" | "custom";

function BaixaLoteDialog({ despesas, onClose }: { despesas: Despesa[]; onClose: (ok: boolean) => void }) {
  const qc = useQueryClient();
  const pendentes = despesas.filter((d) => d.status === "pendente");
  const [data, setData] = useState("");
  const [forma, setForma] = useState("manter");
  const [conta, setConta] = useState("manter");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    const results = await Promise.all(pendentes.map((d) => supabase.from("despesas").update({
      status: "pago",
      data_pagamento: data || d.data_competencia,
      valor_pago: num(d.valor),
      ...(forma !== "manter" ? { forma_pagamento: forma } : {}),
      ...(conta !== "manter" ? { conta_bancaria: conta } : {}),
    } as never).eq("id", d.id)));
    setSalvando(false);
    const falhas = results.filter((r) => r.error).length;
    qc.invalidateQueries({ queryKey: ["despesas"] });
    if (falhas) toast.error(`${falhas} baixa(s) falharam`);
    else toast.success(`${pendentes.length} baixa(s) registrada(s)`);
    onClose(!falhas);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Dar baixa em lote</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {pendentes.length} pendente(s) de {despesas.length} selecionada(s). Cada uma é marcada como paga pelo seu valor total.
        </p>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Data de pagamento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <p className="text-xs text-muted-foreground">Em branco = usa o vencimento de cada lançamento.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Forma</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manter">Manter atual</SelectItem>
                  {FORMAS_DESPESA.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Conta</Label>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manter">Manter atual</SelectItem>
                  {CONTAS_DESPESA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || pendentes.length === 0}>{salvando ? "Salvando…" : "Confirmar baixa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Despesas() {
  const { data: roles } = useUserRoles();
  const canEdit = !!roles?.isCoordAdmin;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold">Despesas</h1>
        <p className="text-sm text-muted-foreground">Lançamentos de despesas fixas e variáveis da Fortem, mês a mês.</p>
      </div>
      {!canEdit && (
        <Badge variant="secondary">Modo somente leitura — apenas Admin/Coordenador podem editar.</Badge>
      )}
      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        </TabsList>
        <TabsContent value="lancamentos"><Lancamentos canEdit={canEdit} /></TabsContent>
        <TabsContent value="categorias"><CategoriasHierarquia canEdit={canEdit} /></TabsContent>
        <TabsContent value="fornecedores"><FornecedoresCadastro canEdit={canEdit} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Lancamentos({ canEdit }: { canEdit: boolean }) {
  const [mesRef, setMesRef] = useState(() => startOfMonth(new Date()));
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [fCat, setFCat] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fForn, setFForn] = useState("todos");
  const [fForma, setFForma] = useState("todos");
  const [fConta, setFConta] = useState("todos");
  const [fConc, setFConc] = useState("todos");
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [base, setBase] = useState<"venc" | "pag">("venc");
  const [dIni, setDIni] = useState("");
  const [dFim, setDFim] = useState("");
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [copiando, setCopiando] = useState<Despesa | null>(null);
  const [baixando, setBaixando] = useState<Despesa | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<Despesa | null>(null);

  const inicio12 = format(startOfMonth(addMonths(mesRef, -11)), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(mesRef), "yyyy-MM-dd");
  const mesKey = format(mesRef, "yyyy-MM");
  const mesAntKey = format(addMonths(mesRef, -1), "yyyy-MM");

  const { data: despesas = [], isLoading } = useDespesasPeriodo(inicio12, fimMes);
  const { data: categorias = [] } = useCategoriasDespesa(false);
  const { excluir, excluirFuturasGrupo, alternarConciliado } = useDespesaMutations();
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const { resumo, anterior, chart } = useMemo(() => {
    const byMes: Record<string, { fixa: number; variavel: number }> = {};
    despesas.forEach((d) => {
      const k = d.data_competencia.slice(0, 7);
      byMes[k] ??= { fixa: 0, variavel: 0 };
      byMes[k][d.tipo] += num(d.valor);
    });
    const chart = Array.from({ length: 12 }, (_, i) => {
      const dt = addMonths(mesRef, i - 11);
      const k = format(dt, "yyyy-MM");
      const lbl = `${format(dt, "MMM", { locale: ptBR }).replace(".", "")}/${format(dt, "yy")}`;
      return { label: lbl, fixa: byMes[k]?.fixa ?? 0, variavel: byMes[k]?.variavel ?? 0 };
    });
    return {
      resumo: byMes[mesKey] ?? { fixa: 0, variavel: 0 },
      anterior: byMes[mesAntKey] ?? { fixa: 0, variavel: 0 },
      chart,
    };
  }, [despesas, mesRef, mesKey, mesAntKey]);

  const totalMes = resumo.fixa + resumo.variavel;
  const totalAnt = anterior.fixa + anterior.variavel;
  const variacao = totalAnt > 0 ? ((totalMes - totalAnt) / totalAnt) * 100 : null;

  // Intervalo da lista conforme o período escolhido
  const [rIni, rFim] = useMemo(() => {
    const f = (d: Date) => format(d, "yyyy-MM-dd");
    switch (periodo) {
      case "mes_ant": { const m = addMonths(mesRef, -1); return [f(startOfMonth(m)), f(endOfMonth(m))]; }
      case "3m": return [f(startOfMonth(addMonths(mesRef, -2))), f(endOfMonth(mesRef))];
      case "ano": return [`${mesRef.getFullYear()}-01-01`, `${mesRef.getFullYear()}-12-31`];
      case "custom": return [dIni || f(startOfMonth(mesRef)), dFim || f(endOfMonth(mesRef))];
      default: return [f(startOfMonth(mesRef)), f(endOfMonth(mesRef))];
    }
  }, [periodo, mesRef, dIni, dFim]);
  // Por pagamento: busca vencimentos numa janela mais larga e filtra pela data de pagamento.
  const qIni = base === "pag" ? format(addMonths(parseISO(rIni), -6), "yyyy-MM-dd") : rIni;
  const qFim = base === "pag" ? format(addMonths(parseISO(rFim), 6), "yyyy-MM-dd") : rFim;
  const { data: despesasLista = [], isLoading: loadingLista } = useDespesasPeriodo(qIni, qFim);
  const { data: fornecedores = [] } = useFornecedores();
  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return despesasLista
      .filter((d) => {
        const ref = base === "pag" ? d.data_pagamento : d.data_competencia;
        return !!ref && ref >= rIni && ref <= rFim;
      })
      .filter((d) => fCat === "todas" || d.categoria_id === fCat)
      .filter((d) => fTipo === "todos" || d.tipo === fTipo)
      .filter((d) => fStatus === "todos" || d.status === fStatus)
      .filter((d) => fForn === "todos" || (fForn === "nenhum" ? !d.fornecedor_id : d.fornecedor_id === fForn))
      .filter((d) => fForma === "todos" || d.forma_pagamento === fForma)
      .filter((d) => fConta === "todos" || d.conta_bancaria === fConta)
      .filter((d) => fConc === "todos" || (fConc === "sim") === !!d.conciliado)
      .filter((d) => !q || d.descricao.toLowerCase().includes(q)
        || (d.fornecedor_id ? (fornMap.get(d.fornecedor_id) ?? "").toLowerCase().includes(q) : false));
  }, [despesasLista, base, rIni, rFim, fCat, fTipo, fStatus, fForn, fForma, fConta, fConc, busca, fornMap]);
  const totalFiltrado = linhas.reduce((s, d) => s + num(d.valor), 0);
  const isLoadingAll = isLoading || loadingLista;

  const filtrosAtivos = periodo !== "mes" || base !== "venc" || !!busca || fCat !== "todas" || fTipo !== "todos"
    || fStatus !== "todos" || fForn !== "todos" || fForma !== "todos" || fConta !== "todos" || fConc !== "todos";
  const limparFiltros = () => {
    setPeriodo("mes"); setBase("venc"); setBusca(""); setFCat("todas"); setFTipo("todos"); setFStatus("todos");
    setFForn("todos"); setFForma("todos"); setFConta("todos"); setFConc("todos"); setDIni(""); setDFim("");
  };

  // Seleção em lote: limpa ao mudar período/filtros
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  useEffect(() => { setSelecionadas(new Set()); },
    [rIni, rFim, base, busca, fCat, fTipo, fStatus, fForn, fForma, fConta, fConc]);
  const alternarSel = (id: string) => setSelecionadas((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const todasMarcadas = linhas.length > 0 && linhas.every((d) => selecionadas.has(d.id));
  const totalSel = linhas.filter((d) => selecionadas.has(d.id)).reduce((s, d) => s + num(d.valor), 0);
  const [excluirLote, setExcluirLote] = useState(false);
  const [baixaLote, setBaixaLote] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);

  const qc = useQueryClient();
  const confirmarExclusaoLote = async () => {
    const ids = [...selecionadas];
    setProcessandoLote(true);
    const { error } = await supabase.from("despesas").delete().in("id", ids);
    setProcessandoLote(false);
    setExcluirLote(false);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success(`${ids.length} despesa(s) excluída(s)`);
    setSelecionadas(new Set());
    qc.invalidateQueries({ queryKey: ["despesas"] });
  };
  const conciliarLote = async (valor: boolean) => {
    const ids = [...selecionadas];
    setProcessandoLote(true);
    const { error } = await supabase.from("despesas").update({ conciliado: valor } as never).in("id", ids);
    setProcessandoLote(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${ids.length} despesa(s) atualizada(s)`);
    qc.invalidateQueries({ queryKey: ["despesas"] });
  };
  const [calcDsr, setCalcDsr] = useState(false);
  const calcularDsr = async () => {
    const rotulo = format(mesRef, "MMMM/yyyy", { locale: ptBR });
    if (!window.confirm(`Calcular o DSR das comissões pagas em ${rotulo}?`)) return;
    setCalcDsr(true);
    try {
      const { data, error } = await supabase.rpc("fn_calcular_dsr_comissoes", { p_mes: format(mesRef, "yyyy-MM-dd") });
      if (error) throw error;
      const r = data as { criadas: number; ja_existentes: number; total_criado: number; domingos_feriados: number; dias_uteis: number; sem_fornecedor: { nome: string | null }[] };
      toast.success(`DSR ${rotulo}: ${r.criadas} despesa(s) criada(s) — ${brl(Number(r.total_criado))}`, {
        description: `${r.domingos_feriados} domingos/feriados ÷ ${r.dias_uteis} dias úteis.` +
          (r.ja_existentes ? ` ${r.ja_existentes} já existiam e não foram duplicadas.` : ""),
      });
      if (r.sem_fornecedor?.length) {
        toast.warning("Profissionais sem fornecedor vinculado", {
          description: r.sem_fornecedor.map((s) => s.nome ?? "sem nome").join(", "),
        });
      }
      qc.invalidateQueries({ queryKey: ["despesas"] });
    } catch (e) { toast.error(errMsg(e)); }
    setCalcDsr(false);
  };

  const confirmarExclusao = async (futuras = false) => {
    if (!excluindo) return;
    try {
      if (futuras && excluindo.grupo_recorrencia_id) {
        await excluirFuturasGrupo.mutateAsync({
          id: excluindo.id, grupoId: excluindo.grupo_recorrencia_id, aPartirDe: excluindo.parcela_atual ?? 0,
        });
        toast.success("Despesa e parcelas futuras excluídas");
      } else {
        await excluir.mutateAsync(excluindo.id);
        toast.success("Despesa excluída");
      }
    } catch (e) { toast.error(errMsg(e)); }
    setExcluindo(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMesRef((d) => addMonths(d, -1))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center font-medium capitalize">{format(mesRef, "MMMM/yyyy", { locale: ptBR })}</span>
          <Button variant="outline" size="icon" onClick={() => setMesRef((d) => addMonths(d, 1))} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select
            value={String(mesRef.getMonth())}
            onValueChange={(m) => setMesRef(new Date(mesRef.getFullYear(), Number(m), 1))}
            aria-label="Selecionar mês"
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_PT.map((nome, i) => <SelectItem key={i} value={String(i)}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={String(mesRef.getFullYear())}
            onValueChange={(y) => setMesRef(new Date(Number(y), mesRef.getMonth(), 1))}
            aria-label="Selecionar ano"
          >
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.max(ANO_ATUAL, mesRef.getFullYear()) - ANO_INICIO + 1 }, (_, i) => ANO_INICIO + i).map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={calcDsr} onClick={calcularDsr}>
              {calcDsr ? "Calculando…" : "Calcular DSR do mês"}
            </Button>
            <Button variant="outline" onClick={() => setFolhaAberta(true)}>Lançar Folha</Button>
            <Button onClick={() => setNovoAberto(true)}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total fixas" value={brl(resumo.fixa)} icon={Receipt} />
        <KpiCard label="Total variáveis" value={brl(resumo.variavel)} icon={Receipt} />
        <KpiCard label="Total geral" value={brl(totalMes)} icon={Wallet} />
        <KpiCard
          label="Vs. mês anterior"
          value={variacao === null ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}%`}
          icon={variacao !== null && variacao > 0 ? TrendingUp : TrendingDown}
          tone={variacao !== null && variacao > 0 ? "danger" : "default"}
          hint={`Mês anterior: ${brl(totalAnt)}`}
        />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Evolução mensal — últimos 12 meses</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="fixa" name="Fixas" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="variavel" name="Variáveis" stackId="a" fill="hsl(38 92% 50%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês selecionado</SelectItem>
                <SelectItem value="mes_ant">Mês anterior</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="ano">Ano inteiro</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {periodo === "custom" && (
              <>
                <Input type="date" className="w-40" value={dIni} onChange={(e) => setDIni(e.target.value)} aria-label="Data inicial" />
                <Input type="date" className="w-40" value={dFim} onChange={(e) => setDFim(e.target.value)} aria-label="Data final" />
              </>
            )}
            <Select value={base} onValueChange={(v) => setBase(v as "venc" | "pag")}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venc">Por vencimento</SelectItem>
                <SelectItem value="pag">Por pagamento</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-56" placeholder="Buscar descrição ou fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={fCat} onValueChange={setFCat}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo ? `${c.codigo} ` : ""}{nomeCategoria(c, catMap)}{c.nivel ? "" : " (antiga)"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fForn} onValueChange={setFForn}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os fornecedores</SelectItem>
                <SelectItem value="nenhum">Sem fornecedor</SelectItem>
                {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fForma} onValueChange={setFForma}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as formas</SelectItem>
                {FORMAS_DESPESA.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fConta} onValueChange={setFConta}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as contas</SelectItem>
                {CONTAS_DESPESA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fConc} onValueChange={setFConc}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Conciliação: todas</SelectItem>
                <SelectItem value="sim">Conciliadas</SelectItem>
                <SelectItem value="nao">Não conciliadas</SelectItem>
              </SelectContent>
            </Select>
            {filtrosAtivos && <Button variant="ghost" size="sm" onClick={limparFiltros}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
            <span className="ml-auto self-center text-sm text-muted-foreground">
              {linhas.length} lançamento(s) · {brl(totalFiltrado)}
            </span>
          </div>

          {canEdit && selecionadas.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <span className="font-medium">{selecionadas.size} selecionada(s) · {brl(totalSel)}</span>
              <Button size="sm" variant="outline" onClick={() => setBaixaLote(true)}><CircleDollarSign className="h-4 w-4 mr-1" />Dar baixa</Button>
              <Button size="sm" variant="outline" disabled={processandoLote} onClick={() => conciliarLote(true)}>Marcar conciliado</Button>
              <Button size="sm" variant="outline" disabled={processandoLote} onClick={() => conciliarLote(false)}>Marcar não conciliado</Button>
              <Button size="sm" variant="destructive" onClick={() => setExcluirLote(true)}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelecionadas(new Set())}>Limpar seleção</Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && (
                  <TableHead className="w-8">
                    <Checkbox
                      checked={todasMarcadas ? true : selecionadas.size > 0 ? "indeterminate" : false}
                      onCheckedChange={(v) => setSelecionadas(v === true ? new Set(linhas.map((d) => d.id)) : new Set())}
                      aria-label="Selecionar todas"
                    />
                  </TableHead>
                )}
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conciliação</TableHead>
                {canEdit && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((d) => (
                <TableRow key={d.id} data-state={selecionadas.has(d.id) ? "selected" : undefined}>
                  {canEdit && (
                    <TableCell className="py-1.5">
                      <Checkbox checked={selecionadas.has(d.id)} onCheckedChange={() => alternarSel(d.id)} aria-label="Selecionar" />
                    </TableCell>
                  )}
                  <TableCell className="py-1.5">
                    {d.descricao}
                    {d.parcela_total ? <span className="ml-1 text-xs text-muted-foreground">({d.parcela_atual}/{d.parcela_total})</span> : null}
                  </TableCell>
                  <TableCell className="py-1.5">{d.categoria_id ? nomeCategoria(catMap.get(d.categoria_id), catMap) : "—"}</TableCell>
                  <TableCell className="py-1.5 text-xs">{d.forma_pagamento ?? "—"}</TableCell>
                  <TableCell className="py-1.5 text-xs">{d.conta_bancaria ?? "—"}</TableCell>
                  <TableCell className="py-1.5">{fmtData(d.data_competencia)}</TableCell>
                  <TableCell className="py-1.5">{d.data_pagamento ? fmtData(d.data_pagamento) : "—"}</TableCell>
                  <TableCell className="py-1.5 text-right">{brl(num(d.valor))}</TableCell>
                  <TableCell className="py-1.5 text-right">{d.valor_pago != null ? brl(num(d.valor_pago)) : "—"}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge className={d.status === "pago" ? "status-active" : "status-warning"}>{STATUS_LABELS[d.status]}</Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => alternarConciliado.mutate(
                        { id: d.id, conciliado: !d.conciliado },
                        { onError: (e) => toast.error(errMsg(e)) },
                      )}
                      className={canEdit ? "cursor-pointer" : "cursor-default"}
                      aria-label="Alternar conciliação"
                    >
                      {d.conciliado
                        ? <Badge className="status-active">Conciliado</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Não conciliado</Badge>}
                    </button>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="py-1.5 text-right whitespace-nowrap">
                      {d.status === "pendente" && (
                        <Button variant="ghost" size="icon" onClick={() => setBaixando(d)} aria-label="Dar baixa" title="Dar baixa"><CircleDollarSign className="h-4 w-4 text-primary" /></Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setCopiando(d)} aria-label="Copiar" title="Copiar"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditando(d)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setExcluindo(d)} aria-label="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoadingAll && linhas.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 12 : 10} className="text-center text-muted-foreground">Nenhuma despesa no período</TableCell></TableRow>
              )}
              {isLoadingAll && (
                <TableRow><TableCell colSpan={canEdit ? 12 : 10} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {baixando && <DarBaixaDialog despesa={baixando} onClose={() => setBaixando(null)} />}
      {baixaLote && (
        <BaixaLoteDialog
          despesas={linhas.filter((d) => selecionadas.has(d.id))}
          onClose={(ok) => { setBaixaLote(false); if (ok) setSelecionadas(new Set()); }}
        />
      )}
      {folhaAberta && <LancarFolhaDialog mesTela={mesRef} onClose={() => setFolhaAberta(false)} />}
      {(novoAberto || editando || copiando) && (
        <DespesaDialog
          despesa={editando}
          copiaDe={copiando}
          categorias={categorias}
          mesPadrao={mesRef}
          onClose={() => { setNovoAberto(false); setEditando(null); setCopiando(null); }}
        />
      )}

      <AlertDialog open={excluirLote} onOpenChange={setExcluirLote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selecionadas.size} despesa(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Somente os lançamentos selecionados ({brl(totalSel)}) serão excluídos; parcelas futuras não marcadas permanecem. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusaoLote}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.descricao} — {brl(num(excluindo?.valor))}.
              {excluindo?.origem === "importado_historico" && " Este é um registro histórico importado."}
              {excluindo?.grupo_recorrencia_id && ` Parcela ${excluindo.parcela_atual}/${excluindo.parcela_total} de um lançamento repetido — você pode excluir só esta ou também as futuras ainda pendentes.`}
              {" "}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {excluindo?.grupo_recorrencia_id ? (
              <>
                <Button variant="outline" onClick={() => confirmarExclusao(false)}>Só esta</Button>
                <AlertDialogAction onClick={() => confirmarExclusao(true)}>Esta e as futuras pendentes</AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => confirmarExclusao(false)}>Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Escopo = "este" | "futuras";

function FornecedorPicker({ fornecedores, value, onChange }: {
  fornecedores: Fornecedor[]; value: string | null; onChange: (f: Fornecedor | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = fornecedores.find((f) => f.id === value);
  const visiveis = fornecedores.filter((f) => f.ativo || f.id === value);
  // Agrupa por tipo_pessoa (PF / PJ). Fornecedores sem tipo informado vão para um
  // grupo próprio para não sumirem da lista.
  const grupos = [
    { titulo: "PF", itens: visiveis.filter((f) => f.tipo_pessoa === "PF") },
    { titulo: "PJ", itens: visiveis.filter((f) => f.tipo_pessoa === "PJ") },
    {
      titulo: "Não informado",
      itens: visiveis.filter((f) => f.tipo_pessoa !== "PF" && f.tipo_pessoa !== "PJ"),
    },
  ].filter((g) => g.itens.length > 0);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{atual?.nome ?? "Nenhum"}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
        <Command>
          <CommandInput placeholder="Buscar fornecedor…" />
          <CommandList>
            <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__nenhum" onSelect={() => { onChange(null); setAberto(false); }}>Nenhum</CommandItem>
            </CommandGroup>
            {grupos.map((g) => (
              <CommandGroup key={g.titulo} heading={g.titulo}>
                {g.itens.map((f) => (
                  <CommandItem key={f.id} value={`${f.nome} ${f.id}`} onSelect={() => { onChange(f); setAberto(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${f.id === value ? "opacity-100" : "opacity-0"}`} />
                    {f.nome}{f.eh_funcionario && <span className="ml-2 text-xs text-muted-foreground">funcionário</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DarBaixaDialog({ despesa, onClose }: { despesa: Despesa; onClose: () => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState(despesa.data_competencia);
  const [valor, setValor] = useState(String(despesa.valor));
  const [forma, setForma] = useState<string>(despesa.forma_pagamento ?? "nenhum");
  const [conta, setConta] = useState<string>(despesa.conta_bancaria ?? "nenhum");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!data) { toast.error("Informe a data de pagamento"); return; }
    if (!Number.isFinite(v) || v < 0) { toast.error("Valor pago inválido"); return; }
    setSalvando(true);
    const { error } = await supabase.from("despesas").update({
      status: "pago",
      data_pagamento: data,
      valor_pago: Math.round(v * 100) / 100,
      forma_pagamento: forma === "nenhum" ? null : forma,
      conta_bancaria: conta === "nenhum" ? null : conta,
    } as never).eq("id", despesa.id);
    setSalvando(false);
    if (error) { toast.error("Erro ao dar baixa: " + error.message); return; }
    toast.success("Baixa registrada");
    qc.invalidateQueries({ queryKey: ["despesas"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Dar baixa</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground truncate">
          {despesa.descricao}{despesa.parcela_total ? ` (${despesa.parcela_atual}/${despesa.parcela_total})` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Data de pagamento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valor pago</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhuma</SelectItem>
                {FORMAS_DESPESA.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Conta</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhuma</SelectItem>
                {CONTAS_DESPESA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Confirmar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DespesaDialog({ despesa, copiaDe, categorias, mesPadrao, onClose }: {
  despesa: Despesa | null; copiaDe?: Despesa | null; categorias: DespesaCategoria[]; mesPadrao: Date; onClose: () => void;
}) {
  const { salvar, criarLote, atualizarFuturasGrupo } = useDespesaMutations();
  const { data: fornecedores = [] } = useFornecedores();
  const { centrais, subsPor } = useArvoreCategorias(categorias);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const hoje = format(new Date(), "yyyy-MM-dd");
  const compPadrao = format(mesPadrao, "yyyy-MM") === hoje.slice(0, 7) ? hoje : format(mesPadrao, "yyyy-MM-dd");
  // Fonte dos valores iniciais: edição usa a própria despesa; cópia usa o lançamento copiado.
  const src = despesa ?? copiaDe ?? null;

  const catInicial = src?.categoria_id ? catMap.get(src.categoria_id) : undefined;
  const ehAntiga = !!catInicial && !catInicial.nivel;
  const [centralId, setCentralId] = useState(
    catInicial?.nivel === "sub" ? catInicial.categoria_pai_id ?? "" : catInicial?.nivel === "central" ? catInicial.id : "",
  );
  const [subId, setSubId] = useState(catInicial?.nivel === "sub" ? catInicial.id : "");
  const [manterAntiga, setManterAntiga] = useState(ehAntiga);

  const [fornecedorId, setFornecedorId] = useState<string | null>(src?.fornecedor_id ?? null);
  const [descricao, setDescricao] = useState(src?.descricao ?? "");
  const [valor, setValor] = useState(src ? String(src.valor) : "");
  const [competencia, setCompetencia] = useState(src?.data_competencia ?? compPadrao);
  const [pagamento, setPagamento] = useState(despesa?.data_pagamento ?? "");
  const [tipo, setTipo] = useState<DespesaTipo>(src?.tipo ?? "fixa");
  const [status, setStatus] = useState<DespesaStatus>(despesa?.status ?? (copiaDe ? "pendente" : "pago"));
  const [observacao, setObservacao] = useState(src?.observacao ?? "");
  const [forma, setForma] = useState<string>(src?.forma_pagamento ?? "nenhum");
  // Conta padrão em lançamentos novos: Banco Inter (conta atual). Edição/cópia mantém o valor gravado.
  const [conta, setConta] = useState<string>(src ? src.conta_bancaria ?? "nenhum" : "BANCO INTER");
  const [valorPago, setValorPago] = useState(despesa?.valor_pago != null ? String(despesa.valor_pago) : "");
  const [conciliado, setConciliado] = useState(despesa?.conciliado ?? false);
  const [repetir, setRepetir] = useState(false);
  const [vezes, setVezes] = useState("2");
  const [intervalo, setIntervalo] = useState("1");
  const [unidade, setUnidade] = useState<"dias" | "meses">("meses");
  const [perguntaEscopo, setPerguntaEscopo] = useState<DespesaInput | null>(null);

  const subsDaCentral = (subsPor.get(centralId) ?? []).filter((s) => s.ativo || s.id === subId);
  const centraisVisiveis = centrais.filter((c) => c.ativo || c.id === centralId);
  const categoriaId = manterAntiga ? catInicial?.id ?? "" : subsDaCentral.length ? subId : centralId;

  const aplicarCategoria = (id: string) => {
    const c = catMap.get(id);
    if (!c) return;
    setTipo(c.tipo);
    if (!descricao.trim()) setDescricao(c.nome);
  };
  const escolherCentral = (id: string) => {
    setManterAntiga(false); setCentralId(id); setSubId("");
    if (!(subsPor.get(id) ?? []).length) aplicarCategoria(id);
  };
  const escolherSub = (id: string) => { setSubId(id); aplicarCategoria(id); };
  const escolherFornecedor = (f: Fornecedor | null) => {
    setFornecedorId(f?.id ?? null);
    const c = f?.categoria_padrao_id ? catMap.get(f.categoria_padrao_id) : undefined;
    if (!c?.nivel) return;
    setManterAntiga(false);
    if (c.nivel === "sub") { setCentralId(c.categoria_pai_id ?? ""); setSubId(c.id); }
    else { setCentralId(c.id); setSubId(""); }
    setTipo(c.tipo);
    if (!descricao.trim()) setDescricao(f!.nome);
  };

  const montarInput = (): DespesaInput | null => {
    const v = Number(valor.replace(",", "."));
    if (!categoriaId) { toast.error(subsDaCentral.length ? "Selecione a subcategoria." : "Selecione a categoria."); return null; }
    if (!descricao.trim()) { toast.error("Informe a descrição."); return null; }
    if (!Number.isFinite(v) || v <= 0) { toast.error("Informe um valor maior que zero."); return null; }
    if (!competencia) { toast.error("Informe a data de vencimento."); return null; }
    let vp: number | null = v;
    if (valorPago.trim()) {
      vp = Number(valorPago.replace(",", "."));
      if (!Number.isFinite(vp) || vp < 0) { toast.error("Valor pago inválido."); return null; }
    }
    if (status === "pendente") vp = null;
    return {
      categoria_id: categoriaId, descricao: descricao.trim(), valor: Math.round(v * 100) / 100,
      data_competencia: competencia, data_pagamento: pagamento || null, tipo, status,
      observacao: observacao.trim() || null,
      forma_pagamento: forma === "nenhum" ? null : (forma as DespesaInput["forma_pagamento"]),
      conta_bancaria: conta === "nenhum" ? null : (conta as DespesaInput["conta_bancaria"]),
      valor_pago: vp == null ? null : Math.round(vp * 100) / 100,
      conciliado, fornecedor_id: fornecedorId,
    };
  };

  const salvarEdicao = async (input: DespesaInput, escopo: Escopo) => {
    if (!despesa) return;
    try {
      await salvar.mutateAsync({ id: despesa.id, input });
      if (escopo === "futuras" && despesa.grupo_recorrencia_id) {
        const { categoria_id, descricao, valor, tipo, observacao, forma_pagamento, conta_bancaria, fornecedor_id } = input;
        await atualizarFuturasGrupo.mutateAsync({
          grupoId: despesa.grupo_recorrencia_id, aPartirDe: despesa.parcela_atual ?? 0,
          campos: { categoria_id, descricao, valor, tipo, observacao, forma_pagamento, conta_bancaria, fornecedor_id },
        });
      }
      toast.success(escopo === "futuras" ? "Despesa e parcelas futuras atualizadas" : "Despesa atualizada");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const submit = async () => {
    const input = montarInput();
    if (!input) return;
    if (despesa) {
      if (despesa.grupo_recorrencia_id) { setPerguntaEscopo(input); return; }
      return salvarEdicao(input, "este");
    }
    try {
      if (!repetir) {
        await salvar.mutateAsync({ input });
        toast.success("Despesa cadastrada");
      } else {
        const n = Number(vezes), passo = Number(intervalo);
        if (!Number.isInteger(n) || n < 2 || n > 120) return toast.error("Repetir: informe de 2 a 120 vezes.");
        if (!Number.isInteger(passo) || passo < 1) return toast.error("Repetir: intervalo deve ser 1 ou mais.");
        const grupo = crypto.randomUUID();
        const base = parseISO(competencia);
        const linhas = Array.from({ length: n }, (_, i) => {
          const venc = format(unidade === "meses" ? addMonths(base, i * passo) : addDays(base, i * passo), "yyyy-MM-dd");
          const primeira = i === 0;
          const pago = primeira && input.status === "pago";
          return {
            ...input, data_competencia: venc,
            status: (pago ? "pago" : "pendente") as DespesaStatus,
            data_pagamento: pago ? input.data_pagamento : null,
            valor_pago: pago ? input.valor_pago : null,
            conciliado: primeira ? input.conciliado : false,
            grupo_recorrencia_id: grupo, parcela_atual: i + 1, parcela_total: n, recorrente: true,
          };
        });
        await criarLote.mutateAsync(linhas);
        toast.success(`${n} despesas cadastradas`);
      }
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const salvando = salvar.isPending || criarLote.isPending || atualizarFuturasGrupo.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{despesa ? "Editar despesa" : copiaDe ? "Copiar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
        {despesa?.origem === "importado_historico" && (
          <Badge variant="outline" className="w-fit text-muted-foreground">Registro histórico importado — edite com cuidado</Badge>
        )}
        {despesa?.grupo_recorrencia_id && (
          <Badge variant="outline" className="w-fit">Parcela {despesa.parcela_atual}/{despesa.parcela_total} de um lançamento repetido</Badge>
        )}
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Fornecedor (opcional)</Label>
            <FornecedorPicker fornecedores={fornecedores} value={fornecedorId} onChange={escolherFornecedor} />
          </div>
          {manterAntiga && catInicial && (
            <p className="text-xs text-muted-foreground">
              Categoria antiga: <strong>{catInicial.nome}</strong>. Escolha uma categoria abaixo para trocar.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={manterAntiga ? "" : centralId} onValueChange={escolherCentral}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {centraisVisiveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} {c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subcategoria</Label>
              <Select value={subId} onValueChange={escolherSub} disabled={manterAntiga || !centralId || subsDaCentral.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={centralId && !manterAntiga && subsDaCentral.length === 0 ? "Sem subcategoria" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {subsDaCentral.map((s) => <SelectItem key={s.id} value={s.id}>{s.codigo} {s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as DespesaTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor pago (R$, opcional)</Label>
              <Input inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} placeholder="Igual ao valor" />
            </div>
            <div className="space-y-1">
              <Label>Status{repetir && " (1ª parcela)"}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DespesaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data de vencimento{repetir && " (1ª parcela)"}</Label>
              <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de pagamento (opcional)</Label>
              <Input type="date" value={pagamento} onChange={(e) => setPagamento(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhuma</SelectItem>
                  {FORMAS_DESPESA.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Conta</Label>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhuma</SelectItem>
                  {CONTAS_DESPESA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="conciliado" checked={conciliado} onCheckedChange={setConciliado} />
            <Label htmlFor="conciliado">Conciliado</Label>
          </div>
          {!despesa && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="repetir" checked={repetir} onCheckedChange={(v) => setRepetir(v === true)} />
                <Label htmlFor="repetir">Repetir lançamento</Label>
              </div>
              {repetir && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>por</span>
                  <Input className="w-16" inputMode="numeric" value={vezes} onChange={(e) => setVezes(e.target.value)} aria-label="Quantidade de vezes" />
                  <span>vezes — com intervalo de</span>
                  <Input className="w-16" inputMode="numeric" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} aria-label="Intervalo" />
                  <Select value={unidade} onValueChange={(v) => setUnidade(v as "dias" | "meses")}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dias">Dias</SelectItem>
                      <SelectItem value="meses">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="w-full text-xs text-muted-foreground">As parcelas seguintes são criadas como pendentes.</p>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>Observação (opcional)</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!perguntaEscopo} onOpenChange={(o) => !o && setPerguntaEscopo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar alteração a quais parcelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta despesa faz parte de um lançamento repetido. As parcelas futuras recebem descrição, valor, categoria,
              fornecedor, forma, conta e observação — datas e status de cada uma não mudam. Parcelas já pagas não são alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => { const i = perguntaEscopo!; setPerguntaEscopo(null); salvarEdicao(i, "este"); }}>Só esta</Button>
            <AlertDialogAction onClick={() => { const i = perguntaEscopo!; setPerguntaEscopo(null); salvarEdicao(i, "futuras"); }}>Esta e as futuras pendentes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
