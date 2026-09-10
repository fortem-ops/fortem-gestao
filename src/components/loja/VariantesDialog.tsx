import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, History, ArrowLeftRight } from "lucide-react";
import { formatBRL } from "@/lib/vendas";
import type { Produto } from "./ProdutosTab";
import { ProductImageUpload } from "./ProductImageUpload";

type Variante = {
  id: string;
  produto_id: string;
  tamanho: string | null;
  cor: string | null;
  sku: string | null;
  preco: number | null;
  estoque_atual: number;
  ativo: boolean;
  imagem_url: string | null;
  cor_hex: string | null;
};

type Movimento = {
  id: string;
  tipo: string;
  quantidade: number;
  motivo: string | null;
  created_at: string;
};

const COR_PADRAO = "#dc2626";

const emptyVar = {
  tamanho: "",
  cor: "",
  sku: "",
  preco: "",
  estoque_atual: 0,
  ativo: true,
  imagem_url: "",
  cor_hex: COR_PADRAO,
};

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  reserva: "Reserva",
  cancelamento_reserva: "Cancelamento de reserva",
};

export function VariantesDialog({ produto, open, onClose }: { produto: Produto; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyVar });
  const [ajuste, setAjuste] = useState<Variante | null>(null);
  const [historico, setHistorico] = useState<Variante | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: variantes = [] } = useQuery({
    queryKey: ["loja-variantes", produto.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produtos_variantes")
        .select("*")
        .eq("produto_id", produto.id)
        .order("created_at");
      if (error) throw error;
      return (data || []) as Variante[];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["loja-variantes", produto.id] });
    qc.invalidateQueries({ queryKey: ["loja-variantes-resumo"] });
  }

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("produtos_variantes").insert({
        produto_id: produto.id,
        tamanho: form.tamanho.trim() || null,
        cor: form.cor.trim() || null,
        sku: form.sku.trim() || null,
        preco: form.preco === "" ? null : Number(form.preco),
        estoque_atual: Number(form.estoque_atual) || 0,
        ativo: form.ativo,
        imagem_url: form.cor.trim() ? form.imagem_url.trim() || null : null,
        cor_hex: form.cor.trim() ? form.cor_hex || COR_PADRAO : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setForm({ ...emptyVar });
      toast.success("Variante adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from("produtos_variantes").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("produtos_variantes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Variante removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Variantes — {produto.nome}</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-[130px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.tamanho || "—"}</TableCell>
                    <TableCell>
                      {v.cor ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full border border-border"
                            style={{ backgroundColor: v.cor_hex || "hsl(var(--muted))" }}
                          />
                          {v.cor}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{v.sku || "—"}</TableCell>
                    <TableCell>
                      {v.preco == null ? (
                        <span className="text-muted-foreground">{formatBRL(Number(produto.preco_base))} (base)</span>
                      ) : (
                        formatBRL(Number(v.preco))
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{v.estoque_atual}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={v.ativo} onCheckedChange={(a) => toggleAtivo.mutate({ id: v.id, ativo: a })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Ajustar estoque" onClick={() => setAjuste(v)}>
                          <ArrowLeftRight className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistorico(v)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          title="Remover"
                          onClick={() => {
                            if (confirm("Remover esta variante e seu histórico de estoque?")) remover.mutate(v.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {variantes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Nenhuma variante cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-medium">Adicionar variante</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tamanho</Label>
                <Input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preço (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="usa preço base"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estoque inicial</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estoque_atual}
                  onChange={(e) => setForm({ ...form, estoque_atual: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            {form.cor.trim() && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ProductImageUpload
                  label="Imagem desta cor"
                  value={form.imagem_url}
                  pathPrefix={`produtos/${produto.id}/variantes/${form.cor
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "") || "cor"}`}
                  fallbackText="Se não enviar, usa a imagem padrão do produto."
                  onChange={(imagem_url) => setForm((current) => ({ ...current, imagem_url }))}
                  onUploadingChange={setUploadingImage}
                />
                <div className="space-y-1">
                  <Label className="text-xs">Cor (para exibição)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-12 rounded border border-border bg-background p-1"
                      value={form.cor_hex || COR_PADRAO}
                      onChange={(e) => setForm({ ...form, cor_hex: e.target.value })}
                    />
                    <Input
                      value={form.cor_hex}
                      onChange={(e) => setForm({ ...form, cor_hex: e.target.value })}
                      placeholder={COR_PADRAO}
                      className="font-mono"
                    />
                    <span
                      className="inline-block w-6 h-6 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: form.cor_hex || COR_PADRAO }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label className="text-sm">Ativa</Label>
              </div>
              <Button size="sm" disabled={criar.isPending || uploadingImage} onClick={() => criar.mutate()}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ajuste && <AjusteEstoqueDialog variante={ajuste} onClose={() => setAjuste(null)} onDone={invalidate} />}
      {historico && <HistoricoDialog variante={historico} onClose={() => setHistorico(null)} />}
    </>
  );
}

function AjusteEstoqueDialog({
  variante,
  onClose,
  onDone,
}: {
  variante: Variante;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState("entrada");
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState("");

  const mov = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("fn_estoque_movimentar", {
        p_variante_id: variante.id,
        p_tipo: tipo,
        p_quantidade: quantidade,
        p_motivo: motivo.trim(),
        p_pedido_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onDone();
      qc.invalidateQueries({ queryKey: ["loja-movimentos", variante.id] });
      toast.success("Estoque atualizado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste de estoque</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Estoque atual: <strong className="text-foreground">{variante.estoque_atual}</strong>
          </p>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (soma)</SelectItem>
                <SelectItem value="saida">Saída (subtrai)</SelectItem>
                <SelectItem value="ajuste">Ajuste (define o total)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tipo === "ajuste" ? "Novo total" : "Quantidade"}</Label>
            <Input
              type="number"
              min={0}
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Motivo (obrigatório)</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: recebimento de fornecedor" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={mov.isPending || !motivo.trim() || (tipo !== "ajuste" && quantidade <= 0)}
            onClick={() => mov.mutate()}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoDialog({ variante, onClose }: { variante: Variante; onClose: () => void }) {
  const { data: movimentos = [], isLoading } = useQuery({
    queryKey: ["loja-movimentos", variante.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_movimentos")
        .select("id,tipo,quantidade,motivo,created_at")
        .eq("variante_id", variante.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Movimento[];
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de estoque</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-border overflow-x-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{TIPO_LABEL[m.tipo] || m.tipo}</TableCell>
                  <TableCell>{m.quantidade}</TableCell>
                  <TableCell className="text-muted-foreground">{m.motivo || "—"}</TableCell>
                </TableRow>
              ))}
              {!isLoading && movimentos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Sem movimentações
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
