import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, History } from "lucide-react";
import { formatMinutes } from "@/lib/ponto";
import { LancamentoBancoHorasDialog } from "./LancamentoBancoHorasDialog";
import { HistoricoBancoHorasDialog } from "./HistoricoBancoHorasDialog";

interface Props {
  profissionais: Array<{ user_id: string; full_name: string }>;
  profId: string;
  setProfId: (v: string) => void;
}

export function AdminBancoHorasTable({ profissionais, profId, setProfId }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.toISOString().slice(0, 7));
  const [novoOpen, setNovoOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [alvo, setAlvo] = useState<{ id: string; nome: string } | null>(null);

  const mesIni = mes + "-01";
  const mesFim = useMemo(() => {
    const dt = new Date(mesIni + "T00:00");
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
  }, [mesIni]);

  const usuariosFiltrados = useMemo(
    () => (profId === "todos" ? profissionais : profissionais.filter((p) => p.user_id === profId)),
    [profissionais, profId],
  );

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["admin-banco-lancamentos-mes", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_banco_horas" as any)
        .select("usuario_id, minutos, data");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ usuario_id: string; minutos: number; data: string }>;
    },
  });

  const linhas = useMemo(() => {
    return usuariosFiltrados.map((p) => {
      const todos = lancamentos.filter((l) => l.usuario_id === p.user_id);
      const ate = todos.filter((l) => l.data <= mesFim);
      const noMes = todos.filter((l) => l.data >= mesIni && l.data <= mesFim);
      const saldo = ate.reduce((acc, l) => acc + l.minutos, 0);
      const cred = noMes.filter((l) => l.minutos > 0).reduce((a, l) => a + l.minutos, 0);
      const deb = noMes.filter((l) => l.minutos < 0).reduce((a, l) => a + l.minutos, 0);
      return { user_id: p.user_id, nome: p.full_name, saldo, cred, deb };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [usuariosFiltrados, lancamentos, mesIni, mesFim]);

  const saldoColor = (n: number) => (n >= 0 ? "text-success" : "text-destructive");

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs">Profissional</Label>
            <Select value={profId} onValueChange={setProfId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {profissionais.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !linhas.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum profissional.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-right">Saldo acumulado</TableHead>
                <TableHead className="text-right">Créditos no mês</TableHead>
                <TableHead className="text-right">Débitos no mês</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className={`text-right font-bold ${saldoColor(r.saldo)}`}>
                    {r.saldo >= 0 ? "+" : "-"}{formatMinutes(Math.abs(r.saldo))}
                  </TableCell>
                  <TableCell className="text-right text-success">+{formatMinutes(r.cred)}</TableCell>
                  <TableCell className="text-right text-destructive">-{formatMinutes(Math.abs(r.deb))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setAlvo({ id: r.user_id, nome: r.nome }); setHistOpen(true); }}>
                        <History className="w-4 h-4 mr-1" /> Histórico
                      </Button>
                      <Button size="sm" onClick={() => { setAlvo({ id: r.user_id, nome: r.nome }); setNovoOpen(true); }}>
                        <Plus className="w-4 h-4 mr-1" /> Lançar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {alvo && (
        <>
          <LancamentoBancoHorasDialog
            open={novoOpen}
            onOpenChange={setNovoOpen}
            usuarioId={alvo.id}
            usuarioNome={alvo.nome}
          />
          <HistoricoBancoHorasDialog
            open={histOpen}
            onOpenChange={setHistOpen}
            usuarioId={alvo.id}
            usuarioNome={alvo.nome}
          />
        </>
      )}
    </>
  );
}
