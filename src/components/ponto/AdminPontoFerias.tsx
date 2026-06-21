import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plane, Plus, Trash2 } from "lucide-react";

interface Ferias {
  id: string;
  usuario_id: string;
  data_inicio: string;
  data_fim: string;
  tipo: "ferias" | "folga" | "atestado" | "licenca";
  observacao: string | null;
}

const TIPOS = [
  { v: "ferias", l: "Férias" },
  { v: "folga", l: "Folga" },
  { v: "atestado", l: "Atestado" },
  { v: "licenca", l: "Licença" },
] as const;

export function AdminPontoFerias() {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [tipo, setTipo] = useState<Ferias["tipo"]>("ferias");
  const [obs, setObs] = useState("");

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["ponto-colaboradores-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["professor", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return (profs ?? []).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    },
  });

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ["ponto-ferias-list", usuario],
    queryFn: async () => {
      let q = supabase.from("ponto_ferias" as any).select("*").order("data_inicio", { ascending: false });
      if (usuario) q = q.eq("usuario_id", usuario);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Ferias[];
    },
  });

  const nomeMap = new Map((colaboradores as any[]).map((c) => [c.user_id, c.full_name]));

  const add = useMutation({
    mutationFn: async () => {
      if (!usuario || !inicio || !fim) throw new Error("Funcionário e período são obrigatórios");
      if (fim < inicio) throw new Error("Data final menor que inicial");
      const { error } = await supabase.from("ponto_ferias" as any).insert({
        usuario_id: usuario, data_inicio: inicio, data_fim: fim, tipo, observacao: obs.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Período cadastrado");
      setInicio(""); setFim(""); setObs(""); setTipo("ferias");
      qc.invalidateQueries({ queryKey: ["ponto-ferias-list"] });
    },
    onError: (e: any) => toast.error("Falha", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_ferias" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Removido");
      qc.invalidateQueries({ queryKey: ["ponto-ferias-list"] });
    },
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Plane className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Férias, folgas e ausências justificadas</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Períodos individuais em que o colaborador não bate ponto. Ficam excluídos do esperado no fechamento e marcados como ausência justificada na Equipe Ponto.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,160px,160px,160px,auto] gap-3 items-end">
        <div>
          <Label className="text-xs">Funcionário</Label>
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {(colaboradores as any[]).map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as Ferias["tipo"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="gap-1">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>
      <div>
        <Label className="text-xs">Observação (opcional)</Label>
        <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: férias programadas, atestado médico, etc." />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !ferias.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {usuario ? "Nenhum período cadastrado para este funcionário." : "Nenhum período cadastrado."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ferias.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{nomeMap.get(f.usuario_id) ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{new Date(f.data_inicio + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="tabular-nums">{new Date(f.data_fim + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{f.tipo}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{f.observacao ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(f.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
