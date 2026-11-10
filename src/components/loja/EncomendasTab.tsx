import { useMemo, useState, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BadgeCheck, FileSpreadsheet, Gift, PackageCheck, PackageOpen, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { EntregarEncomendaDialog, traduzirErroEntrega, type ItemEntrega } from "./EntregarEncomendaDialog";
import { ESTOQUE_DISPONIVEL_KEY } from "@/hooks/useEstoqueDisponivelAdmin";
import { DarBaixaPedidoDialog, type PedidoBaixa } from "./DarBaixaPedidoDialog";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";
import { estornarPedido } from "@/lib/lojaEstorno";
import { exportarEncomendasXLSX } from "@/lib/encomendasExport";

type ItemRow = {
  id: string;
  entregue_em: string | null;
  entregue_por: string | null;
  variante_entregue_id: string | null;
  variante_entregue: { tamanho: string | null } | null;
  quantidade: number;
  preco_unitario_snapshot: number;
  produtos_variantes: {
    id: string;
    produto_id: string;
    tamanho: string | null;
    cor: string | null;
    sku: string | null;
    produtos_catalogo: { nome: string } | null;
  } | null;
};

type PedidoRow = {
  id: string;
  nome: string | null;
  created_at: string;
  valor_total: number | null;
  desconto: number | null;
  valor_final: number | null;
  brinde_escolhido: string | null;
  status: string;
  promocoes: { codigo: string | null } | null;
  pedido_itens: ItemRow[];
};

type Linha = {
  key: string;
  pedidoId: string;
  itemId: string;
  varianteId: string;
  produtoId: string;
  corRaw: string | null;
  entregueEm: string | null;
  tamanhoEntregue: string | null;
  trocado: boolean;
  cliente: string;
  produto: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  valorItens: number;
  valorFinalPedido: number;
  resumoPedido: string;
  valorRecebido: number;
  cupom: string | null;
  brinde: string | null;
  data: string;
  status: string;
};

const TODOS = "__todos__";

export function EncomendasTab() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [modelo, setModelo] = useState(TODOS);
  const [cor, setCor] = useState(TODOS);
  const [tamanho, setTamanho] = useState(TODOS);
  const [recebimento, setRecebimento] = useState("todos");
  const [excluir, setExcluir] = useState<Linha | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [estornar, setEstornar] = useState<Linha | null>(null);
  const [estornando, setEstornando] = useState(false);
  const [entrega, setEntrega] = useState("todas");
  const [entregar, setEntregar] = useState<ItemEntrega | null>(null);
  const [desfazer, setDesfazer] = useState<Linha | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const [baixa, setBaixa] = useState<PedidoBaixa | null>(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["loja-encomendas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select(
          "id, nome, created_at, valor_total, desconto, valor_final, brinde_escolhido, status, promocoes(codigo), pedido_itens(id, entregue_em, entregue_por, variante_entregue_id, quantidade, preco_unitario_snapshot, variante_entregue:produtos_variantes!pedido_itens_variante_entregue_id_fkey(tamanho), produtos_variantes!pedido_itens_variante_id_fkey(id, produto_id, tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .eq("eh_encomenda", true)
        .in("status", ["pago", "estornado", "aguardando_pagamento"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PedidoRow[];
    },
  });

  const linhas = useMemo(() => {
    const out: Linha[] = [];
    for (const p of pedidos) {
      const itens = p.pedido_itens || [];
      const somaItens = itens.reduce(
        (s, it) => s + Number(it.preco_unitario_snapshot) * it.quantidade,
        0,
      );
      const valorFinal = Number(p.valor_final ?? somaItens);
      const resumoPedido = itens
        .filter((it) => it.produtos_variantes)
        .map((it) => {
          const v = it.produtos_variantes!;
          return `${it.quantidade}x ${v.produtos_catalogo?.nome || "Produto removido"} (${v.cor || "—"} / ${v.tamanho || "—"})`;
        })
        .join(", ");
      itens.forEach((it, idx) => {
        const v = it.produtos_variantes;
        if (!v) return;
        const valorItens = Number(it.preco_unitario_snapshot) * it.quantidade;
        const proporcao = somaItens > 0 ? valorItens / somaItens : 0;
        out.push({
          key: `${p.id}-${v.id}-${idx}`,
          pedidoId: p.id,
          itemId: it.id,
          varianteId: v.id,
          produtoId: v.produto_id,
          corRaw: v.cor,
          entregueEm: it.entregue_em,
          tamanhoEntregue: it.entregue_em ? (it.variante_entregue?.tamanho ?? v.tamanho ?? "—") : null,
          trocado: !!it.variante_entregue_id && it.variante_entregue_id !== v.id,
          cliente: p.nome || "Cliente não informado",
          produto: v.produtos_catalogo?.nome || "Produto removido",
          cor: v.cor || "—",
          tamanho: v.tamanho || "—",
          quantidade: it.quantidade,
          valorItens,
          valorFinalPedido: valorFinal,
          resumoPedido,
          valorRecebido:
            p.status === "aguardando_pagamento" ? 0 : Math.round(valorFinal * proporcao * 100) / 100,
          cupom: p.promocoes?.codigo ?? null,
          brinde: p.brinde_escolhido ?? null,
          data: p.created_at,
          status: p.status,
        });
      });
    }
    return out;
  }, [pedidos]);

  const opcoes = useMemo(() => {
    const uniq = (vals: string[]) => Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      modelos: uniq(linhas.map((l) => l.produto)),
      cores: uniq(linhas.map((l) => l.cor)),
      tamanhos: uniq(linhas.map((l) => l.tamanho)),
    };
  }, [linhas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return linhas.filter((l) => {
      if (termo) {
        const alvo = `${l.cliente} ${l.produto} ${l.cor} ${l.tamanho} ${l.brinde ?? ""}`.toLocaleLowerCase("pt-BR");
        if (!alvo.includes(termo)) return false;
      }
      const dia = l.data.slice(0, 10);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      if (modelo !== TODOS && l.produto !== modelo) return false;
      if (cor !== TODOS && l.cor !== cor) return false;
      if (tamanho !== TODOS && l.tamanho !== tamanho) return false;
      if (recebimento === "pagos" && l.valorRecebido <= 0) return false;
      if (recebimento === "gratuitos" && l.valorRecebido > 0) return false;
      if (entrega === "pendentes" && !(l.status === "pago" && !l.entregueEm)) return false;
      if (entrega === "entregues" && !l.entregueEm) return false;
      return true;
    });
  }, [linhas, busca, de, ate, modelo, cor, tamanho, recebimento, entrega]);

  const grupos = useMemo(() => {
    const map = new Map<string, Linha[]>();
    for (const l of filtradas) {
      const arr = map.get(l.produto) || [];
      arr.push(l);
      map.set(l.produto, arr);
    }
    return Array.from(map.entries());
  }, [filtradas]);

  const totalQtd = filtradas.reduce((s, l) => s + l.quantidade, 0);
  const totalRecebido = filtradas.reduce((s, l) => s + l.valorRecebido, 0);
  const temFiltro =
    !!busca || !!de || !!ate || modelo !== TODOS || cor !== TODOS || tamanho !== TODOS || recebimento !== "todos" || entrega !== "todas";
  const pendentesEntrega = filtradas.filter((l) => l.status === "pago" && !l.entregueEm).length;

  const limpar = () => {
    setBusca("");
    setDe("");
    setAte("");
    setModelo(TODOS);
    setCor(TODOS);
    setTamanho(TODOS);
    setRecebimento("todos");
    setEntrega("todas");
  };

  const invalidarEntrega = () => {
    qc.invalidateQueries({ queryKey: ["loja-encomendas"] });
    qc.invalidateQueries({ queryKey: ["loja-pedidos"] });
    qc.invalidateQueries({ queryKey: ["compras-loja-aluno"] });
    qc.invalidateQueries({ queryKey: ESTOQUE_DISPONIVEL_KEY });
    qc.invalidateQueries({ queryKey: ["loja-variantes-resumo"] });
    qc.invalidateQueries({ queryKey: ["loja-variantes"] });
    qc.invalidateQueries({ queryKey: ["loja-movimentos"] });
    qc.invalidateQueries({ queryKey: ["loja-entrega-variantes"] });
    qc.invalidateQueries({ queryKey: ["loja", "produtos"] });
  };

  const confirmarDesfazer = async () => {
    if (!desfazer) return;
    setDesfazendo(true);
    try {
      const { error } = await (supabase as any).rpc("fn_loja_desfazer_entrega", { p_item_id: desfazer.itemId });
      if (error) throw error;
      toast.success("Entrega desfeita");
      invalidarEntrega();
      setDesfazer(null);
    } catch (e: any) {
      toast.error("Não foi possível desfazer", { description: traduzirErroEntrega(e.message) });
    } finally {
      setDesfazendo(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setExcluindo(true);
    try {
      const { data, error } = await (supabase as any).rpc("fn_loja_excluir_pedido", {
        p_pedido_id: excluir.pedidoId,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao excluir o pedido");
      toast.success("Pedido excluído");
      qc.invalidateQueries({ queryKey: ["loja-encomendas"] });
      qc.invalidateQueries({ queryKey: ["loja-pedidos"] });
      setExcluir(null);
    } catch (e: any) {
      toast.error("Não foi possível excluir", { description: e.message });
    } finally {
      setExcluindo(false);
    }
  };

  const confirmarEstorno = async () => {
    if (!estornar) return;
    setEstornando(true);
    try {
      await estornarPedido(estornar.pedidoId);
      toast.success("Pedido estornado", { description: "O valor será devolvido ao cliente." });
      qc.invalidateQueries({ queryKey: ["loja-encomendas"] });
      qc.invalidateQueries({ queryKey: ["loja-pedidos"] });
      qc.invalidateQueries({ queryKey: ["compras-loja-aluno"] });
      setEstornar(null);
    } catch (e: any) {
      toast.error("Não foi possível estornar", { description: e.message });
    } finally {
      setEstornando(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label className="text-xs">Buscar</Label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, modelo, cor ou tamanho"
          />
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Modelo</Label>
          <Select value={modelo} onValueChange={setModelo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opcoes.modelos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Cor</Label>
          <Select value={cor} onValueChange={setCor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {opcoes.cores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tamanho</Label>
          <Select value={tamanho} onValueChange={setTamanho}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opcoes.tamanhos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Valor recebido</Label>
          <Select value={recebimento} onValueChange={setRecebimento}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pagos">Somente pagos</SelectItem>
              <SelectItem value="gratuitos">Somente gratuitos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Entrega</Label>
          <Select value={entrega} onValueChange={setEntrega}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="entregues">Entregues</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-muted-foreground">
            {filtradas.length} {filtradas.length === 1 ? "item" : "itens"} — {totalQtd} peça(s) — recebido{" "}
            {formatBRL(totalRecebido)} — {pendentesEntrega} pendente(s) de entrega
          </p>
          <div className="flex items-center gap-2">
            {temFiltro && (
              <Button size="sm" variant="ghost" onClick={limpar} className="gap-1">
                <X className="w-3.5 h-3.5" /> Limpar filtros
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                if (!filtradas.length) {
                  toast.error("Nada para exportar");
                  return;
                }
                exportarEncomendasXLSX(filtradas, { de, ate });
              }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
            </Button>
          </div>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-lg border border-border py-12 flex flex-col items-center gap-2 text-muted-foreground">
          <PackageOpen className="w-8 h-8" />
          <p className="text-sm">
            {linhas.length === 0 ? "Nenhuma encomenda registrada ainda." : "Nenhuma encomenda com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Valor dos itens</TableHead>
                <TableHead className="text-right">Valor recebido</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map(([produto, itens]) => {
                const subQtd = itens.reduce((s, l) => s + l.quantidade, 0);
                const subItens = itens.reduce((s, l) => s + l.valorItens, 0);
                const subRecebido = itens.reduce((s, l) => s + l.valorRecebido, 0);
                return (
                  <Fragment key={produto}>
                    {itens.map((l) => (
                      <TableRow key={l.key}>
                        <TableCell className="font-medium">
                          {l.cliente}
                          {l.cupom && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              cupom {l.cupom}
                            </Badge>
                          )}
                          {l.brinde && (
                            <Badge variant="outline" className="ml-2 gap-1 text-[10px]">
                              <Gift className="w-3 h-3 text-primary" />
                              Brinde: {l.brinde}
                            </Badge>
                          )}
                          {l.status === "estornado" && (
                            <Badge variant="outline" className="ml-2 status-urgent text-[10px]">
                              Estornado
                            </Badge>
                          )}
                          {l.status === "aguardando_pagamento" && (
                            <Badge variant="outline" className="ml-2 status-warning text-[10px]">
                              Aguardando pagamento
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{l.produto}</TableCell>
                        <TableCell>{l.cor}</TableCell>
                        <TableCell>{l.tamanho}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(l.data).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">{l.quantidade}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatBRL(l.valorItens)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatBRL(l.valorRecebido)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {l.entregueEm ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="outline" className="status-success text-[10px] w-fit">
                                Entregue {new Date(l.entregueEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              </Badge>
                              {l.trocado && (
                                <span className="text-[10px] text-muted-foreground">trocado {l.tamanho} → {l.tamanhoEntregue}</span>
                              )}
                            </div>
                          ) : l.status === "pago" ? (
                            <Badge variant="outline" className="status-warning text-[10px]">Pendente</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {l.status === "pago" && !l.entregueEm && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Entregar"
                              onClick={() =>
                                setEntregar({
                                  itemId: l.itemId,
                                  varianteId: l.varianteId,
                                  produtoId: l.produtoId,
                                  cliente: l.cliente,
                                  produto: l.produto,
                                  cor: l.cor,
                                  corRaw: l.corRaw,
                                  tamanho: l.tamanho,
                                  quantidade: l.quantidade,
                                })
                              }
                            >
                              <PackageCheck className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {l.entregueEm && (
                            <Button size="icon" variant="ghost" title="Desfazer entrega" onClick={() => setDesfazer(l)}>
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          )}
                          {l.status === "aguardando_pagamento" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setBaixa({
                                  id: l.pedidoId,
                                  nome: l.cliente,
                                  valor_final: l.valorFinalPedido,
                                  resumo: l.resumoPedido,
                                })
                              }
                              title="Dar baixa (pagamento presencial)"
                            >
                              <BadgeCheck className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {l.status === "pago" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEstornar(l)}
                              title="Estornar pedido"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => setExcluir(l)} title="Excluir pedido">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow key={`${produto}-subtotal`} className="bg-secondary/40">
                      <TableCell colSpan={5} className="text-xs font-semibold text-muted-foreground">
                        Subtotal — {produto}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">{subQtd}</TableCell>
                      <TableCell className="text-right text-xs font-semibold text-muted-foreground">
                        {formatBRL(subItens)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">{formatBRL(subRecebido)}</TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </Fragment>
                );
              })}
              <TableRow className="bg-secondary/60">
                <TableCell colSpan={5} className="text-xs font-bold">Total geral</TableCell>
                <TableCell className="text-right text-xs font-bold">{totalQtd}</TableCell>
                <TableCell />
                <TableCell className="text-right text-xs font-bold">{formatBRL(totalRecebido)}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir && (
                <>
                  Pedido de <strong>{excluir.cliente}</strong> — {excluir.produto} ({excluir.cor} / {excluir.tamanho}),
                  valor recebido {formatBRL(excluir.valorRecebido)}. O pedido inteiro será removido, o estoque
                  reservado volta e as tentativas de pagamento são apagadas. Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
              disabled={excluindo}
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>

      <AlertDialog open={!!estornar} onOpenChange={(o) => !o && setEstornar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja estornar este pedido? O valor será devolvido ao cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={estornando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarEstorno();
              }}
              disabled={estornando}
            >
              {estornando ? "Estornando..." : "Estornar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EntregarEncomendaDialog item={entregar} onClose={() => setEntregar(null)} onDone={invalidarEntrega} />

      <AlertDialog open={!!desfazer} onOpenChange={(o) => !o && setDesfazer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              {desfazer && <>{desfazer.cliente} — {desfazer.produto} ({desfazer.cor} / {desfazer.tamanhoEntregue}). </>}
              A peça volta para o estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desfazendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarDesfazer();
              }}
              disabled={desfazendo}
            >
              {desfazendo ? "Desfazendo..." : "Desfazer entrega"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DarBaixaPedidoDialog pedido={baixa} onOpenChange={(o) => !o && setBaixa(null)} />
    </div>
  );
}
