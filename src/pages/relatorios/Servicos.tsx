import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { PeriodoFilter, defaultPeriodo } from "@/components/relatorios/PeriodoFilter";
import { Activity, CalendarCheck, CheckCircle2, Users2 } from "lucide-react";

type Row = {
  agenda_id: string;
  tipo: string;
  atividade: string;
  local: string | null;
  dia_semana: number | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  data_especifica: string | null;
  profissional_id: string | null;
  profissional_nome: string | null;
  aluno_id: string | null;
  aluno_nome: string | null;
  comparecimento: boolean;
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtData = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const fmtHora = (h: string | null) => (h ? h.slice(0, 5) : "—");

export default function RelatoriosServicos() {
  const [periodo, setPeriodo] = useState(defaultPeriodo());
  const [busca, setBusca] = useState("");
  const [tipoSel, setTipoSel] = useState("todos");
  const [atividadeSel, setAtividadeSel] = useState("todas");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-servicos", periodo],
    queryFn: async () => {
      // Avulsos no período + todos os fixos
      const { data, error } = await supabase.from("v_servicos_agenda").select("*");
      if (error) throw error;
      return (data ?? []).filter((r: Row) => {
        if (r.tipo === "avulso") {
          if (!r.data_especifica) return false;
          return r.data_especifica >= periodo.inicio && r.data_especifica <= periodo.fim;
        }
        return true;
      }) as Row[];
    },
  });

  const atividades = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.atividade && s.add(r.atividade));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (tipoSel !== "todos" && r.tipo !== tipoSel) return false;
        if (atividadeSel !== "todas" && r.atividade !== atividadeSel) return false;
        if (busca) {
          const b = busca.toLowerCase();
          if (
            !r.atividade?.toLowerCase().includes(b) &&
            !r.profissional_nome?.toLowerCase().includes(b) &&
            !r.aluno_nome?.toLowerCase().includes(b) &&
            !r.local?.toLowerCase().includes(b)
          )
            return false;
        }
        return true;
      }),
    [rows, busca, tipoSel, atividadeSel],
  );

  const stats = useMemo(() => {
    const total = filtered.length;
    const fixos = filtered.filter((r) => r.tipo === "fixo").length;
    const avulsos = filtered.filter((r) => r.tipo === "avulso").length;
    const compareceram = filtered.filter((r) => r.comparecimento).length;
    const taxa = total ? Math.round((compareceram / total) * 100) : 0;
    return { total, fixos, avulsos, taxa };
  }, [filtered]);

  const porAtividade = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => map.set(r.atividade, (map.get(r.atividade) ?? 0) + 1));
    return Array.from(map, ([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [filtered]);

  const porProfissional = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number }>();
    filtered.forEach((r) => {
      const key = r.profissional_id ?? "sem";
      const nome = r.profissional_nome ?? "Sem profissional";
      const cur = map.get(key) ?? { nome, qtd: 0 };
      cur.qtd += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [filtered]);

  const maxAt = Math.max(1, ...porAtividade.map((m) => m.qtd));
  const maxPr = Math.max(1, ...porProfissional.map((m) => m.qtd));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodoFilter value={periodo} onChange={setPeriodo} />
        <ExportMenu
          filename="servicos"
          rows={filtered.map((r) => ({
            tipo: r.tipo,
            atividade: r.atividade,
            local: r.local,
            data: r.tipo === "avulso" ? fmtData(r.data_especifica) : DIAS[r.dia_semana ?? 0],
            horario: `${fmtHora(r.horario_inicio)}–${fmtHora(r.horario_fim)}`,
            profissional: r.profissional_nome,
            aluno: r.aluno_nome,
            comparecimento: r.comparecimento ? "Sim" : "Não",
          }))}
          columns={[
            { key: "tipo", label: "Tipo" },
            { key: "atividade", label: "Atividade" },
            { key: "local", label: "Local" },
            { key: "data", label: "Data/Dia" },
            { key: "horario", label: "Horário" },
            { key: "profissional", label: "Profissional" },
            { key: "aluno", label: "Aluno" },
            { key: "comparecimento", label: "Compareceu" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Agendamentos" value={stats.total} icon={CalendarCheck} />
        <KpiCard label="Fixos" value={stats.fixos} icon={Activity} tone="success" />
        <KpiCard label="Avulsos" value={stats.avulsos} icon={Users2} hint="No período filtrado" />
        <KpiCard
          label="Taxa comparecimento"
          value={`${stats.taxa}%`}
          icon={CheckCircle2}
          tone={stats.taxa >= 70 ? "success" : stats.taxa >= 40 ? "warning" : "danger"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Por atividade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {porAtividade.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {porAtividade.map((m) => (
              <div key={m.nome} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.nome}</span>
                  <span className="text-muted-foreground">{m.qtd}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(m.qtd / maxAt) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Por profissional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {porProfissional.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {porProfissional.map((m) => (
              <div key={m.nome} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.nome}</span>
                  <span className="text-muted-foreground">{m.qtd}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(m.qtd / maxPr) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Detalhamento</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Buscar atividade, profissional, aluno..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-64"
            />
            <Select value={tipoSel} onValueChange={setTipoSel}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="fixo">Fixos</SelectItem>
                <SelectItem value="avulso">Avulsos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={atividadeSel} onValueChange={setAtividadeSel}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Atividade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas atividades</SelectItem>
                {atividades.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Data/Dia</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Compareceu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhum serviço encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.agenda_id}>
                  <TableCell>
                    <Badge variant={r.tipo === "fixo" ? "secondary" : "outline"}>{r.tipo}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.atividade}</TableCell>
                  <TableCell>{r.local ?? "—"}</TableCell>
                  <TableCell>
                    {r.tipo === "avulso" ? fmtData(r.data_especifica) : DIAS[r.dia_semana ?? 0]}
                  </TableCell>
                  <TableCell>
                    {fmtHora(r.horario_inicio)}–{fmtHora(r.horario_fim)}
                  </TableCell>
                  <TableCell>{r.profissional_nome ?? "—"}</TableCell>
                  <TableCell>{r.aluno_nome ?? "—"}</TableCell>
                  <TableCell>
                    {r.comparecimento ? (
                      <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
