import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Clock, AlertTriangle, CalendarX, ChevronUp, ChevronDown, BarChart3 } from "lucide-react";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { formatMinutes } from "@/lib/ponto";
import { cn } from "@/lib/utils";

interface Jornada {
  id: string;
  usuario_id: string;
  data: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  minutos_trabalhados: number | null;
}

interface HorarioRow {
  usuario_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  intervalo_min: number;
  ativo: boolean;
}

interface LinhaProf {
  usuario_id: string;
  nome: string;
  dias: number;
  trabalhado: number;
  previsto: number;
  saldoJornadas: number;
  banco: number;
  faltas: number;
  pendencias: number;
  status: string;
}

type SortKey = "nome" | "dias" | "trabalhado" | "previsto" | "saldo" | "banco" | "faltas" | "pendencias";

function previstoMinutos(h?: HorarioRow): number {
  if (!h || !h.ativo) return 0;
  const [hi, mi] = h.horario_inicio.slice(0, 5).split(":").map(Number);
  const [hf, mf] = h.horario_fim.slice(0, 5).split(":").map(Number);
  return Math.max(0, hf * 60 + mf - (hi * 60 + mi) - (h.intervalo_min ?? 0));
}

function pendenciasJornada(j: Jornada, intervaloObrigatorio: boolean): number {
  let n = 0;
  if (j.entrada && !j.saida) n++;
  if (intervaloObrigatorio && j.entrada && j.saida && (!j.intervalo_inicio || !j.intervalo_fim)) n++;
  return n;
}

function primeiroNome(s: string): string {
  return (s ?? "—").split(" ")[0];
}

function fmtSaldo(min: number): { txt: string; cls: string } {
  if (min === 0) return { txt: "0m", cls: "text-muted-foreground" };
  const sign = min > 0 ? "+" : "−";
  return {
    txt: `${sign}${formatMinutes(Math.abs(min))}`,
    cls: min > 0 ? "text-emerald-500" : "text-destructive",
  };
}

