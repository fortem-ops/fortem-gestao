import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { formatMinutes } from "@/lib/ponto";
import { toast } from "@/hooks/use-toast";

const TIPO_LABEL: Record<string, string> = {
  credito_manual: "Crédito manual",
  debito_manual: "Débito manual",
  compensacao: "Compensação",
  ajuste_saldo: "Ajuste de saldo",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarioId: string;
  usuarioNome: string;
}

export function HistoricoBancoHorasDialog({ open, onOpenChange, usuarioId, usuarioNome }: Props) {
  const qc = useQueryClient();

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["admin-banco-historico", usuarioId],
    enabled: open && !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_banco_horas" as any)
        .select("id, data, minutos, motivo, tipo, registrado_por")
        .eq("usuario_id", usuarioId)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; data: string; minutos: number; motivo: string; tipo: string; registrado_por: string }>;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_banco_horas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lançamento excluído" });
      qc.invalidateQueries({ queryKey: ["admin-banco"] });
      qc.invalidateQueries({ queryKey: ["admin-banco-historico", usuarioId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saldoColor = (n: number) => (n >= 0 ? "text-success" : "text-destructive");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de banco de horas</DialogTitle>
          <DialogDescription>{usuarioNome}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !lancamentos.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Minutos</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{new Date(l.data + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell><Badge variant="outline">{TIPO_LABEL[l.tipo] ?? l.tipo}</Badge></TableCell>
                  <TableCell className={`text-right font-semibold ${saldoColor(l.minutos)}`}>
                    {l.minutos >= 0 ? "+" : "-"}{formatMinutes(Math.abs(l.minutos))}
                  </TableCell>
                  <TableCell className="max-w-md text-sm">{l.motivo}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { if (confirm("Excluir este lançamento?")) del.mutate(l.id); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
