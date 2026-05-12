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
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { ATIVIDADES_SUGERIDAS, formatBRL } from "@/lib/vendas";

type ServicoCat = {
  id: string;
  nome: string;
  atividade: string;
  quantidade_sessoes: number;
  valor: number;
  ativo: boolean;
};

const empty = { nome: "", atividade: "", quantidade_sessoes: 1, valor: 0, ativo: true };

export function AdminServicos() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServicoCat | null>(null);
  const [form, setForm] = useState({ ...empty });

  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos-catalogo"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("servicos_catalogo").select("*").order("nome");
      return (data || []) as ServicoCat[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await (supabase as any).from("servicos_catalogo").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("servicos_catalogo").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      toast.success(editing ? "Serviço atualizado" : "Serviço criado");
      close();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("servicos_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      toast.success("Serviço excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function close() { setOpen(false); setEditing(null); setForm({ ...empty }); }

  function openEdit(s: ServicoCat) {
    setEditing(s);
    setForm({ nome: s.nome, atividade: s.atividade, quantidade_sessoes: s.quantidade_sessoes, valor: Number(s.valor), ativo: s.ativo });
    setOpen(true);
  }

  const filtered = servicos.filter((s) => s.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setForm({ ...empty }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Serviço
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead>Sessões</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>{s.atividade}</TableCell>
                <TableCell>{s.quantidade_sessoes}</TableCell>
                <TableCell>{formatBRL(s.valor)}</TableCell>
                <TableCell>
                  <Badge variant={s.ativo ? "default" : "secondary"} className={s.ativo ? "bg-primary/20 text-primary" : ""}>
                    {s.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Excluir ${s.nome}?`)) del.mutate(s.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum serviço</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Atividade</Label>
              <Input list="atividades-sugeridas" value={form.atividade} onChange={(e) => setForm({ ...form, atividade: e.target.value })} />
              <datalist id="atividades-sugeridas">{ATIVIDADES_SUGERIDAS.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sessões</Label>
                <Input type="number" min={1} value={form.quantidade_sessoes} onChange={(e) => setForm({ ...form, quantidade_sessoes: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button disabled={upsert.isPending || !form.nome || !form.atividade} onClick={() => upsert.mutate()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
