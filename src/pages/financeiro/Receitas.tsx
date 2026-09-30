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
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Wallet, TrendingUp, TrendingDown, HandCoins } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  useReceitasPeriodo, useCategoriasReceita, useReceitaMutations, useCategoriaReceitaMutations, useUsoCategoriasReceita,
} from "@/hooks/useReceitas";
import {
  STATUS_RECEITA_LABELS, FORMAS_RECEITA, CONTAS_RECEITA,
  type Receita, type ReceitaCategoria, type ReceitaInput, type ReceitaStatus,
} from "@/types/receitas";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;
const fmtData = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
/** Valor efetivamente recebido (fallback para o valor quando não informado). */
const recebido = (r: Receita) => (r.valor_recebido != null ? num(r.valor_recebido) : num(r.valor));

const SEM_FORMA = "SEM FORMA";
const FORMA_KEYS = [...FORMAS_RECEITA.map((f) => f.value as string), SEM_FORMA];
const FORMA_LABEL: Record<string, string> = {
  ...Object.fromEntries(FORMAS_RECEITA.map((f) => [f.value, f.label])),
  [SEM_FORMA]: "Não informada",
};
const FORMA_COR: Record<string, string> = {
  PIX: "hsl(var(--primary))",
  BOLETO: "hsl(217 91% 60%)",
  DINHEIRO: "hsl(38 92% 50%)",
  "CARTÃO DE DÉBITO": "hsl(280 65% 60%)",
  "CARTÃO DE CRÉDITO": "hsl(0 72% 60%)",
  "REPASSE AGREGADOR": "hsl(180 60% 45%)",
  [SEM_FORMA]: "hsl(var(--muted-foreground))",
};

