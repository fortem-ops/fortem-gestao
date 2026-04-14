import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShoppingBag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const TIPOS_SERVICO = [
  "Avaliação Funcional",
  "Avaliação Física",
  "Consulta Nutrição",
  "Consulta Reabilitação",
];

interface Props {
  student: Tables<"alunos">;
  isCoordAdmin: boolean;
}

interface FormState {
  tipo_servico: string;
  data_consumo: string;
  quantidade: number;
  valor_unitario: number;
  observacoes: string;
  plano_id: string;
}

const defaultForm = (): FormState => ({
  tipo_servico: "",
  data_consumo: new Date().toISOString().split("T")[0],
  quantidade: 1,
  valor_unitario: 0,
  observacoes: "",
  plano_id: "",
});

export function StudentServicos({ student, isCoordAdmin }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());

  const { data: consumos = [], isLoading } = useQuery({
    queryKey: ["consumo_servicos", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("consumo_servicos")
        .select("*")
        .eq("aluno_id", student.id)
        .order("data_consumo", { ascending: false });
      return data || [];
    },
  });

  const { data: planoAtivo } = useQuery({
    queryKey: ["plano_ativo_id", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, tipo")
        .eq("aluno_id", student.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(defaultForm());
  };

  const openNew = () => {
    setForm({ ...defaultForm(), plano_id: planoAtivo?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      tipo_servico: c.tipo_servico,
      data_consumo: c.data_consumo,
      quantidade: c.quantidade ?? 1,
      valor_unitario: c.valor_unitario ?? 0,
      observacoes: c.observacoes || "",
      plano_id: c.plano_id,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (editing) {
        const { error } = await supabase.from("consumo_servicos").update({
          tipo_servico: form.tipo_servico,
          data_consumo: form.data_consumo,
          quantidade: form.quantidade,
          valor_unitario: form.valor_unitario,
          observacoes: form.observacoes || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        if (!form.plano_id) throw new Error("Nenhum plano ativo encontrado");
        const { error } = await supabase.from("consumo_servicos").insert({
          aluno_id: student.id,
          plano_id: form.plano_id,
          tipo_servico: form.tipo_servico,
          data_consumo: form.data_consumo,
          quantidade: form.quantidade,
          valor_unitario: form.valor_unitario,
          observacoes: form.observacoes || null,
          registrado_por: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consumo_servicos", student.id] });
      queryClient.invalidateQueries({ queryKey: ["plano_ativo", student.id] });
      toast.success(editing ? "Serviço atualizado" : "Serviço registrado");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consumo_servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consumo_servicos", student.id] });
      queryClient.invalidateQueries({ queryKey: ["plano_ativo", student.id] });
      toast.success("Serviço excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalServico = form.quantidade * form.valor_unitario;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" /> Serviços Contratados
        </h3>
        {isCoordAdmin && (
          <Button size="sm" onClick={openNew} disabled={!planoAtivo}>
            <Plus className="w-4 h-4 mr-1" /> Novo Serviço
          </Button>
        )}
      </div>

      {!planoAtivo && isCoordAdmin && (
        <p className="text-xs text-muted-foreground">É necessário um plano ativo para registrar serviços.</p>
      )}

      {isLoading ? (
        <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
      ) : consumos.length === 0 ? (
        <div className="glass-card rounded-lg p-5">
          <p className="text-sm text-muted-foreground">Nenhum serviço contratado registrado.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Valor Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Data</TableHead>
                {isCoordAdmin && <TableHead className="w-[90px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumos.map((c: any) => {
                const qty = c.quantidade ?? 1;
                const unitVal = Number(c.valor_unitario ?? 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="outline">{c.tipo_servico}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{qty}</TableCell>
                    <TableCell className="text-right text-sm">
                      R$ {unitVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      R$ {(qty * unitVal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(c.data_consumo + "T12:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    {isCoordAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select value={form.tipo_servico} onValueChange={(v) => setForm({ ...form, tipo_servico: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_SERVICO.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.valor_unitario}
                  onChange={(e) => setForm({ ...form, valor_unitario: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Serviço</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-medium">
                  R$ {totalServico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.data_consumo}
                onChange={(e) => setForm({ ...form, data_consumo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Observações opcionais..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              disabled={saveMutation.isPending || !form.tipo_servico}
              onClick={() => saveMutation.mutate()}
            >
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
