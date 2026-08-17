import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, FlaskConical } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { formatMinutes, formatHora } from "@/lib/ponto";

interface Lancamento {
  id: string;
  data: string;
  minutos: number;
  tipo: string;
  motivo: string | null;
  referencia_jornada_id: string | null;
}

interface Jornada {
  id: string;
  entrada: string | null;
  saida: string | null;
  divergencia_entrada_min: number | null;
  divergencia_saida_min: number | null;
  minutos_descontaveis: number | null;
  minutos_extras_validos: number | null;
}

export default function DiagnosticoBancoHoras() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [profId, setProfId] = useState<string>("c84ab9df-66c6-4cd6-abcf-392b0a1b3fd2");
  const [mes, setMes] = useState("2026-07");
  const [alvo, setAlvo] = useState<Lancamento | null>(null);
  const [recalc, setRecalc] = useState<{ total: number; done: number } | null>(null);
  const [fixando, setFixando] = useState(false);


  const mesIni = `${mes}-01`;
  const mesFimExcl = useMemo(() => {
    const d = new Date(mesIni + "T00:00");
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
  }, [mesIni]);

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["diag-banco-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["diag-banco-profs"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["professor", "admin"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids)
        .order("full_name");
      return (data ?? []) as Array<{ user_id: string; full_name: string }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["diag-banco-lancamentos", profId, mesIni, mesFimExcl],
    enabled: !!isAdmin && !!profId,
    queryFn: async () => {
      const { data: lanc, error } = await supabase
        .from("ponto_banco_horas")
        .select("id, data, minutos, tipo, motivo, referencia_jornada_id")
        .eq("usuario_id", profId)
        .gte("data", mesIni)
        .lt("data", mesFimExcl)
        .order("data");
      if (error) throw error;
      const lancamentos = (lanc ?? []) as unknown as Lancamento[];

      const jids = Array.from(
        new Set(lancamentos.map((l) => l.referencia_jornada_id).filter(Boolean)),
      ) as string[];
      let jornadas: Record<string, Jornada> = {};
      if (jids.length) {
        const { data: js } = await supabase
          .from("ponto_jornadas")
          .select(
            "id, entrada, saida, divergencia_entrada_min, divergencia_saida_min, minutos_descontaveis, minutos_extras_validos",
          )
          .in("id", jids);
        jornadas = Object.fromEntries(((js ?? []) as unknown as Jornada[]).map((j) => [j.id, j]));
      }

      const { data: todos } = await supabase
        .from("ponto_banco_horas")
        .select("minutos")
        .eq("usuario_id", profId);
      const saldoGeral = (todos ?? []).reduce((a: number, r: any) => a + (r.minutos ?? 0), 0);

      return { lancamentos, jornadas, saldoGeral };
    },
  });

  const totalMes = useMemo(
    () => (data?.lancamentos ?? []).reduce((a, l) => a + l.minutos, 0),
    [data],
  );

  if (loading || checking) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return <Card className="p-10 text-center text-muted-foreground">Acesso restrito a administradores.</Card>;
  }

  const excluir = async () => {
    if (!alvo) return;
    const { error } = await supabase.from("ponto_banco_horas").delete().eq("id", alvo.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else {
      toast.success("Lançamento excluído.");
      qc.invalidateQueries({ queryKey: ["diag-banco-lancamentos"] });
    }
    setAlvo(null);
  };

  const recalcularMes = async () => {
    // Limpar lançamentos automáticos do mês antes de recalcular
    const { error: delError } = await supabase
      .from("ponto_banco_horas")
      .delete()
      .eq("usuario_id", profId)
      .gte("data", mesIni)
      .lt("data", mesFimExcl)
      .in("tipo", ["tolerancia_excedida", "hora_extra"])
      .not("referencia_jornada_id", "is", null);
    if (delError) {
      toast.error("Erro ao limpar lançamentos automáticos: " + delError.message);
      return;
    }

    const { data: js, error } = await supabase
      .from("ponto_jornadas")
      .select("id")
      .eq("usuario_id", profId)
      .gte("data", mesIni)
      .lt("data", mesFimExcl)
      .not("saida", "is", null);
    if (error) {
      toast.error("Erro ao buscar jornadas: " + error.message);
      return;
    }
    const ids = (js ?? []).map((j: any) => j.id as string);
    setRecalc({ total: ids.length, done: 0 });
    let erros = 0;
    for (let i = 0; i < ids.length; i++) {
      const r1 = await supabase.rpc("fn_ponto_calcular_divergencias" as any, { _jornada_id: ids[i] });
      const r2 = await supabase.rpc("fn_ponto_consolidar_banco" as any, { _jornada_id: ids[i] });
      if (r1.error || r2.error) erros++;
      setRecalc({ total: ids.length, done: i + 1 });
    }
    setRecalc(null);
    if (erros) toast.error(`${erros} jornada(s) falharam no recálculo.`);
    else toast.success(`${ids.length} jornada(s) recalculadas.`);
    qc.invalidateQueries({ queryKey: ["diag-banco-lancamentos"] });
  };

  const reaplicarFixProducao = async () => {
    setFixando(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("ponto-fix-divergencias", { body: {} });
      if (error) throw error;
      toast.success(`Fix aplicado: ${res?.reprocessadas ?? 0}/${res?.total ?? 0} jornadas reprocessadas${res?.falhas ? ` · ${res.falhas} falhas` : ""}.`);
      qc.invalidateQueries({ queryKey: ["diag-banco-lancamentos"] });
    } catch (e: any) {
      toast.error("Erro ao reaplicar fix: " + (e?.message ?? "desconhecido"));
    } finally {
      setFixando(false);
    }
  };

  const sign = (n: number) => `${n >= 0 ? "+" : "−"}${formatMinutes(Math.abs(n))}`;


  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" /> Diagnóstico — Banco de Horas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Página temporária de investigação de lançamentos e jornadas.
        </p>
      </header>

      <Card className="glass-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Profissional</Label>
            <Select value={profId} onValueChange={setProfId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" onClick={recalcularMes} disabled={!!recalc}>
            <RefreshCw className={`w-4 h-4 mr-2 ${recalc ? "animate-spin" : ""}`} />
            {recalc ? `Recalculando ${recalc.done}/${recalc.total}...` : "Recalcular todas as jornadas do mês"}
          </Button>
          <Button variant="destructive" onClick={reaplicarFixProducao} disabled={fixando}>
            <RefreshCw className={`w-4 h-4 mr-2 ${fixando ? "animate-spin" : ""}`} />
            {fixando ? "Reaplicando..." : "Reaplicar fix produção"}
          </Button>
        </div>
      </Card>


      <Card className="glass-card p-4 overflow-x-auto">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !data?.lancamentos.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Minutos</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Jornada</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Div. entrada</TableHead>
                <TableHead className="text-right">Div. saída</TableHead>
                <TableHead className="text-right">Descontáveis</TableHead>
                <TableHead className="text-right">Extras válidos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lancamentos.map((l) => {
                const j = l.referencia_jornada_id ? data.jornadas[l.referencia_jornada_id] : undefined;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{new Date(l.data + "T00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className={`text-right font-bold ${l.minutos >= 0 ? "text-success" : "text-destructive"}`}>
                      {sign(l.minutos)}
                    </TableCell>
                    <TableCell className="text-xs">{l.tipo}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={l.motivo ?? ""}>{l.motivo ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.referencia_jornada_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell>{formatHora(j?.entrada)}</TableCell>
                    <TableCell>{formatHora(j?.saida)}</TableCell>
                    <TableCell className="text-right">{j?.divergencia_entrada_min ?? "—"}</TableCell>
                    <TableCell className="text-right">{j?.divergencia_saida_min ?? "—"}</TableCell>
                    <TableCell className="text-right">{j?.minutos_descontaveis ?? "—"}</TableCell>
                    <TableCell className="text-right">{j?.minutos_extras_validos ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setAlvo(l)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-wrap gap-6 border-t border-border mt-4 pt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total do período: </span>
            <span className={`font-bold ${totalMes >= 0 ? "text-success" : "text-destructive"}`}>{sign(totalMes)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Saldo acumulado geral: </span>
            <span className={`font-bold ${(data?.saldoGeral ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
              {sign(data?.saldoGeral ?? 0)}
            </span>
          </div>
        </div>
      </Card>

      <AlertDialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {alvo && `${new Date(alvo.data + "T00:00").toLocaleDateString("pt-BR")} · ${sign(alvo.minutos)} · ${alvo.tipo}`}
              . Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
