import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { formatMinutes } from "@/lib/ponto";

const TIPO_LABEL: Record<string, string> = {
  credito_manual: "Crédito manual",
  debito_manual: "Débito manual",
  compensacao: "Compensação",
  ajuste_saldo: "Ajuste de saldo",
};

interface Lancamento {
  id: string;
  data: string;
  minutos: number;
  motivo: string;
  tipo: string;
  registrado_por: string;
}

export function MeuBancoHoras() {
  const { user } = useAuth();
  const userId = user?.id;
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.toISOString().slice(0, 7));

  const { data: saldoTotal } = useQuery({
    queryKey: ["meu-banco-saldo", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_banco_saldo", { _user_id: userId! });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });

  const { data: resumo } = useQuery({
    queryKey: ["meu-banco-resumo", userId, mes],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_banco_resumo", {
        _user_id: userId!,
        _mes: mes + "-01",
      });
      if (error) throw error;
      return data as { saldo_inicial: number; creditos_mes: number; debitos_mes: number; movimentacao_mes: number; saldo_final: number };
    },
  });

  const mesIni = mes + "-01";
  const mesFim = useMemo(() => {
    const dt = new Date(mesIni + "T00:00");
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
  }, [mesIni]);

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["meu-banco-lancamentos", userId, mes],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_banco_horas" as any)
        .select("id, data, minutos, motivo, tipo, registrado_por")
        .eq("usuario_id", userId!)
        .gte("data", mesIni)
        .lte("data", mesFim)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lancamento[];
    },
  });

  const respIds = Array.from(new Set(lancamentos.map((l) => l.registrado_por)));
  const { data: perfis = [] } = useQuery({
    queryKey: ["meu-banco-perfis", respIds],
    enabled: respIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", respIds);
      return data ?? [];
    },
  });
  const perfilMap = new Map(perfis.map((p: any) => [p.user_id, p.full_name]));

  if (!userId) return <Skeleton className="h-64" />;

  const saldoColor = (n: number) => (n >= 0 ? "text-success" : "text-destructive");
  const saldoSign = (n: number) => (n >= 0 ? "+" : "-");

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${(saldoTotal ?? 0) >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
            <Wallet className={`w-7 h-7 ${saldoColor(saldoTotal ?? 0)}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo total acumulado</p>
            <p className={`text-3xl font-bold ${saldoColor(saldoTotal ?? 0)}`}>
              {saldoSign(saldoTotal ?? 0)}{formatMinutes(Math.abs(saldoTotal ?? 0))}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
          </div>
        </div>
      </Card>

      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Saldo inicial</p>
            <p className={`text-lg font-bold ${saldoColor(resumo.saldo_inicial)}`}>
              {saldoSign(resumo.saldo_inicial)}{formatMinutes(Math.abs(resumo.saldo_inicial))}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3 text-success" />Créditos no mês</p>
            <p className="text-lg font-bold text-success">+{formatMinutes(resumo.creditos_mes)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3 text-destructive" />Débitos no mês</p>
            <p className="text-lg font-bold text-destructive">-{formatMinutes(Math.abs(resumo.debitos_mes))}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Saldo final</p>
            <p className={`text-lg font-bold ${saldoColor(resumo.saldo_final)}`}>
              {saldoSign(resumo.saldo_final)}{formatMinutes(Math.abs(resumo.saldo_final))}
            </p>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Lançamentos do mês</h3>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : !lancamentos.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento neste mês.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Minutos</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{new Date(l.data + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_LABEL[l.tipo] ?? l.tipo}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${saldoColor(l.minutos)}`}>
                    {saldoSign(l.minutos)}{formatMinutes(Math.abs(l.minutos))}
                  </TableCell>
                  <TableCell className="max-w-md text-sm">{l.motivo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(perfilMap.get(l.registrado_por) as string) ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
