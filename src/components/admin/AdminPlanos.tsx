import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";

type Plano = {
  id: string;
  aluno_id: string;
  tipo: string;
  data_inicio: string;
  duracao_meses: number;
  servicos: string[] | null;
  ativo: boolean;
  valor: number | null;
};

export function AdminPlanos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [form, setForm] = useState({
    aluno_id: "",
    tipo: "",
    data_inicio: new Date().toISOString().split("T")[0],
    duracao_meses: 6,
    valor: 0,
    ativo: true,
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["admin-planos"],
    queryFn: async () => {
      const { data } = await supabase.from("planos").select("*").order("created_at", { ascending: false });
      return (data || []) as Plano[];
    },
  });

  const { data: alunos = [] } = useQuery({
    queryKey: ["admin-alunos-list"],
    queryFn: async () => {
      const { data } = await supabase.from("alunos").select("id, nome").order("nome");
      return data || [];
    },
  });

  const alunoMap = Object.fromEntries(alunos.map((a) => [a.id, a.nome]));

  const upsertMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase.from("planos").update({
          tipo: values.tipo,
          data_inicio: values.data_inicio,
          duracao_meses: values.duracao_meses,
          valor: values.valor,
          ativo: values.ativo,
        }).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planos").insert({
          aluno_id: values.aluno_id,
          tipo: values.tipo,
          data_inicio: values.data_inicio,
          duracao_meses: values.duracao_meses,
          valor: values.valor,
          ativo: values.ativo,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-planos"] });
      toast.success(editingPlano ? "Plano atualizado" : "Plano criado");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-planos"] });
      toast.success("Plano excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlano(null);
    setForm({ aluno_id: "", tipo: "", data_inicio: new Date().toISOString().split("T")[0], duracao_meses: 6, valor: 0, ativo: true });
  };

  const openEdit = (p: Plano) => {
    setEditingPlano(p);
    setForm({
      aluno_id: p.aluno_id,
      tipo: p.tipo,
      data_inicio: p.data_inicio,
      duracao_meses: p.duracao_meses,
      valor: p.valor || 0,
      ativo: p.ativo,
    });
    setDialogOpen(true);
  };

  const filtered = planos.filter((p) => {
    const name = alunoMap[p.aluno_id] || "";
    return name.toLowerCase().includes(search.toLowerCase()) || p.tipo.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por aluno ou tipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{alunoMap[p.aluno_id] || "—"}</TableCell>
                <TableCell>{p.tipo}</TableCell>
                <TableCell>{new Date(p.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{p.duracao_meses} meses</TableCell>
                <TableCell>R$ {(p.valor || 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "default" : "secondary"} className={p.ativo ? "bg-primary/20 text-primary" : ""}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum plano encontrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlano ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingPlano && (
              <div className="space-y-2">
                <Label>Aluno</Label>
                <Select value={form.aluno_id} onValueChange={(v) => setForm({ ...form, aluno_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
                  <SelectContent>
                    {alunos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo do Plano</Label>
              <Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Ex: Pro, Power, Basic" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Duração (meses)</Label>
                <Input type="number" value={form.duracao_meses} onChange={(e) => setForm({ ...form, duracao_meses: parseInt(e.target.value) || 1 })} min={1} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              disabled={upsertMutation.isPending || (!editingPlano && !form.aluno_id) || !form.tipo}
              onClick={() => upsertMutation.mutate(editingPlano ? { ...form, id: editingPlano.id } : form)}
            >
              {editingPlano ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