export default function RelatoriosEquipe() {
  const { user, loading } = useAuth();
  const hoje = new Date();
  const [mes, setMes] = useState<string>(hoje.toISOString().slice(0, 7));
  const [sortKey, setSortKey] = useState<SortKey>("trabalhado");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: isCoordAdmin, isLoading: checking } = useQuery({
    queryKey: ["relatorios-equipe-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const mesIni = mes + "-01";
  const dt = new Date(mesIni + "T00:00");
  const mesFim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: profissionais = [] } = useQuery({
    queryKey: ["relatorios-equipe-profs"],
    enabled: !!isCoordAdmin,
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
      return data ?? [];
    },
  });

  const { data: configGlobal } = useQuery({
    queryKey: ["relatorios-equipe-config"],
    enabled: !!isCoordAdmin,
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

  const { data: jornadas = [], isLoading: loadingJornadas } = useQuery({
    queryKey: ["relatorios-equipe-jornadas", mes],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_jornadas")
        .select("id, usuario_id, data, entrada, intervalo_inicio, intervalo_fim, saida, minutos_trabalhados")
        .gte("data", mesIni)
        .lte("data", mesFim);
      if (error) throw error;
      return (data ?? []) as Jornada[];
    },
  });

  const { data: horarios = [] } = useQuery({
    queryKey: ["relatorios-equipe-horarios"],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_horarios_professor")
        .select("usuario_id, dia_semana, horario_inicio, horario_fim, intervalo_min, ativo")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as HorarioRow[];
    },
  });

  const { data: feriados = [] } = useQuery({
    queryKey: ["relatorios-equipe-feriados", mes],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("ponto_feriados" as any).select("data, descricao");
      return (data ?? []) as unknown as { data: string; descricao: string }[];
    },
  });
  const feriadoSet = useMemo(() => new Set(feriados.map((f) => f.data)), [feriados]);

  const { data: ferias = [] } = useQuery({
    queryKey: ["relatorios-equipe-ferias"],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_ferias" as any)
        .select("usuario_id, data_inicio, data_fim, tipo");
      return (data ?? []) as unknown as { usuario_id: string; data_inicio: string; data_fim: string; tipo: string }[];
    },
  });

  const { data: banco = [] } = useQuery({
    queryKey: ["relatorios-equipe-banco", mes],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_banco_horas" as any)
        .select("usuario_id, minutos")
        .gte("data", mesIni)
        .lte("data", mesFim);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ usuario_id: string; minutos: number }>;
    },
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ["relatorios-equipe-fechamentos", mes],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_fechamentos_mensais")
        .select("usuario_id, status")
        .eq("mes", mesIni);
      return data ?? [];
    },
  });

  const profMap = useMemo(
    () => new Map(profissionais.map((p: any) => [p.user_id, p.full_name as string])),
    [profissionais],
  );
  const statusMap = useMemo(
    () => new Map(fechamentos.map((f: any) => [f.usuario_id, f.status as string])),
    [fechamentos],
  );
  const bancoMap = useMemo(() => {
    const m = new Map<string, number>();
    banco.forEach((l) => m.set(l.usuario_id, (m.get(l.usuario_id) ?? 0) + l.minutos));
    return m;
  }, [banco]);

  const ausenciaJustificada = (uid: string, iso: string) => {
    if (feriadoSet.has(iso)) return true;
    return ferias.some((f) => f.usuario_id === uid && iso >= f.data_inicio && iso <= f.data_fim);
  };

  const linhas: LinhaProf[] = useMemo(() => {
    const uids = new Set<string>([
      ...profissionais.map((p: any) => p.user_id as string),
      ...horarios.map((h) => h.usuario_id),
      ...jornadas.map((j) => j.usuario_id),
    ]);
    const out: LinhaProf[] = [];
    uids.forEach((uid) => {
      if (!profMap.has(uid)) return; // só profissionais ativos
      const js = jornadas.filter((j) => j.usuario_id === uid);
      const dias = js.filter((j) => j.entrada).length;
      const trabalhado = js.reduce((a, j) => a + (j.minutos_trabalhados ?? 0), 0);
      const pendJ = js.reduce((a, j) => a + pendenciasJornada(j, intervaloObrigatorio), 0);
      const jornadasSet = new Set(js.map((j) => j.data));
      let previsto = 0;
      let faltas = 0;
      const cur = new Date(mesIni + "T00:00");
      const end = new Date(mesFim + "T00:00");
      while (cur <= end) {
        const iso = cur.toISOString().slice(0, 10);
        const dow = cur.getDay();
        const h = horarios.find((x) => x.usuario_id === uid && x.dia_semana === dow);
        const prev = previstoMinutos(h);
        if (prev > 0 && !ausenciaJustificada(uid, iso)) {
          previsto += prev;
          if (!jornadasSet.has(iso)) faltas++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      out.push({
        usuario_id: uid,
        nome: profMap.get(uid) ?? "—",
        dias,
        trabalhado,
        previsto,
        saldoJornadas: trabalhado - previsto,
        banco: bancoMap.get(uid) ?? 0,
        faltas,
        pendencias: pendJ + faltas,
        status: statusMap.get(uid) ?? "aberto",
      });
    });
    return out;
  }, [jornadas, horarios, profMap, intervaloObrigatorio, bancoMap, statusMap, feriadoSet, ferias, mesIni, mesFim]);

  const linhasOrdenadas = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      switch (sortKey) {
        case "nome": va = a.nome; vb = b.nome; break;
        case "dias": va = a.dias; vb = b.dias; break;
        case "trabalhado": va = a.trabalhado; vb = b.trabalhado; break;
        case "previsto": va = a.previsto; vb = b.previsto; break;
        case "saldo": va = a.saldoJornadas; vb = b.saldoJornadas; break;
        case "banco": va = a.banco; vb = b.banco; break;
        case "faltas": va = a.faltas; vb = b.faltas; break;
        case "pendencias": va = a.pendencias; vb = b.pendencias; break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [linhas, sortKey, sortDir]);

  const kpis = useMemo(() => {
    return linhas.reduce(
      (acc, l) => {
        acc.dias += l.dias;
        acc.trabalhado += l.trabalhado;
        acc.faltas += l.faltas;
        acc.pendencias += l.pendencias;
        return acc;
      },
      { dias: 0, trabalhado: 0, faltas: 0, pendencias: 0 },
    );
  }, [linhas]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "nome" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => {
    const active = sortKey === k;
    const Icon = sortDir === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors",
          align === "right" && "w-full justify-end",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active && <Icon className="w-3 h-3" />}
      </button>
    );
  };

  if (loading || checking) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isCoordAdmin)
    return <Card className="p-10 text-center text-muted-foreground">Acesso restrito a coordenadores e administradores.</Card>;

  const maxBarra = Math.max(
    1,
    ...linhasOrdenadas.map((l) => Math.max(l.trabalhado, l.previsto)),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Relatório de Equipe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de jornadas, banco de horas, faltas e pendências por profissional.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="mes" className="text-xs">Mês</Label>
            <Input
              id="mes"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Dias trabalhados" value={kpis.dias} icon={Users} />
        <KpiCard label="Horas trabalhadas" value={formatMinutes(kpis.trabalhado)} icon={Clock} tone="success" />
        <KpiCard
          label="Pendências"
          value={kpis.pendencias}
          icon={AlertTriangle}
          tone={kpis.pendencias > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Faltas"
          value={kpis.faltas}
          icon={CalendarX}
          tone={kpis.faltas > 0 ? "danger" : "default"}
        />
      </div>

      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-display font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Trabalhado × Previsto
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Trabalhado</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted inline-block" /> Previsto</span>
          </div>
        </div>
        {loadingJornadas ? (
          <Skeleton className="h-40" />
        ) : linhasOrdenadas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem dados para o período.</p>
        ) : (
          <div className="space-y-2.5">
            {linhasOrdenadas.map((l) => (
              <div key={l.usuario_id} className="grid grid-cols-[80px_1fr] items-center gap-3">
                <span className="text-xs truncate" title={l.nome}>{primeiroNome(l.nome)}</span>
                <div className="space-y-1">
                  <div className="h-2.5 bg-muted/40 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-sm transition-all"
                      style={{ width: `${(l.trabalhado / maxBarra) * 100}%` }}
                      title={`Trabalhado: ${formatMinutes(l.trabalhado)}`}
                    />
                  </div>
                  <div className="h-2.5 bg-muted/40 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground/60 rounded-sm transition-all"
                      style={{ width: `${(l.previsto / maxBarra) * 100}%` }}
                      title={`Previsto: ${formatMinutes(l.previsto)}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader k="nome" label="Profissional" /></TableHead>
                <TableHead className="text-right"><SortHeader k="dias" label="Dias" align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader k="trabalhado" label="Trabalhadas" align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader k="previsto" label="Previstas" align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader k="saldo" label="Saldo" align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader k="banco" label="Banco" align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader k="faltas" label="Faltas" align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader k="pendencias" label="Pendências" align="right" /></TableHead>
                <TableHead>Fechamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingJornadas ? (
                <TableRow>
                  <TableCell colSpan={9}><Skeleton className="h-20" /></TableCell>
                </TableRow>
              ) : linhasOrdenadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Sem dados para o mês selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                linhasOrdenadas.map((l) => {
                  const saldo = fmtSaldo(l.saldoJornadas);
                  const bh = fmtSaldo(l.banco);
                  const aprovado = l.status === "aprovado";
                  return (
                    <TableRow key={l.usuario_id}>
                      <TableCell className="font-medium">{l.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.dias}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMinutes(l.trabalhado)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatMinutes(l.previsto)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", saldo.cls)}>{saldo.txt}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", bh.cls)}>{bh.txt}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", l.faltas > 0 && "text-destructive font-medium")}>
                        {l.faltas}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.pendencias > 0 ? (
                          <Badge variant="destructive">{l.pendencias}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={aprovado ? "default" : "outline"}>
                          {aprovado ? "Aprovado" : "Aberto"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
