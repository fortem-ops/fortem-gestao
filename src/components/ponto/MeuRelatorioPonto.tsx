import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, MapPin, FileText, AlertTriangle, Clock } from "lucide-react";
import { formatHora, formatMinutes } from "@/lib/ponto";
import { ExportarRelatorioMenu } from "@/components/ponto/ExportarRelatorioMenu";
import {
  exportarDiarioCSV,
  exportarDiarioXLSX,
  exportarMensalCSV,
  exportarMensalXLSX,
  type EventoExport,
  type JornadaExport,
  type MensalExport,
} from "@/lib/relatorioPontoExport";

interface Jornada {
  id: string;
  usuario_id: string;
  data: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  minutos_trabalhados: number | null;
  status: string;
  observacao: string | null;
  fechamento_id: string | null;
}

interface HorarioRow {
  usuario_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  intervalo_min: number;
  ativo: boolean;
}

const STATUS_OPTS = [
  { v: "todos", l: "Todos os status" },
  { v: "aberto", l: "Em aberto" },
  { v: "encerrada", l: "Encerrada" },
  { v: "pendencia", l: "Com pendência" },
];

function previstoMinutos(h?: HorarioRow): number {
  if (!h || !h.ativo) return 0;
  const [hi, mi] = h.horario_inicio.slice(0, 5).split(":").map(Number);
  const [hf, mf] = h.horario_fim.slice(0, 5).split(":").map(Number);
  return Math.max(0, hf * 60 + mf - (hi * 60 + mi) - (h.intervalo_min ?? 0));
}

function pendenciasJornada(j: Jornada, intervaloObrigatorio: boolean): string[] {
  const out: string[] = [];
  if (j.entrada && !j.saida) out.push("Saída ausente");
  if (intervaloObrigatorio && (!j.intervalo_inicio || !j.intervalo_fim)) out.push("Intervalo incompleto");
  return out;
}

