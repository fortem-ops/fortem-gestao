import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { NIVEL_LABEL, type NivelMembro } from "@/lib/clube";

type Beneficio = Database["public"]["Tables"]["beneficios"]["Row"];
type Tipo = Database["public"]["Enums"]["beneficio_tipo"];
type Periodicidade = Database["public"]["Enums"]["beneficio_periodicidade"];

const TIPO_LABEL: Record<Tipo, string> = {
  desconto_percentual: "Desconto %",
  desconto_valor: "Desconto R$",
  gratuidade: "Gratuidade",
  vantagem_exclusiva: "Vantagem exclusiva",
  cashback_futuro: "Cashback (futuro)",
};

const PERIODO_LABEL: Record<Periodicidade, string> = {
  dia: "Diário",
  semana: "Semanal",
  mes: "Mensal",
  livre: "Livre",
};

const NIVEIS: NivelMembro[] = ["agregador", "start", "start_plus", "power", "pro", "max"];

const VALIDADE_PRESETS = [7, 15, 30, 60, 90, 180, 365];

const emptyForm = {
  id: "",
  parceiro_id: "",
  titulo: "",
  descricao: "",
  tipo: "desconto_percentual" as Tipo,
  regra_uso: "",
  limite_por_periodo: "",
  periodicidade: "livre" as Periodicidade,
  data_inicio: "" as string, // YYYY-MM-DD do registro (preenchido no edit)
  validade_opcao: "30" as string, // "7" | "15" | ... | "custom" | "sem_prazo"
  validade_dias_custom: "" as string,
  niveis_permitidos: ["start"] as NivelMembro[],
  ativo: true,
};

function diffDays(inicio: string, fim: string): number {
  const a = new Date(inicio + "T00:00:00").getTime();
  const b = new Date(fim + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function addDays(inicio: string, dias: number): string {
  const d = new Date(inicio + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminBeneficiosTable() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clube-beneficios-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("beneficios").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const pids = Array.from(new Set((data || []).map((b) => b.parceiro_id)));
      const { data: parcs } = pids.length
        ? await supabase.from("parceiros").select("id, nome").in("id", pids)
        : { data: [] as any[] };
      const map = new Map((parcs || []).map((p: any) => [p.id, p.nome]));
      return (data || []).map((b) => ({ ...b, parceiro_nome: map.get(b.parceiro_id) || "—" })) as (Beneficio & {
        parceiro_nome: string;
      })[];
    },
  });

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros-options"],
    queryFn: async () => {
      const { data } = await supabase.from("parceiros").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(b: Beneficio) {
    setForm({
      id: b.id,
      parceiro_id: b.parceiro_id,
      titulo: b.titulo,
      descricao: b.descricao || "",
      tipo: b.tipo,
      regra_uso: b.regra_uso || "",
      limite_por_periodo: b.limite_por_periodo?.toString() || "",
      periodicidade: b.periodicidade,
      niveis_permitidos: (b.niveis_permitidos?.length ? b.niveis_permitidos : ["start"]) as NivelMembro[],
      ativo: b.ativo,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.parceiro_id || !form.titulo) {
      toast.error("Parceiro e título são obrigatórios.");
      return;
    }
    if (!form.niveis_permitidos.length) {
      toast.error("Selecione pelo menos um nível com acesso.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        parceiro_id: form.parceiro_id,
        titulo: form.titulo,
        descricao: form.descricao || null,
        tipo: form.tipo,
        regra_uso: form.regra_uso || null,
        limite_por_periodo: form.limite_por_periodo ? Number(form.limite_por_periodo) : null,
        periodicidade: form.periodicidade,
        niveis_permitidos: form.niveis_permitidos,
        ativo: form.ativo,
      };
      const { error } = form.id
        ? await supabase.from("beneficios").update(payload).eq("id", form.id)
        : await supabase.from("beneficios").insert(payload);
      if (error) throw error;
      toast.success("Benefício salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["clube-beneficios-admin"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> Novo benefício
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar" : "Novo"} benefício</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Parceiro *</Label>
                <Select value={form.parceiro_id} onValueChange={(v) => setForm({ ...form, parceiro_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {parceiros.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Níveis com acesso *</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5 p-3 rounded-md border">
                  {NIVEIS.map((n) => {
                    const checked = form.niveis_permitidos.includes(n);
                    return (
                      <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setForm((f) => ({
                              ...f,
                              niveis_permitidos: v
                                ? [...f.niveis_permitidos, n]
                                : f.niveis_permitidos.filter((x) => x !== n),
                            }));
                          }}
                        />
                        {NIVEL_LABEL[n]}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Regra de uso</Label>
                <Input
                  value={form.regra_uso}
                  onChange={(e) => setForm({ ...form, regra_uso: e.target.value })}
                  placeholder="ex.: 20% off acima de R$50"
                />
              </div>
              <div>
                <Label>Limite total de usos</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.limite_por_periodo}
                  onChange={(e) => setForm({ ...form, limite_por_periodo: e.target.value })}
                  placeholder="Deixe em branco para ilimitado"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Limite válido para toda a vigência do benefício; não renova.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Benefício ativo</Label>
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Parceiro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Níveis</TableHead>
              <TableHead>Limite</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.titulo}</TableCell>
                <TableCell>{b.parceiro_nome}</TableCell>
                <TableCell className="text-xs">{TIPO_LABEL[b.tipo]}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {b.niveis_permitidos?.length === NIVEIS.length ? (
                      <Badge variant="outline">Todos</Badge>
                    ) : (
                      (b.niveis_permitidos || []).map((n) => (
                        <Badge key={n} variant="outline" className="text-[10px]">{NIVEL_LABEL[n as NivelMembro]}</Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {b.limite_por_periodo ? `${b.limite_por_periodo} usos` : "Livre"}
                </TableCell>
                <TableCell>{b.ativo ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!data?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum benefício cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
