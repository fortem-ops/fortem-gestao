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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, ChevronDown, ChevronRight, MapPin, Pencil } from "lucide-react";
import { Navigate } from "react-router-dom";
import { formatHora, formatMinutes } from "@/lib/ponto";
import { AjustarJornadaDialog } from "@/components/ponto/AjustarJornadaDialog";
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

export default function RelatorioPonto() {
  const { user, loading } = useAuth();

  const { data: isCoordAdmin, isLoading: checking } = useQuery({
    queryKey: ["relatorio-ponto-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  // Filtros
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [inicio, setInicio] = useState<string>(primeiroDiaMes);
  const [fim, setFim] = useState<string>(ultimoDiaMes);
  const [profId, setProfId] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [mesFiltro, setMesFiltro] = useState<string>(hoje.toISOString().slice(0, 7));

  const { data: profissionais = [] } = useQuery({
    queryKey: ["relatorio-profs"],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids).order("full_name");
      return data ?? [];
    },
  });

  const profMap = useMemo(
    () => new Map(profissionais.map((p: any) => [p.user_id, p.full_name])),
    [profissionais],
  );

  // Config global para saber se intervalo é obrigatório
  const { data: configGlobal } = useQuery({
    queryKey: ["relatorio-config-global"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_configuracoes")
        .select("intervalo_obrigatorio")
        .is("usuario_id", null)
        .maybeSingle();
      return data;
    },
  });
  const intervaloObrigatorio = !!configGlobal?.intervalo_obrigatorio;

  // Jornadas no período
  const { data: jornadas = [], isLoading: loadingJornadas } = useQuery({
    queryKey: ["relatorio-jornadas", inicio, fim, profId],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      let q = supabase
        .from("ponto_jornadas")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false });
      if (profId !== "todos") q = q.eq("usuario_id", profId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Jornada[];
    },
  });

  // Horários cadastrados (para "previsto")
  const { data: horarios = [] } = useQuery({
    queryKey: ["relatorio-horarios", profId],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      let q = supabase.from("ponto_horarios_professor").select("*").eq("ativo", true);
      if (profId !== "todos") q = q.eq("usuario_id", profId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as HorarioRow[];
    },
  });

  // Feriados (cobre todas as datas relevantes — dois períodos)
  const { data: feriados = [] } = useQuery({
    queryKey: ["relatorio-feriados", inicio, fim, mesFiltro],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("ponto_feriados" as any).select("data, descricao");
      return (data ?? []) as unknown as { data: string; descricao: string }[];
    },
  });
  const feriadoMap = useMemo(() => new Map(feriados.map((f) => [f.data, f.descricao])), [feriados]);

  // Férias / folgas
  const { data: ferias = [] } = useQuery({
    queryKey: ["relatorio-ferias", profId],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      let q = supabase.from("ponto_ferias" as any).select("usuario_id, data_inicio, data_fim, tipo");
      if (profId !== "todos") q = q.eq("usuario_id", profId);
      const { data } = await q;
      return (data ?? []) as unknown as { usuario_id: string; data_inicio: string; data_fim: string; tipo: string }[];
    },
  });

  const ausenciaPara = (uid: string, dataStr: string): { motivo: string; descricao?: string } | null => {
    if (feriadoMap.has(dataStr)) return { motivo: "feriado", descricao: feriadoMap.get(dataStr) };
    const f = ferias.find((x) => x.usuario_id === uid && dataStr >= x.data_inicio && dataStr <= x.data_fim);
    if (f) return { motivo: f.tipo };
    return null;
  };

  const horarioPara = (uid: string, dataStr: string): HorarioRow | undefined => {
    const dow = new Date(dataStr + "T00:00").getDay();
    return horarios.find((h) => h.usuario_id === uid && h.dia_semana === dow);
  };

  // Aplicar filtro de status
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

  // Agregação mensal
  const agregadoMensal: MensalExport[] = useMemo(() => {
    const mesIni = mesFiltro + "-01";
    const dt = new Date(mesIni + "T00:00");
    const ultimo = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
    const dentroMes = jornadas.filter((j) => j.data >= mesIni && j.data <= ultimo);
    const porUser = new Map<string, { dias: number; total: number; pend: number }>();
    dentroMes.forEach((j) => {
      const r = porUser.get(j.usuario_id) ?? { dias: 0, total: 0, pend: 0 };
      if (j.entrada) r.dias += 1;
      r.total += j.minutos_trabalhados ?? 0;
      r.pend += pendenciasJornada(j, intervaloObrigatorio).length;
      porUser.set(j.usuario_id, r);
    });
    // previsto = soma das janelas previstas dos dias do mês para cada user
    const out: MensalExport[] = [];
    porUser.forEach((agg, uid) => {
      let previsto = 0;
      const cur = new Date(mesIni + "T00:00");
      const end = new Date(ultimo + "T00:00");
      while (cur <= end) {
        const dow = cur.getDay();
        const h = horarios.find((x) => x.usuario_id === uid && x.dia_semana === dow);
        previsto += previstoMinutos(h);
        cur.setDate(cur.getDate() + 1);
      }
      out.push({
        mes: mesFiltro,
        professor: (profMap.get(uid) as string) ?? "—",
        dias_trabalhados: agg.dias,
        total_minutos: agg.total,
        previsto_minutos: previsto,
        saldo_minutos: agg.total - previsto,
        pendencias: agg.pend,
        status: "—",
      });
    });
    return out.sort((a, b) => a.professor.localeCompare(b.professor));
  }, [jornadas, mesFiltro, horarios, profMap, intervaloObrigatorio]);

  // Buscar status de fechamentos do mês selecionado
  const { data: fechamentos = [] } = useQuery({
    queryKey: ["relatorio-fechamentos", mesFiltro],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_fechamentos_mensais")
        .select("usuario_id, status")
        .eq("mes", mesFiltro + "-01");
      return data ?? [];
    },
  });
  const statusMap = new Map(fechamentos.map((f: any) => [f.usuario_id, f.status]));
  const mensalComStatus = agregadoMensal.map((m) => ({
    ...m,
    status: (statusMap.get(profissionais.find((p: any) => p.full_name === m.professor)?.user_id ?? "") as string) ?? "aberto",
  }));

  if (loading || checking) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isCoordAdmin) return <Card className="p-10 text-center text-muted-foreground">Acesso restrito a coordenadores e administradores.</Card>;

  // Exportações
  const handleExportDiario = (kind: "csv" | "xlsx") => {
    const list: JornadaExport[] = jornadasFiltradas.map((j) => ({
      data: j.data,
      professor: (profMap.get(j.usuario_id) as string) ?? "—",
      entrada: j.entrada,
      intervalo_inicio: j.intervalo_inicio,
      intervalo_fim: j.intervalo_fim,
      saida: j.saida,
      minutos_trabalhados: j.minutos_trabalhados,
      minutos_previstos: previstoMinutos(horarioPara(j.usuario_id, j.data)),
      pendencias: pendenciasJornada(j, intervaloObrigatorio).join("; "),
    }));
    if (kind === "csv") return exportarDiarioCSV(list, periodoLabel);
    // XLSX precisa também de eventos — busca sob demanda
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
          professor: (profMap.get(e.usuario_id) as string) ?? "—",
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
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Relatório de Ponto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize, ajuste e exporte os registros de jornada — visão diária ou consolidado mensal.
        </p>
      </header>

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
                <Label className="text-xs">Profissional</Label>
                <Select value={profId} onValueChange={setProfId}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {profissionais.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                profMap={profMap}
                horarioPara={horarioPara}
                intervaloObrigatorio={intervaloObrigatorio}
              />
            )}
          </Card>
        </TabsContent>

        {/* ===== MENSAL ===== */}
        <TabsContent value="mensal" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Mês</Label>
                <Input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label className="text-xs">Profissional</Label>
                <Select value={profId} onValueChange={setProfId}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {profissionais.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <TableHead>Profissional</TableHead>
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
                    <TableRow key={r.professor}>
                      <TableCell className="font-medium">{r.professor}</TableCell>
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

// ====== Subcomponente: tabela diária com expand de eventos e ajuste ======
function DiarioTable({
  jornadas,
  profMap,
  horarioPara,
  intervaloObrigatorio,
}: {
  jornadas: Jornada[];
  profMap: Map<string, string>;
  horarioPara: (uid: string, data: string) => HorarioRow | undefined;
  intervaloObrigatorio: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteAlvo, setAjusteAlvo] = useState<{ id: string; nome: string; data: string } | null>(null);

  const { data: eventos = [] } = useQuery({
    queryKey: ["relatorio-eventos", expanded],
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[28px]"></TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Profissional</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Interv.</TableHead>
            <TableHead>Saída</TableHead>
            <TableHead className="text-right">Trab.</TableHead>
            <TableHead className="text-right">Prev.</TableHead>
            <TableHead>Pend.</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jornadas.map((j) => {
            const open = expanded === j.id;
            const prev = previstoMinutos(horarioPara(j.usuario_id, j.data));
            const pend = pendenciasJornada(j, intervaloObrigatorio);
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
                  <TableCell>{profMap.get(j.usuario_id) ?? "—"}</TableCell>
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        setAjusteAlvo({ id: j.id, nome: profMap.get(j.usuario_id) ?? "—", data: j.data });
                        setAjusteOpen(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Ajustar
                    </Button>
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow key={j.id + "-exp"}>
                    <TableCell colSpan={10} className="bg-muted/30">
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

      <AjustarJornadaDialog
        open={ajusteOpen}
        onOpenChange={setAjusteOpen}
        jornadaId={ajusteAlvo?.id ?? null}
        professorNome={ajusteAlvo?.nome ?? ""}
        data={ajusteAlvo?.data ?? ""}
      />
    </>
  );
}
