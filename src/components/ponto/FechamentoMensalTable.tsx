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
import { gerarEspelhoFechamentoPdf, type BancoHorasPdfRow } from "@/lib/pontoPdf";
import { toast } from "sonner";
import { CheckCircle2, FileDown, Lock, RefreshCw, ShieldAlert } from "lucide-react";
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
  const [exportandoId, setExportandoId] = useState<string | null>(null);

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
      toast.success("Fechamentos gerados", { description: "Recalculados para todos os professores do mês." });
      qc.invalidateQueries({ queryKey: ["ponto-fechamento-mes"] });
    },
    onError: (e: any) => toast.error("Falha", { description: e.message }),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_ponto_aprovar_fechamento", { _fechamento_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fechamento aprovado", { description: "Registros do mês ficaram bloqueados para edição." });
      qc.invalidateQueries({ queryKey: ["ponto-fechamento-mes"] });
    },
    onError: (e: any) => toast.error("Falha ao aprovar", { description: e.message }),
  });

  const handleExportarPdf = async (r: FechamentoRow) => {
    setExportandoId(r.id);
    try {
      const mesIso = isoMesPrimeiroDia(mes); // "YYYY-MM-01"
      const anoMes = new Date(mesIso + "T12:00");
      const mesFimIso = new Date(anoMes.getFullYear(), anoMes.getMonth() + 1, 0)
        .toISOString().slice(0, 10); // último dia do mês

      // 1. Jornadas do mês — selecionar todos os campos incluindo timestamps completos
      const { data: jornadas, error: errJ } = await supabase
        .from("ponto_jornadas")
        .select(`
          data, entrada, intervalo_inicio, intervalo_fim, saida,
          prev_entrada, prev_saida, prev_intervalo_min,
          divergencia_entrada_min, divergencia_intervalo_min, divergencia_saida_min,
          divergencia_total_dia, minutos_tolerados, minutos_considerados,
          minutos_extras_validos, minutos_descontaveis, minutos_trabalhados,
          status_ponto, tolerancia_excedida
        `)
        .eq("usuario_id", r.usuario_id)
        .gte("data", mesIso)
        .lte("data", mesFimIso)
        .order("data", { ascending: true });
      if (errJ) throw errJ;

      // 2. Todos os lançamentos do banco de horas do mês (automáticos + manuais)
      const { data: banco, error: errB } = await supabase
        .from("ponto_banco_horas" as any)
        .select("data, minutos, tipo, motivo")
        .eq("usuario_id", r.usuario_id)
        .gte("data", mesIso)
        .lte("data", mesFimIso)
        .order("data", { ascending: true }) as any;
      if (errB) throw errB;

      // 3. Saldo acumulado até o fim do mês (mesma lógica do AdminBancoHorasTable)
      const { data: saldoTodos, error: errS } = await supabase
        .from("ponto_banco_horas" as any)
        .select("minutos")
        .eq("usuario_id", r.usuario_id)
        .lte("data", mesFimIso) as any;
      if (errS) throw errS;

      const saldoAcumulado = (saldoTodos ?? []).reduce((acc: number, l: any) => acc + (l.minutos ?? 0), 0);
      const movimentoMes   = (banco ?? []).reduce((acc: number, l: any) => acc + (l.minutos ?? 0), 0);

      // 4. Férias e feriados do mês
      const { data: ferias } = await supabase
        .from("ponto_ferias")
        .select("data_inicio, data_fim, tipo")
        .eq("usuario_id", r.usuario_id)
        .lte("data_inicio", mesFimIso)
        .gte("data_fim", mesIso);

      const { data: feriados } = await supabase
        .from("ponto_feriados")
        .select("data, nome")
        .gte("data", mesIso)
        .lte("data", mesFimIso);

      // Montar set de dias com ausência justificada
      const ausencias: Record<string, string> = {};
      (feriados ?? []).forEach((f: any) => { ausencias[f.data] = `Feriado: ${f.nome}`; });
      (ferias ?? []).forEach((f: any) => {
        const start = new Date(f.data_inicio + "T00:00");
        const end   = new Date(f.data_fim + "T00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().slice(0, 10);
          if (iso >= mesIso && iso <= mesFimIso) {
            ausencias[iso] = f.tipo === "ferias" ? "Férias" : "Ausência justificada";
          }
        }
      });

      // 5. Horários previstos para identificar dias de trabalho sem jornada registrada
      const { data: horarios } = await supabase
        .from("ponto_horarios_professor")
        .select("dia_semana")
        .eq("usuario_id", r.usuario_id)
        .eq("ativo", true);
      const diasComHorario = new Set((horarios ?? []).map((h: any) => h.dia_semana));

      // Gerar lista de dias do mês que têm horário previsto ou jornada registrada
      const jornadasMap = new Map((jornadas ?? []).map((j: any) => [j.data, j]));
      const todasJornadas: any[] = [];
      const inicio = new Date(mesIso + "T00:00");
      const fim    = new Date(mesFimIso + "T00:00");
      for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const dow = d.getDay(); // 0=dom, 6=sab
        if (jornadasMap.has(iso)) {
          // Dia com jornada registrada
          todasJornadas.push({ ...jornadasMap.get(iso), ausencia_justificada: ausencias[iso] ?? null });
        } else if (diasComHorario.has(dow) && ausencias[iso]) {
          // Dia com horário previsto e ausência justificada (férias/feriado)
          todasJornadas.push({ data: iso, entrada: null, ausencia_justificada: ausencias[iso] });
        }
        // Dias sem horário previsto e sem jornada: ignorar
      }
      todasJornadas.sort((a, b) => a.data.localeCompare(b.data));

      // 6. Perfil (CPF mascarado e PIS)
      const { data: perfil } = await supabase
        .from("profiles")
        .select("cpf, pis_pasep, full_name")
        .eq("user_id", r.usuario_id)
        .maybeSingle();

      // Mascarar CPF: mostrar apenas últimos 3 dígitos
      const cpfRaw = (perfil as any)?.cpf as string | null | undefined;
      const cpfMask = cpfRaw
        ? `•••.•••.•••-${cpfRaw.replace(/\D/g, "").slice(-2)}`
        : null;

      const mesRef = anoMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      gerarEspelhoFechamentoPdf({
        colaborador:   r.professor_nome,
        cpf:           cpfMask,
        pisPasep:      (perfil as any)?.pis_pasep ?? null,
        mesReferencia: mesRef,
        jornadas:      todasJornadas,
        bancoHoras:    (banco ?? []) as BancoHorasPdfRow[],
        movimentoMes,
        saldoAcumulado,
      });
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e.message });
    } finally {
      setExportandoId(null);
    }
  };

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
                <TableHead className="text-right">Feriados</TableHead>
                <TableHead className="text-right">Férias</TableHead>
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
                  <TableCell className="text-right text-muted-foreground">{r.dias_feriado ?? 0}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.dias_ferias ?? 0}</TableCell>
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
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleExportarPdf(r)}
                        disabled={exportandoId === r.id}
                      >
                        <FileDown className={`w-3.5 h-3.5 ${exportandoId === r.id ? "animate-bounce" : ""}`} />
                        {exportandoId === r.id ? "Gerando..." : "PDF"}
                      </Button>
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
                    </div>
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
