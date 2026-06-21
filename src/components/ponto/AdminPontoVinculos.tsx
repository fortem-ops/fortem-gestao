import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Save, ShieldCheck, Briefcase } from "lucide-react";

type TipoVinculo =
  | "horista"
  | "mensalista"
  | "pj"
  | "estagiario"
  | "autonomo"
  | "coordenador_gestao";

const TIPO_LABEL: Record<TipoVinculo, string> = {
  horista: "Horista",
  mensalista: "Mensalista",
  pj: "PJ",
  estagiario: "Estagiário",
  autonomo: "Autônomo",
  coordenador_gestao: "Coordenador/Gestão",
};

const TIPO_BADGE: Record<TipoVinculo, string> = {
  horista: "bg-info/15 text-info border-info/30",
  mensalista: "bg-success/15 text-success border-success/30",
  pj: "bg-warning/15 text-warning border-warning/30",
  estagiario: "bg-primary/15 text-primary border-primary/30",
  autonomo: "bg-muted text-muted-foreground border-border",
  coordenador_gestao: "bg-destructive/15 text-destructive border-destructive/30",
};

interface CadastroRow {
  id?: string;
  usuario_id: string;
  tipo_vinculo: TipoVinculo;
  valor_hora_aula: number;
  carga_horaria_semanal_min: number;
  limite_diario_min: number;
  banco_horas_ativo: boolean;
  elegivel_ponto: boolean;
  art_62_clt: boolean;
  observacoes: string | null;
}

const DEFAULT_ROW: Omit<CadastroRow, "usuario_id"> = {
  tipo_vinculo: "mensalista",
  valor_hora_aula: 0,
  carga_horaria_semanal_min: 2200,
  limite_diario_min: 480,
  banco_horas_ativo: false,
  elegivel_ponto: true,
  art_62_clt: false,
  observacoes: null,
};