export function MeuRelatorioPonto({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const targetId = userId ?? user?.id;

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [inicio, setInicio] = useState<string>(primeiroDiaMes);
  const [fim, setFim] = useState<string>(ultimoDiaMes);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [mesFiltro, setMesFiltro] = useState<string>(hoje.toISOString().slice(0, 7));

  // Nome do usuário logado
  const { data: perfil } = useQuery({
    queryKey: ["meu-relatorio-perfil", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("user_id", targetId!).single();
      return data;
    },
  });
  const meuNome = perfil?.full_name ?? "Eu";

  // Config global
  const { data: configGlobal } = useQuery({
    queryKey: ["meu-relatorio-config"],
    queryFn: async () => {
      const { data } = await supabase.from("ponto_configuracoes").select("intervalo_obrigatorio").is("usuario_id", null).maybeSingle();
      return data;
    },
  });
  const intervaloObrigatorio = !!configGlobal?.intervalo_obrigatorio;

  // Jornadas do usuário no período
  const { data: jornadas = [], isLoading: loadingJornadas } = useQuery({
    queryKey: ["meu-relatorio-jornadas", inicio, fim, targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_jornadas")
        .select("*")
        .eq("usuario_id", targetId!)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Jornada[];
    },
  });

  // Horários cadastrados do usuário
  const { data: horarios = [] } = useQuery({
    queryKey: ["meu-relatorio-horarios", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ponto_horarios_professor").select("*").eq("usuario_id", targetId!).eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as HorarioRow[];
    },
  });

  // Feriados
  const { data: feriados = [] } = useQuery({
    queryKey: ["meu-relatorio-feriados", inicio, fim, mesFiltro],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("ponto_feriados" as any).select("data, descricao");
      return (data ?? []) as unknown as { data: string; descricao: string }[];
    },
  });
  const feriadoMap = useMemo(() => new Map(feriados.map((f) => [f.data, f.descricao])), [feriados]);

  // Férias / folgas do usuário
  const { data: ferias = [] } = useQuery({
    queryKey: ["meu-relatorio-ferias", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("ponto_ferias" as any).select("data_inicio, data_fim, tipo").eq("usuario_id", userId!);
      return (data ?? []) as unknown as { data_inicio: string; data_fim: string; tipo: string }[];
    },
  });

  const ausenciaPara = (dataStr: string): { motivo: string; descricao?: string } | null => {
    if (feriadoMap.has(dataStr)) return { motivo: "feriado", descricao: feriadoMap.get(dataStr) };
    const f = ferias.find((x) => dataStr >= x.data_inicio && dataStr <= x.data_fim);
    if (f) return { motivo: f.tipo };
    return null;
  };

  const horarioPara = (dataStr: string): HorarioRow | undefined => {
    const dow = new Date(dataStr + "T00:00").getDay();
    return horarios.find((h) => h.dia_semana === dow);
  };

  const jornadasFiltradas = useMemo(() => {
    return jornadas.filter((j) => {
      if (statusFilter === "todos") return true;
      if (statusFilter === "aberto") return !j.saida;
      if (statusFilter === "encerrada") return !!j.saida;
      if (statusFilter === "pendencia") return pendenciasJornada(j, intervaloObrigatorio).length > 0;
      return true;
    });
  }, [jornadas, statusFilter, intervaloObrigatorio]);

  const periodoLabel = `${inicio}_a_${fim}`;

  // Resumo: pendências no período
  const resumoPendencias = useMemo(() => {
    return jornadasFiltradas.reduce((acc, j) => acc + pendenciasJornada(j, intervaloObrigatorio).length, 0);
  }, [jornadasFiltradas, intervaloObrigatorio]);

  const [dialogPendenciasOpen, setDialogPendenciasOpen] = useState(false);

  const jornadasComPendencias = useMemo(() => {
    return jornadasFiltradas
      .map((j) => ({ j, pends: pendenciasJornada(j, intervaloObrigatorio) }))
      .filter((x) => x.pends.length > 0);
  }, [jornadasFiltradas, intervaloObrigatorio]);

  // Agregação mensal individual
  const { data: bancoResumo } = useQuery({
    queryKey: ["meu-relatorio-banco-resumo", userId, mesFiltro],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_banco_resumo", {
        _user_id: userId!,
        _mes: mesFiltro + "-01",
      });
      if (error) throw error;
      return data as { saldo_inicial: number; creditos_mes: number; debitos_mes: number; movimentacao_mes: number; saldo_final: number };
    },
  });

  const agregadoMensal: MensalExport[] = useMemo(() => {
    const mesIni = mesFiltro + "-01";
    const dt = new Date(mesIni + "T00:00");
    const ultimo = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
    const dentroMes = jornadas.filter((j) => j.data >= mesIni && j.data <= ultimo);
    let dias = 0;
    let total = 0;
    let pend = 0;
    dentroMes.forEach((j) => {
      if (j.entrada) dias += 1;
      total += j.minutos_trabalhados ?? 0;
      pend += pendenciasJornada(j, intervaloObrigatorio).length;
    });

    let previsto = 0;
    const cur = new Date(mesIni + "T00:00");
    const end = new Date(ultimo + "T00:00");
    while (cur <= end) {
      const dow = cur.getDay();
      const iso = cur.toISOString().slice(0, 10);
      if (!ausenciaPara(iso)) {
        const h = horarios.find((x) => x.dia_semana === dow);
        previsto += previstoMinutos(h);
      }
      cur.setDate(cur.getDate() + 1);
    }

    const saldoJornadas = total - previsto;
    const saldoBanco = bancoResumo?.movimentacao_mes ?? 0;
    const saldoTotal = saldoJornadas + saldoBanco;

    // Buscar status de fechamento
    let statusFechamento = "aberto";
    // fechamentos são buscados no useQuery abaixo
    return [
      {
        mes: mesFiltro,
        professor: meuNome,
        dias_trabalhados: dias,
        total_minutos: total,
        previsto_minutos: previsto,
        saldo_minutos: saldoTotal,
        saldo_jornadas: saldoJornadas,
        saldo_banco: saldoBanco,
        pendencias: pend,
        status: statusFechamento,
      },
    ];
  }, [jornadas, mesFiltro, horarios, intervaloObrigatorio, meuNome, bancoResumo]);

  // Fechamento do mês
  const { data: fechamentos = [] } = useQuery({
    queryKey: ["meu-relatorio-fechamentos", mesFiltro, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("ponto_fechamentos_mensais").select("status").eq("mes", mesFiltro + "-01").eq("usuario_id", userId!);
      return data ?? [];
    },
  });
  const statusFechamento = fechamentos.length ? (fechamentos[0] as any).status : "aberto";
  const mensalComStatus = agregadoMensal.map((m) => ({ ...m, status: statusFechamento }));

  if (!userId) return <Skeleton className="h-64" />;

  // Exportações
  const handleExportDiario = (kind: "csv" | "xlsx") => {
    const list: JornadaExport[] = jornadasFiltradas.map((j) => ({
      data: j.data,
      professor: meuNome,
      entrada: j.entrada,
      intervalo_inicio: j.intervalo_inicio,
      intervalo_fim: j.intervalo_fim,
      saida: j.saida,
      minutos_trabalhados: j.minutos_trabalhados,
      minutos_previstos: previstoMinutos(horarioPara(j.data)),
      pendencias: pendenciasJornada(j, intervaloObrigatorio).join("; "),
    }));
    if (kind === "csv") return exportarDiarioCSV(list, periodoLabel);
    void (async () => {
      const ids = jornadasFiltradas.map((j) => j.id);
      let eventos: EventoExport[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from("ponto_eventos")
          .select("usuario_id, jornada_id, tipo, data_hora, latitude, longitude, dispositivo, observacao")
          .in("jornada_id", ids)
          .order("data_hora", { ascending: true });
        const jMap = new Map(jornadasFiltradas.map((j) => [j.id, j.data]));
        eventos = (data ?? []).map((e: any) => ({
          data: jMap.get(e.jornada_id) ?? "",
          professor: meuNome,
          tipo: e.tipo,
          data_hora: e.data_hora,
          latitude: e.latitude,
          longitude: e.longitude,
          dispositivo: e.dispositivo,
          observacao: e.observacao,
        }));
      }
      exportarDiarioXLSX(list, eventos, periodoLabel);
    })();
  };

  return (
    <div className="space-y-4">
      {/* Card de resumo */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${resumoPendencias > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
              <AlertTriangle className={`w-5 h-5 ${resumoPendencias > 0 ? "text-destructive" : "text-success"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendências no período</p>
              <button
                onClick={() => { if (resumoPendencias > 0) setDialogPendenciasOpen(true); }}
                className={`text-lg font-bold cursor-pointer hover:underline ${resumoPendencias > 0 ? "text-destructive" : "text-success"}`}
                disabled={resumoPendencias === 0}
                title={resumoPendencias > 0 ? "Ver detalhes das pendências" : "Sem pendências"}
              >
                {resumoPendencias}
              </button>
            </div>
          </div>
          <div className="w-px h-10 bg-border hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(mensalComStatus[0]?.saldo_minutos ?? 0) >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <Clock className={`w-5 h-5 ${(mensalComStatus[0]?.saldo_minutos ?? 0) >= 0 ? "text-success" : "text-destructive"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo no mês ({mesFiltro})</p>
              <p className={`text-lg font-bold ${(mensalComStatus[0]?.saldo_minutos ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {(mensalComStatus[0]?.saldo_minutos ?? 0) >= 0 ? "+" : "-"}
                {formatMinutes(Math.abs(mensalComStatus[0]?.saldo_minutos ?? 0))}
              </p>
              {(mensalComStatus[0]?.saldo_banco ?? 0) !== 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Jornadas: {(mensalComStatus[0]?.saldo_jornadas ?? 0) >= 0 ? "+" : "-"}{formatMinutes(Math.abs(mensalComStatus[0]?.saldo_jornadas ?? 0))}
                  {" | "}
                  Banco: {(mensalComStatus[0]?.saldo_banco ?? 0) >= 0 ? "+" : "-"}{formatMinutes(Math.abs(mensalComStatus[0]?.saldo_banco ?? 0))}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Dialog de pendências */}
      <DialogPendencias
        open={dialogPendenciasOpen}
        onOpenChange={setDialogPendenciasOpen}
        items={jornadasComPendencias}
      />

      <Tabs defaultValue="diario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diario">Diário / Período</TabsTrigger>
          <TabsTrigger value="mensal">Mensal (histórico)</TabsTrigger>
        </TabsList>

        {/* ===== DIÁRIO ===== */}
        <TabsContent value="diario" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STATUS_OPTS.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto">
                <ExportarRelatorioMenu
                  onCSV={() => handleExportDiario("csv")}
                  onXLSX={() => handleExportDiario("xlsx")}
                  disabled={!jornadasFiltradas.length}
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            {loadingJornadas ? (
              <Skeleton className="h-64" />
            ) : !jornadasFiltradas.length ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma jornada encontrada no período.</p>
            ) : (
              <DiarioTable
                jornadas={jornadasFiltradas}
                horarioPara={horarioPara}
                intervaloObrigatorio={intervaloObrigatorio}
                ausenciaPara={ausenciaPara}
              />
            )}
          </Card>

          {/* Ausências justificadas no período */}
          <AusenciasJustificadasCard inicio={inicio} fim={fim} ausenciaPara={ausenciaPara} />
        </TabsContent>

        {/* ===== MENSAL ===== */}
        <TabsContent value="mensal" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Mês</Label>
                <Input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-44" />
              </div>
              <div className="ml-auto">
                <ExportarRelatorioMenu
                  onCSV={() => exportarMensalCSV(mensalComStatus, mesFiltro)}
                  onXLSX={() => exportarMensalXLSX(mensalComStatus, mesFiltro)}
                  disabled={!mensalComStatus.length}
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            {!mensalComStatus.length ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem registros no mês selecionado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">Dias</TableHead>
                    <TableHead className="text-right">Trabalhado</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Pendências</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mensalComStatus.map((r) => (
                    <TableRow key={r.mes}>
                      <TableCell className="text-right">{r.dias_trabalhados}</TableCell>
                      <TableCell className="text-right font-semibold">{formatMinutes(r.total_minutos)}</TableCell>
                      <TableCell className="text-right">{formatMinutes(r.previsto_minutos)}</TableCell>
                      <TableCell className={`text-right ${r.saldo_minutos >= 0 ? "text-success" : "text-destructive"}`}>
                        {(r.saldo_minutos >= 0 ? "+" : "-") + formatMinutes(Math.abs(r.saldo_minutos))}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.pendencias > 0 ? <Badge variant="destructive">{r.pendencias}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "aprovado" ? "outline" : "secondary"}>
                          {r.status === "aprovado" ? "Aprovado" : "Aberto"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====== Subcomponente: tabela diária com expand de eventos (somente leitura) ======
function DiarioTable({
  jornadas,
  horarioPara,
  intervaloObrigatorio,
  ausenciaPara,
}: {
  jornadas: Jornada[];
  horarioPara: (data: string) => HorarioRow | undefined;
  intervaloObrigatorio: boolean;
  ausenciaPara: (dataStr: string) => { motivo: string; descricao?: string } | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: eventos = [] } = useQuery({
    queryKey: ["meu-relatorio-eventos", expanded],
    enabled: !!expanded,
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_eventos")
        .select("tipo, data_hora, latitude, longitude, dispositivo, observacao")
        .eq("jornada_id", expanded!)
        .order("data_hora", { ascending: true });
      return data ?? [];
    },
  });

  const justificativaBadge = (aus: { motivo: string; descricao?: string } | null) => {
    if (!aus) return null;
    const label =
      aus.motivo === "feriado"
        ? `Feriado${aus.descricao ? ": " + aus.descricao : ""}`
        : aus.motivo.charAt(0).toUpperCase() + aus.motivo.slice(1);
    return (
      <Badge variant="outline" className="text-[10px] border-info/30 bg-info/10 text-info">
        {label}
      </Badge>
    );
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[28px]"></TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Interv.</TableHead>
            <TableHead>Saída</TableHead>
            <TableHead className="text-right">Trab.</TableHead>
            <TableHead className="text-right">Prev.</TableHead>
            <TableHead>Pend.</TableHead>
            <TableHead>Justificativa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jornadas.map((j) => {
            const open = expanded === j.id;
            const prev = previstoMinutos(horarioPara(j.data));
            const pend = pendenciasJornada(j, intervaloObrigatorio);
            const aus = ausenciaPara(j.data);
            return (
              <Fragment key={j.id}>
                <TableRow>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(open ? null : j.id)}>
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {new Date(j.data + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatHora(j.entrada)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatHora(j.intervalo_inicio)}–{formatHora(j.intervalo_fim)}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatHora(j.saida)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMinutes(j.minutos_trabalhados)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatMinutes(prev)}</TableCell>
                  <TableCell>
                    {pend.length ? (
                      <Badge variant="destructive" className="text-[10px]">{pend.length}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>{justificativaBadge(aus)}</TableCell>
                </TableRow>
                {open && (
                  <TableRow key={j.id + "-exp"}>
                    <TableCell colSpan={9} className="bg-muted/30">
                      {!eventos.length ? (
                        <p className="text-sm text-muted-foreground py-2">Sem eventos registrados.</p>
                      ) : (
                        <div className="space-y-1 py-2">
                          {eventos.map((e: any, i: number) => (
                            <div key={i} className="flex flex-wrap items-center gap-3 text-sm">
                              <Badge variant="secondary" className="text-[10px] uppercase">{e.tipo}</Badge>
                              <span className="tabular-nums">{new Date(e.data_hora).toLocaleString("pt-BR")}</span>
                              {e.latitude != null && e.longitude != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-info hover:underline"
                                >
                                  <MapPin className="w-3.5 h-3.5" /> Localização
                                </a>
                              )}
                              {e.dispositivo && (
                                <span className="text-xs text-muted-foreground truncate max-w-md" title={e.dispositivo}>
                                  {e.dispositivo}
                                </span>
                              )}
                              {e.observacao && (
                                <span className="text-xs italic text-muted-foreground">"{e.observacao}"</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

// ====== Ausências justificadas no período ======
function AusenciasJustificadasCard({
  inicio,
  fim,
  ausenciaPara,
}: {
  inicio: string;
  fim: string;
  ausenciaPara: (dataStr: string) => { motivo: string; descricao?: string } | null;
}) {
  const items = useMemo(() => {
    const out: { data: string; label: string }[] = [];
    const cur = new Date(inicio + "T00:00");
    const end = new Date(fim + "T00:00");
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const aus = ausenciaPara(iso);
      if (aus) {
        const label =
          aus.motivo === "feriado"
            ? `Feriado${aus.descricao ? ": " + aus.descricao : ""}`
            : aus.motivo.charAt(0).toUpperCase() + aus.motivo.slice(1);
        out.push({ data: iso, label });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [inicio, fim, ausenciaPara]);

  if (!items.length) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">Ausências justificadas no período</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {items.map((item) => (
          <div
            key={item.data}
            className="flex items-center gap-2 rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs"
          >
            <span className="font-medium tabular-nums">
              {new Date(item.data + "T00:00").toLocaleDateString("pt-BR")}
            </span>
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ====== Dialog: lista de pendências no período ======
function DialogPendencias({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: { j: Jornada; pends: string[] }[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Pendências no período
          </DialogTitle>
          <DialogDescription>
            {items.length} jornada{items.length > 1 ? "s" : ""} com pendência{items.length > 1 ? "s" : ""} encontrada{items.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        {!items.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma pendência encontrada.</p>
        ) : (
          <div className="space-y-3">
            {items.map(({ j, pends }) => (
              <div key={j.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    {new Date(j.data + "T00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Entrada: {formatHora(j.entrada)}</span>
                    <span>•</span>
                    <span>Saída: {formatHora(j.saida)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pends.map((p) => (
                    <Badge key={p} variant="destructive" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
