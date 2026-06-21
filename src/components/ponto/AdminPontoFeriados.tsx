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
import { CalendarDays, Plus, Trash2 } from "lucide-react";

interface Feriado {
  id: string;
  data: string;
  descricao: string;
  tipo: "nacional" | "estadual" | "municipal" | "facultativo" | "recesso";
}

const TIPOS = [
  { v: "nacional", l: "Nacional" },
  { v: "estadual", l: "Estadual" },
  { v: "municipal", l: "Municipal" },
  { v: "facultativo", l: "Facultativo" },
  { v: "recesso", l: "Recesso" },
] as const;

export function AdminPontoFeriados() {
  const qc = useQueryClient();
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<Feriado["tipo"]>("nacional");

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["ponto-feriados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_feriados" as any).select("*").order("data");
      if (error) throw error;
      return data as unknown as Feriado[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!data || !descricao.trim()) throw new Error("Informe data e descrição");
      const { error } = await supabase.from("ponto_feriados" as any).insert({ data, descricao: descricao.trim(), tipo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Feriado cadastrado");
      setData(""); setDescricao(""); setTipo("nacional");
      qc.invalidateQueries({ queryKey: ["ponto-feriados"] });
    },
    onError: (e: any) => toast.error("Falha", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_feriados" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Feriado removido");
      qc.invalidateQueries({ queryKey: ["ponto-feriados"] });
    },
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Feriados e recessos</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Datas em que ninguém precisa bater ponto. Esses dias não contam como pendência nas telas de Ponto, Equipe, Relatório e Fechamento.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[160px,1fr,180px,auto] gap-3 items-end">
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Confraternização Universal" />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as Feriado["tipo"])}>
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

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !feriados.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum feriado cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[140px]">Tipo</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feriados.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="tabular-nums">{new Date(f.data + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{f.descricao}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{f.tipo}</Badge></TableCell>
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
