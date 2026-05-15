import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { History, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/vendas";

type Props = { alunoId: string };

const statusColor: Record<string, string> = {
  pago: "status-active",
  pendente: "status-warning",
  cancelado: "status-urgent",
};

export function HistoricoVendas({ alunoId }: Props) {
  const qc = useQueryClient();

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas-aluno", alunoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendas")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data_venda", { ascending: false });
      return data || [];
    },
  });

  const { data: vendedores = {} } = useQuery({
    queryKey: ["vendas-vendedores", vendas.map((v: any) => v.vendedor_id).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(vendas.map((v: any) => v.vendedor_id).filter(Boolean)));
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids as string[]);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: vendas.length > 0,
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ["creditos-aluno", alunoId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("creditos_aluno").select("*").eq("aluno_id", alunoId);
      return data || [];
    },
  });

  const { data: isCoordAdmin = false } = useQuery({
    queryKey: ["is_coord_admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
      return !!data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("vendas").update({ status_pagamento: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["vendas-aluno", alunoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function creditoRestante(venda: any): string {
    const c = creditos.find((c: any) => c.origem_id === venda.id);
    if (!c) return "—";
    if (c.ilimitado) return "Ilimitado";
    return `${(c.quantidade_inicial || 0) - (c.quantidade_usada || 0)} / ${c.quantidade_inicial}`;
  }

  return (
    <div className="space-y-3 mt-6">
      <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
        <History className="w-4 h-4" /> Histórico de Vendas
      </h3>
      <div className="glass-card rounded-lg overflow-hidden">
        {isLoading ? <Skeleton className="h-24 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Créditos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.data_venda + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline">{v.tipo}</Badge>
                      {v.origem === "renovacao_automatica" && (
                        <Badge variant="outline" className="status-info gap-1 text-[10px]">
                          <RefreshCw className="w-2.5 h-2.5" /> Auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{v.nome_snapshot}</TableCell>
                  <TableCell>{formatBRL(v.valor)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vendedores[v.vendedor_id] || "—"}</TableCell>
                  <TableCell>
                    {isCoordAdmin ? (
                      <Select value={v.status_pagamento} onValueChange={(s) => updateStatus.mutate({ id: v.id, status: s })}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={statusColor[v.status_pagamento]}>{v.status_pagamento}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{creditoRestante(v)}</TableCell>
                </TableRow>
              ))}
              {vendas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma venda registrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
