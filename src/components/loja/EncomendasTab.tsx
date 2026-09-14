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
import { Gift, PackageOpen, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";
import { estornarPedido } from "@/lib/lojaEstorno";

type ItemRow = {
  quantidade: number;
  preco_unitario_snapshot: number;
  produtos_variantes: {
    id: string;
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
  promocoes: { codigo: string | null } | null;
  pedido_itens: ItemRow[];
};

type Linha = {
  key: string;
  pedidoId: string;
  cliente: string;
  produto: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  valorItens: number;
  valorRecebido: number;
  cupom: string | null;
  brinde: string | null;
  data: string;
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

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["loja-encomendas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select(
          "id, nome, created_at, valor_total, desconto, valor_final, brinde_escolhido, promocoes(codigo), pedido_itens(quantidade, preco_unitario_snapshot, produtos_variantes(id, tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .eq("eh_encomenda", true)
        .eq("status", "pago")
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
      itens.forEach((it, idx) => {
        const v = it.produtos_variantes;
        if (!v) return;
        const valorItens = Number(it.preco_unitario_snapshot) * it.quantidade;
        const proporcao = somaItens > 0 ? valorItens / somaItens : 0;
        out.push({
          key: `${p.id}-${v.id}-${idx}`,
          pedidoId: p.id,
          cliente: p.nome || "Cliente não informado",
          produto: v.produtos_catalogo?.nome || "Produto removido",
          cor: v.cor || "—",
          tamanho: v.tamanho || "—",
          quantidade: it.quantidade,
          valorItens,
          valorRecebido: Math.round(valorFinal * proporcao * 100) / 100,
          cupom: p.promocoes?.codigo ?? null,
          brinde: p.brinde_escolhido ?? null,
          data: p.created_at,
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
      return true;
    });
  }, [linhas, busca, de, ate, modelo, cor, tamanho, recebimento]);

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
    !!busca || !!de || !!ate || modelo !== TODOS || cor !== TODOS || tamanho !== TODOS || recebimento !== "todos";

  const limpar = () => {
    setBusca("");
    setDe("");
    setAte("");
    setModelo(TODOS);
    setCor(TODOS);
    setTamanho(TODOS);
    setRecebimento("todos");
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
        <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-muted-foreground">
            {filtradas.length} {filtradas.length === 1 ? "item" : "itens"} — {totalQtd} peça(s) — recebido{" "}
            {formatBRL(totalRecebido)}
          </p>
          {temFiltro && (
            <Button size="sm" variant="ghost" onClick={limpar} className="gap-1">
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </Button>
          )}
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
                <TableHead className="w-10" />
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
                        <TableCell className="text-right">
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
    </div>
  );
}
