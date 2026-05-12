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
import { calcularCreditos, FREQUENCIAS, PERIODOS, PLANOS_SUGERIDOS, PRESET_CORES, formatBRL, type Frequencia } from "@/lib/vendas";

type PlanoCat = {
  id: string;
  nome: string;
  periodo_meses: number;
  frequencia: Frequencia;
  quantidade_creditos: number | null;
  ilimitado: boolean;
  valor: number;
  cor: string | null;
  ativo: boolean;
};

const empty = {
  nome: "",
  periodo_meses: 1,
  frequencia: "1x" as Frequencia,
  quantidade_creditos: 4 as number | null,
  ilimitado: false,
  valor: 0,
  cor: "#9CA3AF",
  ativo: true,
  manualCreditos: false,
};

export function AdminPlanos() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanoCat | null>(null);
  const [form, setForm] = useState({ ...empty });

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-catalogo"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("planos_catalogo").select("*").order("nome");
      return (data || []) as PlanoCat[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        periodo_meses: form.periodo_meses,
        frequencia: form.frequencia,
        quantidade_creditos: form.ilimitado ? null : form.quantidade_creditos,
        ilimitado: form.ilimitado,
        valor: form.valor,
        cor: form.cor,
        ativo: form.ativo,
      };
      if (editing) {
        const { error } = await (supabase as any).from("planos_catalogo").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("planos_catalogo").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planos-catalogo"] });
      toast.success(editing ? "Plano atualizado" : "Plano criado");
      close();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("planos_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planos-catalogo"] });
      toast.success("Plano excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function close() {
    setOpen(false);
    setEditing(null);
    setForm({ ...empty });
  }

  function openEdit(p: PlanoCat) {
    setEditing(p);
    setForm({
      nome: p.nome,
      periodo_meses: p.periodo_meses,
      frequencia: p.frequencia,
      quantidade_creditos: p.quantidade_creditos,
      ilimitado: p.ilimitado,
      valor: Number(p.valor),
      cor: p.cor || "#9CA3AF",
      ativo: p.ativo,
      manualCreditos: true,
    });
    setOpen(true);
  }

  function syncCreditos(periodo: number, freq: Frequencia) {
    const c = calcularCreditos(periodo, freq);
    setForm((f) => ({ ...f, periodo_meses: periodo, frequencia: freq, ilimitado: c.ilimitado, quantidade_creditos: c.quantidade, manualCreditos: false }));
  }

  const filtered = planos.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar plano..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setForm({ ...empty }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell><span className="inline-block w-5 h-5 rounded-full border border-border" style={{ background: p.cor || "transparent" }} /></TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.periodo_meses} {p.periodo_meses === 1 ? "mês" : "meses"}</TableCell>
                <TableCell>{p.frequencia}</TableCell>
                <TableCell>{p.ilimitado ? "Ilimitado" : p.quantidade_creditos ?? "—"}</TableCell>
                <TableCell>{formatBRL(p.valor)}</TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "default" : "secondary"} className={p.ativo ? "bg-primary/20 text-primary" : ""}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Excluir ${p.nome}?`)) del.mutate(p.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum plano</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else setOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input list="planos-sugeridos" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Start, Power..." />
              <datalist id="planos-sugeridos">{PLANOS_SUGERIDOS.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={String(form.periodo_meses)} onValueChange={(v) => syncCreditos(parseInt(v), form.frequencia)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((p) => <SelectItem key={p} value={String(p)}>{p} {p === 1 ? "mês" : "meses"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={form.frequencia} onValueChange={(v) => syncCreditos(form.periodo_meses, v as Frequencia)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Créditos {form.ilimitado && "(ilimitado)"}</Label>
                <Input type="number" disabled={form.ilimitado} value={form.quantidade_creditos ?? 0}
                  onChange={(e) => setForm({ ...form, quantidade_creditos: parseInt(e.target.value) || 0, manualCreditos: true })} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor / Identidade visual</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_CORES.map((c) => (
                  <button key={c.cor} type="button" title={c.nome}
                    className={`w-7 h-7 rounded-full border-2 transition ${form.cor === c.cor ? "border-primary scale-110" : "border-border"}`}
                    style={{ background: c.cor }} onClick={() => setForm({ ...form, cor: c.cor })} />
                ))}
                <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="w-12 h-8 p-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button disabled={upsert.isPending || !form.nome} onClick={() => upsert.mutate()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
