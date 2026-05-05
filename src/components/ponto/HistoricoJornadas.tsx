import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatHora, formatMinutes } from "@/lib/ponto";

interface Props {
  userId?: string;
}

export function HistoricoJornadas({ userId }: Props = {}) {
  const { user } = useAuth();
  const targetId = userId ?? user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["ponto-historico", targetId],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 14);
      const { data, error } = await supabase
        .from("ponto_jornadas")
        .select("id, data, entrada, intervalo_inicio, intervalo_fim, saida, minutos_trabalhados, status, observacao")
        .eq("usuario_id", targetId!)
        .gte("data", desde.toISOString().slice(0, 10))
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!targetId,
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card className="p-6">
      <h3 className="font-heading font-semibold text-lg mb-4">Histórico (últimos 14 dias)</h3>
      {!data?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma jornada registrada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Intervalo</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">
                  {new Date(j.data + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </TableCell>
                <TableCell className="tabular-nums">{formatHora(j.entrada)}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatHora(j.intervalo_inicio)} – {formatHora(j.intervalo_fim)}
                </TableCell>
                <TableCell className="tabular-nums">{formatHora(j.saida)}</TableCell>
                <TableCell className="text-right font-semibold">{formatMinutes(j.minutos_trabalhados)}</TableCell>
                <TableCell>
                  <Badge variant={j.saida ? "secondary" : "outline"} className="text-[10px]">
                    {j.saida ? "Encerrada" : "Em aberto"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
