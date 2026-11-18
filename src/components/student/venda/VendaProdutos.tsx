import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Minus, Plus, Package, Trash2, Copy, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProdutosLoja } from "@/hooks/useProdutosLoja";
import { useFormasPagamento } from "./PaymentFields";
import { calcularDesconto, filtrarProdutos, situacaoItem, type TipoDesconto } from "@/lib/lojaBalcao";
import { formatBRL } from "@/lib/vendas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ItemCarrinho = { varianteId: string; nome: string; detalhe: string; preco: number; disponivel: number; permite: boolean; quantidade: number };
type Modo = "registrar" | "pix" | "cartao";
type Resultado = { ok: boolean; error?: string; pedido_id?: string; valor_final?: number; status?: string; eh_encomenda?: boolean; tem_cpf?: boolean };

const ERROS: Record<string, string> = {
  estoque_insuficiente: "Um dos itens ficou sem estoque. Revise o carrinho.",
  cupom_invalido: "Cupom inválido, expirado ou esgotado.",
  sem_permissao: "Só admin ou coordenação podem vender produtos.",
  forma_obrigatoria: "Escolha a forma de pagamento.",
};

export function VendaProdutos({ alunoId, onDone }: { alunoId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: produtos = [], isLoading } = useProdutosLoja();
  const { data: formas = [] } = useFormasPagamento();
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [tipoDesc, setTipoDesc] = useState<TipoDesconto>("valor");
  const [descValor, setDescValor] = useState("");
  const [cupom, setCupom] = useState("");
  const [modo, setModo] = useState<Modo>("registrar");
  const [forma, setForma] = useState<string>("");
  const [pago, setPago] = useState(true);
  const [cartaoId, setCartaoId] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [chave] = useState(() => crypto.randomUUID());
  const [pix, setPix] = useState<{ pedidoId: string; copiaCola: string } | null>(null);
  const [pedidoPendente, setPedidoPendente] = useState<string | null>(null);

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes-aluno-venda", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes_salvos")
        .select("id, brand, last4, is_default").eq("aluno_id", alunoId).eq("ativo", true).order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => { if (!cartaoId && cartoes[0]) setCartaoId(cartoes[0].id); }, [cartoes, cartaoId]);

  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const desconto = cupom.trim() ? 0 : calcularDesconto(total, tipoDesc, Number(descValor.replace(",", ".")) || 0);
  const final = Math.max(total - desconto, 0);
  const bloqueado = carrinho.some((i) => situacaoItem(i.disponivel, i.quantidade, i.permite) === "bloqueado");

  const opcoes = useMemo(() => produtos.flatMap((p) => p.variantes.map((v) => ({
    varianteId: v.id, nome: p.nome, detalhe: [v.tamanho, v.cor].filter(Boolean).join(" · "),
    preco: Number(v.preco ?? p.preco_base ?? 0), disponivel: Number(v.estoque_atual ?? 0), permite: !!p.permite_encomenda,
    imagem: v.imagem_url ?? p.imagem_url,
  }))), [produtos]);

  function adicionar(o: (typeof opcoes)[number]) {
    setCarrinho((c) => {
      const ex = c.find((i) => i.varianteId === o.varianteId);
      if (ex) return c.map((i) => i.varianteId === o.varianteId ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...c, { ...o, quantidade: 1 }];
    });
  }
  function mudarQtd(id: string, delta: number) {
    setCarrinho((c) => c.flatMap((i) => i.varianteId !== id ? [i] : i.quantidade + delta <= 0 ? [] : [{ ...i, quantidade: i.quantidade + delta }]));
  }

  async function concluir() {
    if (modo === "registrar" && pago && !forma) { toast.error("Escolha a forma de pagamento."); return; }
    if (modo === "cartao" && !cartaoId) { toast.error("O aluno não tem cartão salvo."); return; }
    setSalvando(true);
    try {
      let pedidoId = pedidoPendente;
      if (!pedidoId) {
        const { data, error } = await supabase.rpc("fn_loja_venda_balcao", { p_payload: {
          aluno_id: alunoId, idempotency_key: `balcao:${chave}`,
          itens: carrinho.map((i) => ({ variante_id: i.varianteId, quantidade: i.quantidade })),
          cupom_codigo: cupom.trim() || null, desconto_tipo: tipoDesc, desconto_valor: Number(descValor.replace(",", ".")) || 0,
          forma_pagamento: modo === "registrar" ? (pago ? forma : null) : modo === "pix" ? "pix" : "cartao_credito",
          pago: modo === "registrar" && pago,
        } });
        if (error) throw error;
        const r = data as unknown as Resultado;
        if (!r?.ok || !r.pedido_id) { toast.error(ERROS[r?.error ?? ""] ?? "Não foi possível registrar a venda."); return; }
        pedidoId = r.pedido_id;
        setPedidoPendente(pedidoId);
        qc.invalidateQueries({ queryKey: ["loja", "produtos"] });
        qc.invalidateQueries({ queryKey: ["compras-loja-aluno", alunoId] });
        if (r.status === "pago" || modo === "registrar") {
          toast.success(r.status === "pago" ? "Venda registrada como paga. Estoque atualizado." : "Venda registrada como pendente. Estoque atualizado.");
          onDone(); return;
        }
        if (modo === "pix" && !r.tem_cpf) { toast.error("Venda criada, mas o aluno não tem CPF para gerar Pix. Dê baixa na Loja > Pedidos."); onDone(); return; }
      }
      if (modo === "pix") {
        const { data, error } = await supabase.functions.invoke("loja-criar-pix", { body: { pedido_id: pedidoId } });
        if (error || !data?.ok) { toast.error("Não foi possível gerar o Pix. Tente de novo."); return; }
        if (data.ja_pago) { toast.success("Pedido já pago."); onDone(); return; }
        setPix({ pedidoId, copiaCola: data.pix_copia_cola });
        return;
      }
      const { data, error } = await supabase.functions.invoke("loja-cobrar-pedido-equipe", {
        body: { pedido_id: pedidoId, cartao_id: cartaoId, parcelas: Number(parcelas) },
      });
      if (error && !data) { toast.error("Falha na comunicação. Confira em Loja > Pedidos antes de tentar de novo."); return; }
      if (data?.success) { toast.success("Pagamento aprovado no cartão."); qc.invalidateQueries({ queryKey: ["compras-loja-aluno", alunoId] }); onDone(); return; }
      toast.error(data?.mensagem ?? (data?.return_message ? `Cartão recusado: ${data.return_message}` : "Cartão recusado. O pedido segue pendente; tente outro cartão ou outra forma."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar a venda.");
    } finally { setSalvando(false); }
  }

  // acompanha o Pix
  useEffect(() => {
    if (!pix) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("pedidos").select("status").eq("id", pix.pedidoId).maybeSingle();
      if (data?.status === "pago") { clearInterval(t); toast.success("Pix recebido."); qc.invalidateQueries({ queryKey: ["compras-loja-aluno", alunoId] }); onDone(); }
    }, 5000);
    return () => clearInterval(t);
  }, [pix, alunoId, onDone, qc]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (pix) return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">Peça para o aluno ler o QR code. A venda baixa sozinha quando o Pix cair.</p>
      <div className="inline-block rounded-lg bg-card p-3 border border-border"><QRCodeSVG value={pix.copiaCola} size={200} /></div>
      <p className="text-2xl font-bold text-primary">{formatBRL(final)}</p>
      <Button variant="outline" onClick={() => { navigator.clipboard.writeText(pix.copiaCola); toast.success("Código copiado."); }}><Copy className="w-4 h-4 mr-2" />Copiar Pix copia e cola</Button>
      <p className="text-xs text-muted-foreground">Se fechar, o pedido fica pendente em Loja &gt; Pedidos.</p>
    </div>
  );

  const travado = !!pedidoPendente;
  return (
    <div className="space-y-5 min-w-0 w-full overflow-x-hidden">
      {!travado && (
        <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" className="pl-9 pr-9" />
          {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {opcoes.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto ativo na Loja.</p>}
          {opcoes.length > 0 && filtrarProdutos(opcoes, busca).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>}
          {filtrarProdutos(opcoes, busca).map((o) => {
            const sit = situacaoItem(o.disponivel, 1, o.permite);
            return (
              <div key={o.varianteId} className="flex items-center gap-3 rounded-lg border border-border p-2">
                {o.imagem ? <img src={o.imagem} alt="" className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.nome}</p>
                  <p className="text-xs text-muted-foreground">{o.detalhe || "Único"} · {sit === "disponivel" ? `${o.disponivel} em estoque` : sit === "encomenda" ? "Sem estoque · encomenda" : "Sem estoque"}</p>
                </div>
                <span className="text-sm font-semibold whitespace-nowrap">{formatBRL(o.preco)}</span>
                <Button size="sm" variant="outline" disabled={sit === "bloqueado"} onClick={() => adicionar(o)} aria-label={`Adicionar ${o.nome}`}><Plus className="w-4 h-4" /></Button>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {carrinho.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="font-heading font-semibold">Carrinho</h4>
          {carrinho.map((i) => {
            const sit = situacaoItem(i.disponivel, i.quantidade, i.permite);
            return (
              <div key={i.varianteId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="basis-full sm:basis-auto flex-1 min-w-0 truncate">{i.nome}{i.detalhe ? ` (${i.detalhe})` : ""}</span>
                {sit === "encomenda" && <Badge variant="outline">Encomenda</Badge>}
                {sit === "bloqueado" && <Badge variant="destructive">Sem estoque</Badge>}
                {!travado && <>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => mudarQtd(i.varianteId, -1)} aria-label="Diminuir">{i.quantidade === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}</Button>
                </>}
                <span className="w-6 text-center">{i.quantidade}</span>
                {!travado && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => mudarQtd(i.varianteId, 1)} aria-label="Aumentar"><Plus className="w-3 h-3" /></Button>}
                <span className="ml-auto text-right">{formatBRL(i.preco * i.quantidade)}</span>
              </div>
            );
          })}
          <div className="border-t border-border pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBRL(total)}</span></div>
            {desconto > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>− {formatBRL(desconto)}</span></div>}
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="text-primary">{cupom.trim() ? "calculado com o cupom" : formatBRL(final)}</span></div>
          </div>
        </div>
      )}

      {carrinho.length > 0 && !travado && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Desconto</Label>
            <Select value={tipoDesc} onValueChange={(v) => setTipoDesc(v as TipoDesconto)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="valor">Em R$</SelectItem><SelectItem value="percentual">Em %</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Valor do desconto</Label><Input inputMode="decimal" value={descValor} disabled={!!cupom.trim()} onChange={(e) => setDescValor(e.target.value)} placeholder="0" /></div>
          <div className="space-y-1"><Label>Cupom da Loja</Label><Input value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} placeholder="Opcional" /></div>
        </div>
      )}

      {carrinho.length > 0 && (
        <div className="space-y-3">
          <Label>Pagamento</Label>
          <RadioGroup value={modo} onValueChange={(v) => !travado && setModo(v as Modo)} className="grid gap-2 sm:grid-cols-3">
            {([["registrar", "Registrar"], ["pix", "Pix online (QR)"], ["cartao", "Cartão salvo"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer text-sm">
                <RadioGroupItem value={v} disabled={travado && v !== modo} />{l}
              </label>
            ))}
          </RadioGroup>
          {modo === "registrar" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={pago ? "pago" : "pendente"} onValueChange={(v) => setPago(v === "pago")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pago">Já recebido</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent>
              </Select>
              {pago ? (
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
                  <SelectContent>{formas.map((f) => <SelectItem key={f.id} value={f.slug}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              ) : <p className="text-xs text-muted-foreground self-center">A forma é escolhida ao dar baixa, no Histórico de Vendas.</p>}
            </div>
          )}
          {modo === "cartao" && (cartoes.length === 0
            ? <p className="text-sm text-muted-foreground">O aluno não tem cartão salvo em Meios de Pagamento.</p>
            : <div className="grid gap-3 sm:grid-cols-2">
                <Select value={cartaoId} onValueChange={setCartaoId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand} final {c.last4}{c.is_default ? " (principal)" : ""}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={parcelas} onValueChange={setParcelas}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 6 }, (_, i) => String(i + 1)).map((n) => <SelectItem key={n} value={n}>{n}x</SelectItem>)}</SelectContent>
                </Select>
              </div>)}
          <p className="text-xs text-muted-foreground">O estoque baixa ao concluir. Itens com estoque saem entregues; encomendas vão para a fila da Loja.</p>
          <div className="flex justify-end">
            <Button disabled={salvando || bloqueado || (modo === "cartao" && cartoes.length === 0)} onClick={concluir}>
              {salvando ? "Processando..." : travado ? (modo === "pix" ? "Gerar Pix de novo" : "Tentar cobrar de novo") : modo === "registrar" ? "Concluir venda" : modo === "pix" ? "Concluir e gerar Pix" : "Concluir e cobrar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
