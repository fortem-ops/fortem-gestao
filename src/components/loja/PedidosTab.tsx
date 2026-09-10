import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, PackageOpen } from "lucide-react";
import { formatBRL } from "@/lib/vendas";
import { labelFormaPagamento } from "@/lib/formasRecebimento";

type Item = {
  quantidade: number;
  preco_unitario_snapshot: number;
  produtos_variantes: {
    tamanho: string | null;
    cor: string | null;
    sku: string | null;
    produtos_catalogo: { nome: string } | null;
  } | null;
};

type Pedido = {
  id: string;
  nome: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  status: string;
  valor_final: number;
  forma_pagamento: string | null;
  eh_encomenda: boolean | null;
  created_at: string;
  pedido_itens: Item[];
};

const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const STATUS_CLASS: Record<string, string> = {
  pago: "status-active",
  aguardando_pagamento: "status-warning",
  cancelado: "status-urgent",
  expirado: "status-urgent",
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "pago", label: "Pagos" },
  { value: "aguardando_pagamento", label: "Aguardando" },
  { value: "cancelado", label: "Cancelados" },
];

function resumoItens(itens: Item[]) {
  return (
    itens
      .map((i) => `${i.quantidade}x ${i.produtos_variantes?.produtos_catalogo?.nome ?? "Produto"}`)
      .join(", ") || "—"
  );
}

function fmtData(v: string) {
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function TentativasPagamento({ pedidoId }: { pedidoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["loja-pedido-tentativas", pedidoId],
    queryFn: async () => {
      const [rede, pix] = await Promise.all([
        (supabase as any)
          .from("pagamentos_rede")
          .select("id, created_at, status, return_code, return_message, amount, installments, tid")
          .eq("pedido_id", pedidoId)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("pix_cobrancas")
          .select("id, created_at, status, valor, txid, liquidado_em, motivo_rejeicao")
          .eq("pedido_id", pedidoId)
          .order("created_at", { ascending: false }),
      ]);
      return { rede: rede.data || [], pix: pix.data || [] };
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  const rede = data?.rede ?? [];
  const pix = data?.pix ?? [];

  if (rede.length === 0 && pix.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma tentativa de pagamento registrada.</p>;
  }

  return (
    <div className="space-y-3">
      {rede.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Tentativas — Cartão</p>
          <ul className="space-y-1">
            {rede.map((t: any) => (
              <li key={t.id} className="text-xs flex flex-wrap gap-x-3">
                <span className="text-muted-foreground">{fmtData(t.created_at)}</span>
                <Badge variant="outline" className={t.status === "approved" ? "status-active" : "status-urgent"}>
                  {t.status === "approved" ? "Aprovada" : "Recusada"}
                </Badge>
                <span>{formatBRL(Number(t.amount ?? 0) / 100)}{t.installments > 1 ? ` em ${t.installments}x` : ""}</span>
                <span className="text-muted-foreground">
                  {t.return_code ? `cód. ${t.return_code}` : ""} {t.return_message ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pix.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Tentativas — PIX</p>
          <ul className="space-y-1">
            {pix.map((t: any) => (
              <li key={t.id} className="text-xs flex flex-wrap gap-x-3">
                <span className="text-muted-foreground">{fmtData(t.created_at)}</span>
                <Badge variant="outline" className={t.status === "LIQUIDADA" ? "status-active" : "status-warning"}>
                  {t.status}
                </Badge>
                <span>{formatBRL(Number(t.valor ?? 0))}</span>
                {t.motivo_rejeicao && <span className="text-muted-foreground">{t.motivo_rejeicao}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PedidosTab() {
  const [filtro, setFiltro] = useState("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["loja-pedidos", filtro],
    queryFn: async () => {
      let q = (supabase as any)
        .from("pedidos")
        .select(
          "id, nome, cpf, email, telefone, status, valor_final, forma_pagamento, eh_encomenda, created_at, pedido_itens(quantidade, preco_unitario_snapshot, produtos_variantes(tamanho, cor, sku, produtos_catalogo(nome)))",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (filtro !== "todos") q = q.eq("status", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Pedido[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filtro === f.value ? "default" : "outline"}
            onClick={() => setFiltro(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : pedidos.length === 0 ? (
        <div className="rounded-lg border border-border py-12 flex flex-col items-center gap-2 text-muted-foreground">
          <PackageOpen className="w-8 h-8" />
          <p className="text-sm">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Comprador</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p) => (
                <Fragment key={p.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setAberto(aberto === p.id ? null : p.id)}
                  >
                    <TableCell>
                      {aberto === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{p.nome || "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm">{resumoItens(p.pedido_itens || [])}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(p.valor_final ?? 0))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASS[p.status] ?? ""}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.forma_pagamento ? labelFormaPagamento(p.forma_pagamento) : "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtData(p.created_at)}</TableCell>
                  </TableRow>
                  {aberto === p.id && (
                    <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                      <TableCell colSpan={7} className="p-4 space-y-4">
                        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                          <span>CPF: {p.cpf || "—"}</span>
                          <span>E-mail: {p.email || "—"}</span>
                          <span>Telefone: {p.telefone || "—"}</span>
                        </div>
                        {p.eh_encomenda && (
                          <Badge variant="outline" className="status-warning">Encomenda</Badge>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Itens</p>
                          <ul className="space-y-1">
                            {(p.pedido_itens || []).map((it, idx) => {
                              const v = it.produtos_variantes;
                              const variante = [v?.tamanho, v?.cor].filter(Boolean).join(" / ") || v?.sku || "Padrão";
                              return (
                                <li key={idx} className="text-xs">
                                  {it.quantidade}x {v?.produtos_catalogo?.nome ?? "Produto"} — {variante} —{" "}
                                  {formatBRL(Number(it.preco_unitario_snapshot) * it.quantidade)}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <TentativasPagamento pedidoId={p.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