export default function Receitas() {
  const { data: roles } = useUserRoles();
  const canEdit = !!roles?.isCoordAdmin;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold">Receitas</h1>
        <p className="text-sm text-muted-foreground">Lançamentos de receitas da Fortem, mês a mês.</p>
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
  const [fForma, setFForma] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");
  const [editando, setEditando] = useState<Receita | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<Receita | null>(null);

  const inicio12 = format(startOfMonth(addMonths(mesRef, -11)), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(mesRef), "yyyy-MM-dd");
  const mesKey = format(mesRef, "yyyy-MM");
  const mesAntKey = format(addMonths(mesRef, -1), "yyyy-MM");

  const { data: receitas = [], isLoading } = useReceitasPeriodo(inicio12, fimMes);
  const { data: categorias = [] } = useCategoriasReceita(false);
  const { excluir, alternarConciliado } = useReceitaMutations();
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const { porForma, totalMes, totalAnt, chart } = useMemo(() => {
    const byMes: Record<string, Record<string, number>> = {};
    receitas.forEach((r) => {
      const k = r.data_competencia.slice(0, 7);
      const f = r.forma_recebimento ?? SEM_FORMA;
      byMes[k] ??= {};
      byMes[k][f] = (byMes[k][f] ?? 0) + recebido(r);
    });
    const soma = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((s, v) => s + v, 0);
    const chart = Array.from({ length: 12 }, (_, i) => {
      const dt = addMonths(mesRef, i - 11);
      const k = format(dt, "yyyy-MM");
      const lbl = `${format(dt, "MMM", { locale: ptBR }).replace(".", "")}/${format(dt, "yy")}`;
      return { label: lbl, ...Object.fromEntries(FORMA_KEYS.map((f) => [f, byMes[k]?.[f] ?? 0])) };
    });
    return { porForma: byMes[mesKey] ?? {}, totalMes: soma(byMes[mesKey]), totalAnt: soma(byMes[mesAntKey]), chart };
  }, [receitas, mesRef, mesKey, mesAntKey]);

  const formasNoPeriodo = FORMA_KEYS.filter((f) => chart.some((c) => num((c as Record<string, unknown>)[f]) > 0));
  const formasMes = FORMA_KEYS.filter((f) => (porForma[f] ?? 0) > 0);
  const variacao = totalAnt > 0 ? ((totalMes - totalAnt) / totalAnt) * 100 : null;

  const linhas = useMemo(() => receitas
    .filter((r) => r.data_competencia.startsWith(mesKey))
    .filter((r) => fCat === "todas" || r.categoria_id === fCat)
    .filter((r) => fForma === "todas" || (r.forma_recebimento ?? SEM_FORMA) === fForma)
    .filter((r) => fStatus === "todos" || r.status === fStatus),
  [receitas, mesKey, fCat, fForma, fStatus]);
  const totalFiltrado = linhas.reduce((s, r) => s + recebido(r), 0);

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      await excluir.mutateAsync(excluindo.id);
      toast.success("Receita excluída");
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
          <Button onClick={() => setNovoAberto(true)}><Plus className="h-4 w-4 mr-1" /> Nova Receita</Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total recebido no mês" value={brl(totalMes)} icon={Wallet} />
        <KpiCard
          label="Vs. mês anterior"
          value={variacao === null ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}%`}
          icon={variacao !== null && variacao < 0 ? TrendingDown : TrendingUp}
          tone={variacao !== null && variacao < 0 ? "danger" : "default"}
          hint={`Mês anterior: ${brl(totalAnt)}`}
        />
        <Card className="glass-card col-span-2">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <HandCoins className="h-4 w-4" /> Por forma de recebimento
            </div>
            {formasMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem recebimentos no mês</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {formasMes.map((f) => (
                  <div key={f} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: FORMA_COR[f] }} />
                      {FORMA_LABEL[f]}
                    </span>
                    <span className="font-medium">{brl(porForma[f])}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
                {formasNoPeriodo.map((f) => (
                  <Bar key={f} dataKey={f} name={FORMA_LABEL[f]} stackId="a" fill={FORMA_COR[f]} />
                ))}
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
            <Select value={fForma} onValueChange={setFForma}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as formas</SelectItem>
                {FORMA_KEYS.map((f) => <SelectItem key={f} value={f}>{FORMA_LABEL[f]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
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
                <TableHead>Data Recebimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Valor Recebido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conciliação</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="py-1.5">{r.descricao}</TableCell>
                  <TableCell className="py-1.5">{r.categoria_id ? catMap.get(r.categoria_id)?.nome ?? "—" : "—"}</TableCell>
                  <TableCell className="py-1.5 text-xs">{r.forma_recebimento ?? "—"}</TableCell>
                  <TableCell className="py-1.5 text-xs">{r.conta_bancaria ?? "—"}</TableCell>
                  <TableCell className="py-1.5">{fmtData(r.data_recebimento)}</TableCell>
                  <TableCell className="py-1.5 text-right">{brl(num(r.valor))}</TableCell>
                  <TableCell className="py-1.5 text-right">{r.valor_recebido != null ? brl(num(r.valor_recebido)) : "—"}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge className={r.status === "recebido" ? "status-active" : "status-warning"}>{STATUS_RECEITA_LABELS[r.status] ?? r.status}</Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => alternarConciliado.mutate(
                        { id: r.id, conciliado: !r.conciliado },
                        { onError: (e) => toast.error(errMsg(e)) },
                      )}
                      className={canEdit ? "cursor-pointer" : "cursor-default"}
                      aria-label="Alternar conciliação"
                    >
                      {r.conciliado
                        ? <Badge className="status-active">Conciliado</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Não conciliado</Badge>}
                    </button>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="py-1.5 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setEditando(r)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setExcluindo(r)} aria-label="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && linhas.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground">Nenhuma receita no período</TableCell></TableRow>
              )}
              {isLoading && (
                <TableRow><TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(novoAberto || editando) && (
        <ReceitaDialog
          receita={editando}
          categorias={categorias}
          mesPadrao={mesRef}
          onClose={() => { setNovoAberto(false); setEditando(null); }}
        />
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
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

function ReceitaDialog({ receita, categorias, mesPadrao, onClose }: {
  receita: Receita | null; categorias: ReceitaCategoria[]; mesPadrao: Date; onClose: () => void;
}) {
  const { salvar } = useReceitaMutations();
  const hoje = format(new Date(), "yyyy-MM-dd");
  const compPadrao = format(mesPadrao, "yyyy-MM") === hoje.slice(0, 7) ? hoje : format(mesPadrao, "yyyy-MM-dd");
  const [categoriaId, setCategoriaId] = useState(receita?.categoria_id ?? "");
  const [descricao, setDescricao] = useState(receita?.descricao ?? "");
  const [valor, setValor] = useState(receita ? String(receita.valor) : "");
  const [valorRecebido, setValorRecebido] = useState(receita?.valor_recebido != null ? String(receita.valor_recebido) : "");
  const [competencia, setCompetencia] = useState(receita?.data_competencia ?? compPadrao);
  const [dataReceb, setDataReceb] = useState(receita?.data_recebimento ?? "");
  const [status, setStatus] = useState<ReceitaStatus>(receita?.status ?? "recebido");
  const [observacao, setObservacao] = useState(receita?.observacao ?? "");
  const [forma, setForma] = useState<string>(receita?.forma_recebimento ?? "nenhum");
  const [conta, setConta] = useState<string>(receita?.conta_bancaria ?? "nenhum");
  const [conciliado, setConciliado] = useState(receita?.conciliado ?? false);

  const catsVisiveis = categorias.filter((c) => c.ativo || c.id === receita?.categoria_id);

  const escolherCategoria = (id: string) => {
    setCategoriaId(id);
    const c = categorias.find((x) => x.id === id);
    if (c && !descricao.trim()) setDescricao(c.nome);
  };

  const submit = async () => {
    const v = Number(valor.replace(",", "."));
    if (!categoriaId) return toast.error("Selecione a categoria.");
    if (!descricao.trim()) return toast.error("Informe a descrição.");
    if (!Number.isFinite(v) || v <= 0) return toast.error("Informe um valor maior que zero.");
    if (!competencia) return toast.error("Informe a data de competência.");
    let vr = v;
    if (valorRecebido.trim()) {
      vr = Number(valorRecebido.replace(",", "."));
      if (!Number.isFinite(vr) || vr < 0) return toast.error("Valor recebido inválido.");
    }
    const input: ReceitaInput = {
      categoria_id: categoriaId, descricao: descricao.trim(), valor: Math.round(v * 100) / 100,
      valor_recebido: Math.round(vr * 100) / 100,
      data_competencia: competencia, data_recebimento: dataReceb || null, status,
      observacao: observacao.trim() || null,
      forma_recebimento: forma === "nenhum" ? null : (forma as ReceitaInput["forma_recebimento"]),
      conta_bancaria: conta === "nenhum" ? null : (conta as ReceitaInput["conta_bancaria"]),
      conciliado,
    };
    try {
      await salvar.mutateAsync({ id: receita?.id, input });
      toast.success(receita ? "Receita atualizada" : "Receita cadastrada");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{receita ? "Editar receita" : "Nova receita"}</DialogTitle></DialogHeader>
        {receita?.origem === "importado_historico" && (
          <Badge variant="outline" className="w-fit text-muted-foreground">Registro histórico importado — edite com cuidado</Badge>
        )}
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={escolherCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {catsVisiveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
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
              <Label>Valor recebido (R$, opcional)</Label>
              <Input inputMode="decimal" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} placeholder="Igual ao valor" />
            </div>
            <div className="space-y-1">
              <Label>Data de competência</Label>
              <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de recebimento (opcional)</Label>
              <Input type="date" value={dataReceb} onChange={(e) => setDataReceb(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ReceitaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="previsto">Previsto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Forma de recebimento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhuma</SelectItem>
                  {FORMAS_RECEITA.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Conta</Label>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhuma</SelectItem>
                  {CONTAS_RECEITA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="conciliado-receita" checked={conciliado} onCheckedChange={setConciliado} />
            <Label htmlFor="conciliado-receita">Conciliado</Label>
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
  const { data: categorias = [], isLoading } = useCategoriasReceita(false);
  const { data: uso = {} } = useUsoCategoriasReceita();
  const { salvar, alternarAtivo, excluir } = useCategoriaReceitaMutations();
  const [nome, setNome] = useState("");
  const tiposExistentes = useMemo(() => Array.from(new Set(categorias.map((c) => c.tipo).filter(Boolean))).sort(), [categorias]);
  const [tipo, setTipo] = useState("");
  const tipoAtual = tipo || tiposExistentes[0] || "origem";

  const criar = async () => {
    try {
      await salvar.mutateAsync({ nome, tipo: tipoAtual });
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
            {tiposExistentes.length > 0 && (
              <Select value={tipoAtual} onValueChange={setTipo}>
                <SelectTrigger className="w-36 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tiposExistentes.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
                  <TableCell className="py-1.5"><Badge variant="outline" className="capitalize">{c.tipo || "—"}</Badge></TableCell>
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
