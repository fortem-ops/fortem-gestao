import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMinutes, mesLabel } from "@/lib/ponto";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FechamentoRow {
  id: string;
  usuario_id: string;
  mes: string;
  total_minutos: number;
  minutos_extras: number;
  minutos_faltantes: number;
  pendencias_count: number;
  status: "aberto" | "em_revisao" | "aprovado";
  professor_nome: string;
  dias_feriado?: number;
  dias_ferias?: number;
}

function isoMesPrimeiroDia(s: string): string {
  // s é YYYY-MM
  return `${s}-01`;
}

export function FechamentoMensalTable() {
  const qc = useQueryClient();
  const hojeMes = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState<string>(hojeMes);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["ponto-fechamento-mes", mes],
    queryFn: async () => {
      const mesIso = isoMesPrimeiroDia(mes);
      const { data: fechamentos, error } = await supabase
        .from("ponto_fechamentos_mensais")
        .select("*")
        .eq("mes", mesIso);
      if (error) throw error;
      const userIds = (fechamentos ?? []).map((f) => f.usuario_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return ((fechamentos ?? []) as any[]).map((f) => ({
        ...f,
        professor_nome: map.get(f.usuario_id) ?? "—",
      })) as FechamentoRow[];
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_gerar_fechamentos_mes", { _mes: isoMesPrimeiroDia(mes) });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Fechamentos gerados", description: "Recalculados para todos os professores do mês." });
      qc.invalidateQueries({ queryKey: ["ponto-fechamento-mes"] });
    },
    onError: (e: any) => toast({ title: "Falha", description: e.message, variant: "destructive" }),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_ponto_aprovar_fechamento", { _fechamento_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Fechamento aprovado", description: "Registros do mês ficaram bloqueados para edição." });
      qc.invalidateQueries({ queryKey: ["ponto-fechamento-mes"] });
    },
    onError: (e: any) => toast({ title: "Falha ao aprovar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mês</label>
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={() => gerar.mutate()} disabled={gerar.isPending} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${gerar.isPending ? "animate-spin" : ""}`} />
          Recalcular mês
        </Button>
        <p className="text-sm text-muted-foreground ml-auto">
          {mesLabel(new Date(isoMesPrimeiroDia(mes)))}
        </p>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !rows?.length ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nenhum fechamento gerado para este mês ainda.</p>
            <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>Gerar agora</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Extras</TableHead>
                <TableHead className="text-right">Déficit</TableHead>
                <TableHead className="text-right">Pendências</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.professor_nome}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMinutes(r.total_minutos)}</TableCell>
                  <TableCell className="text-right text-success">+{formatMinutes(r.minutos_extras)}</TableCell>
                  <TableCell className="text-right text-destructive">-{formatMinutes(r.minutos_faltantes)}</TableCell>
                  <TableCell className="text-right">
                    {r.pendencias_count > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3 h-3" /> {r.pendencias_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "aprovado" ? (
                      <Badge className="bg-success/15 text-success border-success/30 gap-1" variant="outline">
                        <Lock className="w-3 h-3" /> Aprovado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Aberto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status !== "aprovado" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" className="gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Aprovar fechamento de {r.professor_nome}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Após a aprovação, todas as jornadas deste mês ficarão <strong>bloqueadas para edição</strong>.
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => aprovar.mutate(r.id)}>Aprovar e bloquear</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className="text-xs text-muted-foreground">Bloqueado</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
