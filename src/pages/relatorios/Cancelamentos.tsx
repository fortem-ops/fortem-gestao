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
import { XCircle, Clock, TrendingDown, Users2 } from "lucide-react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

type Row = {
  venda_id: string;
  aluno_id: string;
  aluno_nome: string;
  data_venda: string;
  data_cancelamento: string;
  dias_ate_cancelar: number | null;
  motivo_cancelamento_id: string | null;
  motivo_nome: string | null;
  motivo_slug: string | null;
  observacao_cancelamento: string | null;
  valor_final: number | null;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  plano_tipo: string | null;
};

export default function RelatoriosCancelamentos() {
  const [periodo, setPeriodo] = useState(defaultPeriodo());
  const [busca, setBusca] = useState("");
  const [motivoSel, setMotivoSel] = useState("todos");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-cancelamentos", periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_cancelamentos")
        .select("*")
        .gte("data_cancelamento", `${periodo.inicio}T00:00:00`)
        .lte("data_cancelamento", `${periodo.fim}T23:59:59`)
        .order("data_cancelamento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const motivos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.motivo_slug && r.motivo_nome) map.set(r.motivo_slug, r.motivo_nome);
    });
    return Array.from(map, ([slug, nome]) => ({ slug, nome }));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (motivoSel !== "todos" && r.motivo_slug !== motivoSel) return false;
        if (busca) {
          const b = busca.toLowerCase();
          if (
            !r.aluno_nome?.toLowerCase().includes(b) &&
            !r.vendedor_nome?.toLowerCase().includes(b) &&
            !r.motivo_nome?.toLowerCase().includes(b)
          )
            return false;
        }
        return true;
      }),
    [rows, busca, motivoSel],
  );

  const stats = useMemo(() => {
    const total = filtered.length;
    const valor = filtered.reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
    const diasArr = filtered.map((r) => r.dias_ate_cancelar ?? 0).filter((n) => n > 0);
    const tmedio = diasArr.length ? Math.round(diasArr.reduce((s, n) => s + n, 0) / diasArr.length) : 0;
    const precoces = filtered.filter((r) => (r.dias_ate_cancelar ?? 999) <= 30).length;
    return { total, valor, tmedio, precoces };
  }, [filtered]);

  const porMotivo = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    filtered.forEach((r) => {
      const key = r.motivo_slug ?? "sem-motivo";
      const nome = r.motivo_nome ?? "Sem motivo";
      const cur = map.get(key) ?? { nome, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(r.valor_final ?? 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [filtered]);

  const maxQtd = Math.max(1, ...porMotivo.map((m) => m.qtd));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodoFilter value={periodo} onChange={setPeriodo} />
        <ExportMenu
          filename="cancelamentos"
          rows={filtered.map((r) => ({
            aluno: r.aluno_nome,
            plano: r.plano_tipo,
            data_venda: fmtData(r.data_venda),
            data_cancelamento: fmtData(r.data_cancelamento),
            dias_ate_cancelar: r.dias_ate_cancelar,
            motivo: r.motivo_nome,
            observacao: r.observacao_cancelamento,
            vendedor: r.vendedor_nome,
            valor: r.valor_final,
          }))}
          columns={[
            { key: "aluno", label: "Aluno" },
            { key: "plano", label: "Plano" },
            { key: "data_venda", label: "Início" },
            { key: "data_cancelamento", label: "Cancelado em" },
            { key: "dias_ate_cancelar", label: "Dias" },
            { key: "motivo", label: "Motivo" },
            { key: "observacao", label: "Observação" },
            { key: "vendedor", label: "Vendedor" },
            { key: "valor", label: "Valor" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Cancelamentos" value={stats.total} icon={XCircle} tone="danger" />
        <KpiCard label="Receita perdida" value={brl(stats.valor)} icon={TrendingDown} tone="danger" />
        <KpiCard label="Tempo médio" value={`${stats.tmedio}d`} icon={Clock} hint="Da venda ao cancelamento" />
        <KpiCard
          label="Cancel. precoces"
          value={stats.precoces}
          icon={Users2}
          tone="warning"
          hint="≤ 30 dias após contratar"
        />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Distribuição por motivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {porMotivo.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
          {porMotivo.map((m) => (
            <div key={m.nome} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{m.nome}</span>
                <span className="text-muted-foreground">
                  {m.qtd} ({brl(m.valor)})
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${(m.qtd / maxQtd) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Detalhamento</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Buscar aluno, vendedor, motivo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-64"
            />
            <Select value={motivoSel} onValueChange={setMotivoSel}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os motivos</SelectItem>
                {motivos.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    {m.nome}
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
                <TableHead>Aluno</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Cancelado em</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
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
                    Nenhum cancelamento no período.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.venda_id}>
                  <TableCell className="font-medium">{r.aluno_nome}</TableCell>
                  <TableCell>{r.plano_tipo ?? "—"}</TableCell>
                  <TableCell>{fmtData(r.data_venda)}</TableCell>
                  <TableCell>{fmtData(r.data_cancelamento)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={(r.dias_ate_cancelar ?? 0) <= 30 ? "destructive" : "secondary"}
                    >
                      {r.dias_ate_cancelar ?? "—"}d
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{r.motivo_nome ?? "—"}</span>
                      {r.observacao_cancelamento && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {r.observacao_cancelamento}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{r.vendedor_nome ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(Number(r.valor_final ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
