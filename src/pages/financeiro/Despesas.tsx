import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Receipt, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  useDespesasPeriodo, useCategoriasDespesa, useDespesaMutations, useCategoriaMutations, useUsoCategorias,
} from "@/hooks/useDespesas";
import {
  TIPO_LABELS, STATUS_LABELS, FORMAS_DESPESA, CONTAS_DESPESA, type Despesa, type DespesaCategoria, type DespesaInput, type DespesaStatus, type DespesaTipo,
} from "@/types/despesas";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;
const fmtData = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

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
        </TabsList>
        <TabsContent value="lancamentos"><Lancamentos canEdit={canEdit} /></TabsContent>
        <TabsContent value="categorias"><Categorias canEdit={canEdit} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Lancamentos({ canEdit }: { canEdit: boolean }) {
  const [mesRef, setMesRef] = useState(() => startOfMonth(new Date()));
  const [fCat, setFCat] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<Despesa | null>(null);

  const inicio12 = format(startOfMonth(addMonths(mesRef, -11)), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(mesRef), "yyyy-MM-dd");
  const mesKey = format(mesRef, "yyyy-MM");
  const mesAntKey = format(addMonths(mesRef, -1), "yyyy-MM");

  const { data: despesas = [], isLoading } = useDespesasPeriodo(inicio12, fimMes);
  const { data: categorias = [] } = useCategoriasDespesa(false);
  const { excluir, alternarConciliado } = useDespesaMutations();
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

  const linhas = useMemo(() => despesas
    .filter((d) => d.data_competencia.startsWith(mesKey))
    .filter((d) => fCat === "todas" || d.categoria_id === fCat)
    .filter((d) => fTipo === "todos" || d.tipo === fTipo)
    .filter((d) => fStatus === "todos" || d.status === fStatus),
  [despesas, mesKey, fCat, fTipo, fStatus]);
  const totalFiltrado = linhas.reduce((s, d) => s + num(d.valor), 0);

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      await excluir.mutateAsync(excluindo.id);
      toast.success("Despesa excluída");
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
          <Input
            type="month"
            className="w-40"
            value={mesKey}
            onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-").map(Number); setMesRef(new Date(y, m - 1, 1)); } }}
            aria-label="Ir para mês"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setNovoAberto(true)}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>
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
          <div className="flex flex-wrap gap-2">
            <Select value={fCat} onValueChange={setFCat}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto self-center text-sm text-muted-foreground">
              {linhas.length} lançamento(s) · {brl(totalFiltrado)}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
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
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="py-1.5">{d.descricao}</TableCell>
                  <TableCell className="py-1.5">{d.categoria_id ? catMap.get(d.categoria_id)?.nome ?? "—" : "—"}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => setEditando(d)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setExcluindo(d)} aria-label="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && linhas.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 11 : 10} className="text-center text-muted-foreground">Nenhuma despesa no período</TableCell></TableRow>
              )}
              {isLoading && (
                <TableRow><TableCell colSpan={canEdit ? 11 : 10} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(novoAberto || editando) && (
        <DespesaDialog
          despesa={editando}
          categorias={categorias}
          mesPadrao={mesRef}
          onClose={() => { setNovoAberto(false); setEditando(null); }}
        />
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.descricao} — {brl(num(excluindo?.valor))}.
              {excluindo?.origem === "importado_historico" && " Este é um registro histórico importado."} Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DespesaDialog({ despesa, categorias, mesPadrao, onClose }: {
  despesa: Despesa | null; categorias: DespesaCategoria[]; mesPadrao: Date; onClose: () => void;
}) {
  const { salvar } = useDespesaMutations();
  const hoje = format(new Date(), "yyyy-MM-dd");
  const compPadrao = format(mesPadrao, "yyyy-MM") === hoje.slice(0, 7) ? hoje : format(mesPadrao, "yyyy-MM-dd");
  const [categoriaId, setCategoriaId] = useState(despesa?.categoria_id ?? "");
  const [descricao, setDescricao] = useState(despesa?.descricao ?? "");
  const [valor, setValor] = useState(despesa ? String(despesa.valor) : "");
  const [competencia, setCompetencia] = useState(despesa?.data_competencia ?? compPadrao);
  const [pagamento, setPagamento] = useState(despesa?.data_pagamento ?? "");
  const [tipo, setTipo] = useState<DespesaTipo>(despesa?.tipo ?? "fixa");
  const [status, setStatus] = useState<DespesaStatus>(despesa?.status ?? "pago");
  const [forma, setForma] = useState<string>(despesa?.forma_pagamento ?? "nenhum");
  const [conta, setConta] = useState<string>(despesa?.conta_bancaria ?? "nenhum");
  const [valorPago, setValorPago] = useState(despesa?.valor_pago != null ? String(despesa.valor_pago) : "");
  const [conciliado, setConciliado] = useState(despesa?.conciliado ?? false);

  const catsVisiveis = categorias.filter((c) => c.ativo || c.id === despesa?.categoria_id);

  const escolherCategoria = (id: string) => {
    setCategoriaId(id);
    const c = categorias.find((x) => x.id === id);
    if (c) { setTipo(c.tipo); if (!descricao.trim()) setDescricao(c.nome); }
  };

  const submit = async () => {
    const v = Number(valor.replace(",", "."));
    if (!categoriaId) return toast.error("Selecione a categoria.");
    if (!descricao.trim()) return toast.error("Informe a descrição.");
    if (!Number.isFinite(v) || v <= 0) return toast.error("Informe um valor maior que zero.");
    if (!competencia) return toast.error("Informe a data de vencimento.");
    let vp = v;
    if (valorPago.trim()) {
      vp = Number(valorPago.replace(",", "."));
      if (!Number.isFinite(vp) || vp < 0) return toast.error("Valor pago inválido.");
    }
    const input: DespesaInput = {
      categoria_id: categoriaId, descricao: descricao.trim(), valor: Math.round(v * 100) / 100,
      data_competencia: competencia, data_pagamento: pagamento || null, tipo, status,
      observacao: observacao.trim() || null,
      forma_pagamento: forma === "nenhum" ? null : (forma as DespesaInput["forma_pagamento"]),
      conta_bancaria: conta === "nenhum" ? null : (conta as DespesaInput["conta_bancaria"]),
      valor_pago: Math.round(vp * 100) / 100,
      conciliado,
    };
    try {
      await salvar.mutateAsync({ id: despesa?.id, input });
      toast.success(despesa ? "Despesa atualizada" : "Despesa cadastrada");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{despesa ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
        {despesa?.origem === "importado_historico" && (
          <Badge variant="outline" className="w-fit text-muted-foreground">Registro histórico importado — edite com cuidado</Badge>
        )}
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={escolherCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {catsVisiveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({TIPO_LABELS[c.tipo]})</SelectItem>)}
              </SelectContent>
            </Select>
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DespesaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data de vencimento</Label>
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
          <div className="space-y-1">
            <Label>Observação (opcional)</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Categorias({ canEdit }: { canEdit: boolean }) {
  const { data: categorias = [], isLoading } = useCategoriasDespesa(false);
  const { data: uso = {} } = useUsoCategorias();
  const { salvar, alternarAtivo, excluir } = useCategoriaMutations();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<DespesaTipo>("fixa");

  const criar = async () => {
    try {
      await salvar.mutateAsync({ nome, tipo });
      toast.success("Categoria criada");
      setNome("");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Card className="glass-card">
      <CardContent className="pt-4 space-y-3">
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1 flex-1 min-w-48">
              <Label>Nova categoria</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" />
            </div>
            <Select value={tipo} onValueChange={(v) => setTipo(v as DespesaTipo)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={criar} disabled={salvar.isPending || !nome.trim()}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Lançamentos</TableHead>
              <TableHead>Ativa</TableHead>
              {canEdit && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.map((c) => {
              const qtd = uso[c.id] ?? 0;
              return (
                <TableRow key={c.id} className={c.ativo ? "" : "opacity-60"}>
                  <TableCell className="py-1.5">{c.nome}</TableCell>
                  <TableCell className="py-1.5"><Badge variant={c.tipo === "fixa" ? "secondary" : "outline"}>{TIPO_LABELS[c.tipo]}</Badge></TableCell>
                  <TableCell className="py-1.5 text-right">{qtd}</TableCell>
                  <TableCell className="py-1.5">
                    <Switch
                      checked={c.ativo}
                      disabled={!canEdit}
                      onCheckedChange={(v) => alternarAtivo.mutate({ id: c.id, ativo: v }, { onError: (e) => toast.error(errMsg(e)) })}
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="py-1.5 text-right">
                      {qtd === 0 && (
                        <Button variant="ghost" size="icon" aria-label="Excluir categoria"
                          onClick={() => excluir.mutate(c.id, {
                            onSuccess: () => toast.success("Categoria excluída"),
                            onError: (e) => toast.error(errMsg(e)),
                          })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {!isLoading && categorias.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma categoria</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