export function AdminPontoVinculos() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ user_id: string; nome: string } | null>(null);

  const { data: colabs = [], isLoading: loadingC } = useQuery({
    queryKey: ["ponto-vinculos-colabs"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["professor", "admin", "coordenador", "nutricionista", "fisioterapeuta"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      return (profs ?? []).sort((a: any, b: any) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
      );
    },
  });

  const { data: vinculos = [], isLoading: loadingV } = useQuery({
    queryKey: ["ponto-vinculos-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cadastro_trabalhista" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as CadastroRow[];
    },
  });

  const vinculoByUser = useMemo(() => {
    const m = new Map<string, CadastroRow>();
    vinculos.forEach((v) => m.set(v.usuario_id, v));
    return m;
  }, [vinculos]);

  if (loadingC || loadingV) return <Skeleton className="h-64" />;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Cadastro Trabalhista</h3>
        <p className="text-xs text-muted-foreground ml-auto">
          Defina vínculo, valor hora-aula e elegibilidade ao ponto para cada colaborador.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead>Vínculo</TableHead>
            <TableHead className="text-right">Hora-aula</TableHead>
            <TableHead className="text-right">Carga semanal</TableHead>
            <TableHead className="text-right">Limite diário</TableHead>
            <TableHead>Banco horas</TableHead>
            <TableHead>Elegível ponto</TableHead>
            <TableHead>Art. 62</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {colabs.map((c: any) => {
            const v = vinculoByUser.get(c.user_id);
            return (
              <TableRow key={c.user_id}>
                <TableCell className="font-medium">{c.full_name ?? "—"}</TableCell>
                <TableCell>
                  {v ? (
                    <Badge variant="outline" className={TIPO_BADGE[v.tipo_vinculo]}>
                      {TIPO_LABEL[v.tipo_vinculo]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Não cadastrado</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {v ? `R$ ${Number(v.valor_hora_aula).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {v ? `${Math.round(v.carga_horaria_semanal_min / 60)}h` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {v ? `${Math.round(v.limite_diario_min / 60)}h` : "—"}
                </TableCell>
                <TableCell>
                  {v?.banco_horas_ativo ? (
                    <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                      Ativo
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {v?.elegivel_ponto === false ? (
                    <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                      Não
                    </Badge>
                  ) : (
                    <span className="text-xs text-success">Sim</span>
                  )}
                </TableCell>
                <TableCell>
                  {v?.art_62_clt ? (
                    <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 gap-1">
                      <ShieldCheck className="w-3 h-3" /> Confiança
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setEditing({ user_id: c.user_id, nome: c.full_name ?? "—" })}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {colabs.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                Nenhum colaborador encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {editing && (
        <EditarVinculoDialog
          userId={editing.user_id}
          nome={editing.nome}
          atual={vinculoByUser.get(editing.user_id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["ponto-vinculos-all"] });
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

interface EditDialogProps {
  userId: string;
  nome: string;
  atual?: CadastroRow;
  onClose: () => void;
  onSaved: () => void;
}

function EditarVinculoDialog({ userId, nome, atual, onClose, onSaved }: EditDialogProps) {
  const [form, setForm] = useState<Omit<CadastroRow, "usuario_id">>(() =>
    atual
      ? {
          tipo_vinculo: atual.tipo_vinculo,
          valor_hora_aula: Number(atual.valor_hora_aula ?? 0),
          carga_horaria_semanal_min: atual.carga_horaria_semanal_min ?? 2200,
          limite_diario_min: atual.limite_diario_min ?? 480,
          banco_horas_ativo: !!atual.banco_horas_ativo,
          elegivel_ponto: atual.elegivel_ponto ?? true,
          art_62_clt: !!atual.art_62_clt,
          observacoes: atual.observacoes ?? null,
        }
      : { ...DEFAULT_ROW },
  );

  const cargaH = Math.round(form.carga_horaria_semanal_min / 60);
  const limiteH = Math.round(form.limite_diario_min / 60);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        usuario_id: userId,
        tipo_vinculo: form.tipo_vinculo,
        valor_hora_aula: form.valor_hora_aula,
        carga_horaria_semanal_min: form.carga_horaria_semanal_min,
        limite_diario_min: form.limite_diario_min,
        banco_horas_ativo: form.banco_horas_ativo,
        elegivel_ponto: form.elegivel_ponto,
        art_62_clt: form.art_62_clt,
        observacoes: form.observacoes,
      };
      const { error } = await supabase
        .from("cadastro_trabalhista" as any)
        .upsert(payload, { onConflict: "usuario_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro salvo", { description: `Vínculo de ${nome} atualizado.` });
      onSaved();
    },
    onError: (e: any) =>
      toast.error("Falha ao salvar", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadastro trabalhista — {nome}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo de vínculo</Label>
            <Select
              value={form.tipo_vinculo}
              onValueChange={(v: TipoVinculo) => setForm({ ...form, tipo_vinculo: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as TipoVinculo[]).map((k) => (
                  <SelectItem key={k} value={k}>{TIPO_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor hora-aula (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.valor_hora_aula}
              onChange={(e) => setForm({ ...form, valor_hora_aula: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label>Carga horária semanal (horas)</Label>
            <Input
              type="number"
              min={0}
              max={80}
              value={cargaH}
              onChange={(e) =>
                setForm({ ...form, carga_horaria_semanal_min: Number(e.target.value) * 60 })
              }
            />
          </div>

          <div>
            <Label>Limite diário (horas)</Label>
            <Input
              type="number"
              min={0}
              max={12}
              value={limiteH}
              onChange={(e) =>
                setForm({ ...form, limite_diario_min: Number(e.target.value) * 60 })
              }
            />
          </div>

          <div className="flex items-center justify-between border border-border rounded-md p-3">
            <div>
              <Label className="cursor-pointer">Regime banco de horas</Label>
              <p className="text-xs text-muted-foreground">Compensações via saldo</p>
            </div>
            <Switch
              checked={form.banco_horas_ativo}
              onCheckedChange={(v) => setForm({ ...form, banco_horas_ativo: v })}
            />
          </div>

          <div className="flex items-center justify-between border border-border rounded-md p-3">
            <div>
              <Label className="cursor-pointer">Elegível ao controle de ponto</Label>
              <p className="text-xs text-muted-foreground">Se não, ocultar marcações</p>
            </div>
            <Switch
              checked={form.elegivel_ponto}
              onCheckedChange={(v) => setForm({ ...form, elegivel_ponto: v })}
            />
          </div>

          <div className="flex items-center justify-between border border-border rounded-md p-3 md:col-span-2">
            <div>
              <Label className="cursor-pointer">Art. 62 CLT (cargo de confiança)</Label>
              <p className="text-xs text-muted-foreground">
                Dispensa controle de jornada conforme art. 62 da CLT
              </p>
            </div>
            <Switch
              checked={form.art_62_clt}
              onCheckedChange={(v) => setForm({ ...form, art_62_clt: v })}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes ?? ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
