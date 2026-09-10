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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/vendas";

type Promocao = {
  id: string;
  codigo: string | null;
  tipo: "percentual" | "valor_fixo";
  valor: number;
  valido_de: string | null;
  valido_ate: string | null;
  uso_maximo: number | null;
  uso_atual: number;
  ativo: boolean;
};

const empty = {
  codigo: "",
  tipo: "percentual" as "percentual" | "valor_fixo",
  valor: 0,
  valido_de: "",
  valido_ate: "",
  uso_maximo: "",
  ativo: true,
};

function toDateInput(v: string | null) {
  return v ? new Date(v).toISOString().slice(0, 10) : "";
}

export function PromocoesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promocao | null>(null);
  const [form, setForm] = useState({ ...empty });

  const { data: promocoes = [] } = useQuery({
    queryKey: ["loja-promocoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("promocoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Promocao[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        codigo: form.codigo.trim() ? form.codigo.trim().toUpperCase() : null,
        tipo: form.tipo,
        valor: form.valor,
        valido_de: form.valido_de ? new Date(`${form.valido_de}T00:00:00`).toISOString() : null,
        valido_ate: form.valido_ate ? new Date(`${form.valido_ate}T23:59:59`).toISOString() : null,
        uso_maximo: form.uso_maximo === "" ? null : Number(form.uso_maximo),
        ativo: form.ativo,
      };
      if (editing) {
        const { error } = await (supabase as any).from("promocoes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("promocoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-promocoes"] });
      toast.success(editing ? "Promoção atualizada" : "Promoção criada");
      close();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("promocoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-promocoes"] });
      toast.success("Promoção excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function close() {
    setOpen(false);
    setEditing(null);
    setForm({ ...empty });
  }

  function openEdit(p: Promocao) {
    setEditing(p);
    setForm({
      codigo: p.codigo || "",
      tipo: p.tipo,
      valor: Number(p.valor),
      valido_de: toDateInput(p.valido_de),
      valido_ate: toDateInput(p.valido_ate),
      uso_maximo: p.uso_maximo == null ? "" : String(p.uso_maximo),
      ativo: p.ativo,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setForm({ ...empty });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Nova Promoção
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promocoes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.codigo || "—"}</TableCell>
                <TableCell>{p.tipo === "percentual" ? "Percentual" : "Valor fixo"}</TableCell>
                <TableCell>{p.tipo === "percentual" ? `${Number(p.valor)}%` : formatBRL(Number(p.valor))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.valido_de ? new Date(p.valido_de).toLocaleDateString("pt-BR") : "—"} até{" "}
                  {p.valido_ate ? new Date(p.valido_ate).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  {p.uso_atual}
                  {p.uso_maximo != null ? ` / ${p.uso_maximo}` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "default" : "secondary"} className={p.ativo ? "bg-primary/20 text-primary" : ""}>
                    {p.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Excluir esta promoção?")) del.mutate(p.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {promocoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma promoção
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Promoção" : "Nova Promoção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código (opcional)</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="Ex.: FORTEM10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Válido de</Label>
                <Input type="date" value={form.valido_de} onChange={(e) => setForm({ ...form, valido_de: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Válido até</Label>
                <Input type="date" value={form.valido_ate} onChange={(e) => setForm({ ...form, valido_ate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Uso máximo (opcional)</Label>
              <Input
                type="number"
                min={1}
                value={form.uso_maximo}
                onChange={(e) => setForm({ ...form, uso_maximo: e.target.value })}
                placeholder="Sem limite"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={upsert.isPending || form.valor <= 0 || (form.tipo === "percentual" && form.valor > 100)}
              onClick={() => upsert.mutate()}
            >
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
