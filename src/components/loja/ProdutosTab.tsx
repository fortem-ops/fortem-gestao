import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Boxes } from "lucide-react";
import { formatBRL } from "@/lib/vendas";
import { VariantesDialog } from "./VariantesDialog";
import { ProductImageUpload } from "./ProductImageUpload";

export type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  imagem_url: string | null;
  preco_base: number;
  ativo: boolean;
  permite_encomenda: boolean;
};

type Variante = { id: string; produto_id: string; estoque_atual: number; ativo: boolean };

const empty = { nome: "", descricao: "", categoria: "", imagem_url: "", preco_base: 0, ativo: true, permite_encomenda: false };

export function ProdutosTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [variantesDe, setVariantesDe] = useState<Produto | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const temporaryProductId = useRef(crypto.randomUUID());

  const { data: produtos = [] } = useQuery({
    queryKey: ["loja-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("produtos_catalogo").select("*").order("nome");
      if (error) throw error;
      return (data || []) as Produto[];
    },
  });

  const { data: variantes = [] } = useQuery({
    queryKey: ["loja-variantes-resumo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("produtos_variantes")
        .select("id,produto_id,estoque_atual,ativo");
      if (error) throw error;
      return (data || []) as Variante[];
    },
  });

  const resumo = useMemo(() => {
    const map = new Map<string, { qtd: number; estoque: number }>();
    for (const v of variantes) {
      const cur = map.get(v.produto_id) || { qtd: 0, estoque: 0 };
      cur.qtd += 1;
      cur.estoque += v.estoque_atual;
      map.set(v.produto_id, cur);
    }
    return map;
  }, [variantes]);

  const categorias = useMemo(
    () => Array.from(new Set(produtos.map((p) => p.categoria).filter(Boolean))) as string[],
    [produtos],
  );

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria.trim() || null,
        imagem_url: form.imagem_url.trim() || null,
        preco_base: form.preco_base,
        ativo: form.ativo,
        permite_encomenda: form.permite_encomenda,
      };
      if (editing) {
        const { error } = await (supabase as any).from("produtos_catalogo").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("produtos_catalogo").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-produtos"] });
      toast.success(editing ? "Produto atualizado" : "Produto criado");
      close();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("produtos_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-produtos"] });
      qc.invalidateQueries({ queryKey: ["loja-variantes-resumo"] });
      toast.success("Produto excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function close() {
    setOpen(false);
    setEditing(null);
    setForm({ ...empty });
    setUploadingImage(false);
    temporaryProductId.current = crypto.randomUUID();
  }

  function openEdit(p: Produto) {
    setEditing(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao || "",
      categoria: p.categoria || "",
      imagem_url: p.imagem_url || "",
      preco_base: Number(p.preco_base),
      ativo: p.ativo,
      permite_encomenda: p.permite_encomenda ?? false,
    });
    setOpen(true);
  }

  const filtered = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) &&
      (categoria === "todas" || p.categoria === categoria),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            setEditing(null);
            setForm({ ...empty });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Novo Produto
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço base</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead>Estoque total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const r = resumo.get(p.id) || { qtd: 0, estoque: 0 };
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.categoria || "—"}</TableCell>
                  <TableCell>{formatBRL(Number(p.preco_base))}</TableCell>
                  <TableCell>{r.qtd}</TableCell>
                  <TableCell>{r.estoque}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "secondary"} className={p.ativo ? "bg-primary/20 text-primary" : ""}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Variantes e estoque" onClick={() => setVariantesDe(p)}>
                        <Boxes className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        title="Excluir"
                        onClick={() => {
                          if (confirm(`Excluir ${p.nome}? As variantes e o histórico de estoque também serão removidos.`))
                            del.mutate(p.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum produto
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  list="loja-categorias"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                />
                <datalist id="loja-categorias">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Preço base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preco_base}
                  onChange={(e) => setForm({ ...form, preco_base: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <ProductImageUpload
              label="Imagem do produto"
              value={form.imagem_url}
              pathPrefix={`produtos/${editing?.id || temporaryProductId.current}`}
              onChange={(imagem_url) => setForm((current) => ({ ...current, imagem_url }))}
              onUploadingChange={setUploadingImage}
            />
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.permite_encomenda}
                  onCheckedChange={(v) => setForm({ ...form, permite_encomenda: v })}
                />
                <Label>Aceita encomenda quando esgotado</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-11">
                Quando ativado, o aluno pode comprar mesmo com estoque zerado; use para levantar demanda antes de pedir ao fornecedor.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button disabled={upsert.isPending || uploadingImage || !form.nome.trim()} onClick={() => upsert.mutate()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {variantesDe && (
        <VariantesDialog produto={variantesDe} open onClose={() => setVariantesDe(null)} />
      )}
    </div>
  );
}
