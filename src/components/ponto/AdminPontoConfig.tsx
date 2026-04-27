import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface ConfigRow {
  id: string;
  usuario_id: string | null;
  carga_diaria_min: number;
  intervalo_minimo_min: number;
  intervalo_obrigatorio: boolean;
  tolerancia_min: number;
}

export function AdminPontoConfig() {
  const qc = useQueryClient();
  const [novoProfId, setNovoProfId] = useState<string>("");

  const { data: configs, isLoading } = useQuery({
    queryKey: ["ponto-configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_configuracoes").select("*").order("usuario_id", { nullsFirst: true });
      if (error) throw error;
      return data as ConfigRow[];
    },
  });

  const { data: professores = [] } = useQuery({
    queryKey: ["ponto-professores-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "professor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return (profs ?? []).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<ConfigRow> & { id?: string }) => {
      if (row.id) {
        const { error } = await supabase.from("ponto_configuracoes").update(row).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ponto_configuracoes").insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração salva" });
      qc.invalidateQueries({ queryKey: ["ponto-configs"] });
      setNovoProfId("");
    },
    onError: (e: any) => toast({ title: "Falha", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_configuracoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Override removido" });
      qc.invalidateQueries({ queryKey: ["ponto-configs"] });
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;

  const global = configs?.find((c) => c.usuario_id === null);
  const overrides = configs?.filter((c) => c.usuario_id !== null) ?? [];

  const profMap = new Map(professores.map((p: any) => [p.user_id, p.full_name]));
  const profsSemOverride = professores.filter((p: any) => !overrides.some((o) => o.usuario_id === p.user_id));

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-lg">Configuração global (padrão)</h3>
          <Badge variant="secondary">Aplica-se quando não há override</Badge>
        </div>
        {global && <ConfigEditor row={global} onSave={(r) => upsert.mutate(r)} />}
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-heading font-semibold text-lg">Overrides por usuário</h3>

        <div className="flex flex-wrap items-end gap-3 p-3 bg-secondary/40 rounded-md">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Adicionar override para…</Label>
            <Select value={novoProfId} onValueChange={setNovoProfId}>
              <SelectTrigger><SelectValue placeholder="Selecionar professor" /></SelectTrigger>
              <SelectContent>
                {profsSemOverride.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!novoProfId || !global}
            onClick={() => upsert.mutate({
              usuario_id: novoProfId,
              carga_diaria_min: global!.carga_diaria_min,
              intervalo_minimo_min: global!.intervalo_minimo_min,
              intervalo_obrigatorio: global!.intervalo_obrigatorio,
              tolerancia_min: global!.tolerancia_min,
            })}
            className="gap-2"
          >
            <Plus className="w-4 h-4" /> Criar override
          </Button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum override configurado. Todos seguem a configuração global.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor</TableHead>
                <TableHead>Carga diária</TableHead>
                <TableHead>Intervalo mín.</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead>Tolerância</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((row) => (
                <OverrideRow key={row.id} row={row} nome={profMap.get(row.usuario_id!) ?? "—"} onSave={(r) => upsert.mutate(r)} onDelete={() => del.mutate(row.id)} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ConfigEditor({ row, onSave }: { row: ConfigRow; onSave: (r: Partial<ConfigRow> & { id: string }) => void }) {
  const [draft, setDraft] = useState(row);
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <div>
        <Label>Carga diária (min)</Label>
        <Input type="number" value={draft.carga_diaria_min} onChange={(e) => setDraft({ ...draft, carga_diaria_min: +e.target.value })} />
      </div>
      <div>
        <Label>Intervalo mínimo (min)</Label>
        <Input type="number" value={draft.intervalo_minimo_min} onChange={(e) => setDraft({ ...draft, intervalo_minimo_min: +e.target.value })} />
      </div>
      <div>
        <Label>Tolerância (min)</Label>
        <Input type="number" value={draft.tolerancia_min} onChange={(e) => setDraft({ ...draft, tolerancia_min: +e.target.value })} />
      </div>
      <div className="flex items-center justify-between gap-3 p-2">
        <Label>Intervalo obrigatório</Label>
        <Switch checked={draft.intervalo_obrigatorio} onCheckedChange={(v) => setDraft({ ...draft, intervalo_obrigatorio: v })} />
      </div>
      <div className="md:col-span-4">
        <Button onClick={() => onSave(draft)}>Salvar configuração global</Button>
      </div>
    </div>
  );
}

function OverrideRow({ row, nome, onSave, onDelete }: { row: ConfigRow; nome: string; onSave: (r: Partial<ConfigRow> & { id: string }) => void; onDelete: () => void }) {
  const [d, setD] = useState(row);
  return (
    <TableRow>
      <TableCell className="font-medium">{nome}</TableCell>
      <TableCell>
        <Input type="number" value={d.carga_diaria_min} onChange={(e) => setD({ ...d, carga_diaria_min: +e.target.value })} className="w-24" />
      </TableCell>
      <TableCell>
        <Input type="number" value={d.intervalo_minimo_min} onChange={(e) => setD({ ...d, intervalo_minimo_min: +e.target.value })} className="w-24" />
      </TableCell>
      <TableCell>
        <Switch checked={d.intervalo_obrigatorio} onCheckedChange={(v) => setD({ ...d, intervalo_obrigatorio: v })} />
      </TableCell>
      <TableCell>
        <Input type="number" value={d.tolerancia_min} onChange={(e) => setD({ ...d, tolerancia_min: +e.target.value })} className="w-24" />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="outline" onClick={() => onSave(d)}>Salvar</Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
