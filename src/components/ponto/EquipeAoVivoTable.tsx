import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatHora, formatMinutes } from "@/lib/ponto";
import { AjustarJornadaDialog } from "./AjustarJornadaDialog";
import { Activity, Coffee, CheckCircle2, AlertCircle, Pencil, CalendarOff } from "lucide-react";

interface ProfessorRow {
  usuario_id: string;
  nome: string;
  jornada_id: string | null;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  minutos_trabalhados: number | null;
  status: "em_jornada" | "em_intervalo" | "encerrada" | "nao_iniciou" | "ausente_justificado";
  motivo_ausencia: string | null;
}

interface DashboardData {
  data: string;
  resumo: {
    ativos: number;
    em_intervalo: number;
    nao_iniciaram: number;
    encerradas: number;
    inconsistencias: number;
    ausencias_justificadas?: number;
  };
  professores: ProfessorRow[];
}

const STATUS_CFG: Record<ProfessorRow["status"], { label: string; cls: string; icon: typeof Activity }> = {
  em_jornada: { label: "Ativo", cls: "bg-success/15 text-success border-success/30", icon: Activity },
  em_intervalo: { label: "Intervalo", cls: "bg-warning/15 text-warning border-warning/30", icon: Coffee },
  encerrada: { label: "Encerrada", cls: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  nao_iniciou: { label: "Pendente", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertCircle },
  ausente_justificado: { label: "Ausência justificada", cls: "bg-info/15 text-info border-info/30", icon: CalendarOff },
};

const MOTIVO_LABEL: Record<string, string> = {
  feriado: "Feriado",
  ferias: "Férias",
  folga: "Folga",
  atestado: "Atestado",
  licenca: "Licença",
};

export function EquipeAoVivoTable() {
  const qc = useQueryClient();
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState("");
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [linhaSelecionada, setLinhaSelecionada] = useState<ProfessorRow | null>(null);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["ponto-equipe", data],
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc("fn_ponto_dashboard_coordenador", { _data: data });
      if (error) throw error;
      return payload as unknown as DashboardData;
    },
  });

  // Realtime: refresca quando há mudanças em ponto_eventos ou ponto_jornadas
  useEffect(() => {
    const ch = supabase
      .channel("ponto-equipe-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ponto_eventos" }, () => {
        qc.invalidateQueries({ queryKey: ["ponto-equipe"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ponto_jornadas" }, () => {
        qc.invalidateQueries({ queryKey: ["ponto-equipe"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtrados = (dashboard?.professores ?? []).filter((p) =>
    p.nome.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data</label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-44" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground block mb-1">Filtrar professor</label>
          <Input placeholder="Buscar por nome..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      {/* Cards-resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ResumoCard label="Ativos" value={dashboard?.resumo.ativos ?? 0} variant="success" />
        <ResumoCard label="Em intervalo" value={dashboard?.resumo.em_intervalo ?? 0} variant="warning" />
        <ResumoCard label="Não iniciaram" value={dashboard?.resumo.nao_iniciaram ?? 0} variant="destructive" />
        <ResumoCard label="Encerradas" value={dashboard?.resumo.encerradas ?? 0} variant="muted" />
        <ResumoCard label="Inconsistências" value={dashboard?.resumo.inconsistencias ?? 0} variant="destructive" />
      </div>

      <Card className="p-4">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !filtrados.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum professor encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => {
                const cfg = STATUS_CFG[p.status];
                const Icon = cfg.icon;
                return (
                  <TableRow key={p.usuario_id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${cfg.cls} gap-1`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatHora(p.entrada)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatHora(p.intervalo_inicio)} – {formatHora(p.intervalo_fim)}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatHora(p.saida)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMinutes(p.minutos_trabalhados)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!p.jornada_id}
                        onClick={() => { setLinhaSelecionada(p); setAjusteOpen(true); }}
                        className="gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Ajustar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AjustarJornadaDialog
        open={ajusteOpen}
        onOpenChange={setAjusteOpen}
        jornadaId={linhaSelecionada?.jornada_id ?? null}
        professorNome={linhaSelecionada?.nome ?? ""}
        data={data}
      />
    </div>
  );
}

function ResumoCard({ label, value, variant }: { label: string; value: number; variant: "success" | "warning" | "destructive" | "muted" }) {
  const cls = {
    success: "border-success/30 text-success",
    warning: "border-warning/30 text-warning",
    destructive: "border-destructive/30 text-destructive",
    muted: "border-border text-foreground",
  }[variant];
  return (
    <Card className={`p-4 border ${cls}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}
