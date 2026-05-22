import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { ClipboardList, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PlanoRow = {
  plano_id: string;
  aluno_id: string;
  aluno_nome: string;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  duracao_meses: number | null;
  valor: number | null;
  ativo: boolean;
  renovacao_automatica: boolean;
  proxima_renovacao: string | null;
  situacao: string;
  dias_no_plano: number | null;
};

export default function RelatoriosPlanos() {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [situacao, setSituacao] = useState<string>("ativo");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rel-planos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_planos_base")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanoRow[];
    },
  });

  const tipos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.tipo && s.add(r.tipo));
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (situacao !== "todos" && r.situacao !== situacao) return false;
      if (tipo !== "todos" && r.tipo !== tipo) return false;
      if (q && !r.aluno_nome?.toLowerCase().includes(q) && !r.tipo?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, busca, tipo, situacao]);

  const stats = useMemo(() => {
    const ativos = rows.filter((r) => r.situacao === "ativo");
    const valorAtivo = ativos.reduce((s, r) => s + Number(r.valor || 0), 0);
    const ticket = ativos.length ? valorAtivo / ativos.length : 0;
    const autoRenov = ativos.filter((r) => r.renovacao_automatica).length;

    const hoje = new Date();
    const proximos = ativos.filter((r) => {
      if (!r.data_fim) return false;
      const fim = new Date(r.data_fim);
      const diff = (fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length;

    return { ativosCount: ativos.length, valorAtivo, ticket, autoRenov, proximos };
  }, [rows]);

  const porTipo = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    rows.forEach((r) => {
      if (r.situacao !== "ativo") return;
      const key = r.tipo || "—";
      const cur = map.get(key) ?? { nome: key, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(r.valor || 0);
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.qtd - a.qtd);
  }, [rows]);

  const totalAtivos = stats.ativosCount || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <Input placeholder="Buscar aluno ou tipo…" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-9" />
          </div>
          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ExportMenu
          filename={`planos-${situacao}`}
          rows={filtered as any[]}
          columns={[
            { key: "aluno_nome", label: "Aluno" },
            { key: "tipo", label: "Tipo" },
            { key: "data_inicio", label: "Início" },
            { key: "data_fim", label: "Fim" },
            { key: "valor", label: "Valor" },
            { key: "situacao", label: "Situação" },
            { key: "renovacao_automatica", label: "Renov. auto" },
            { key: "proxima_renovacao", label: "Próx. renovação" },
            { key: "dias_no_plano", label: "Dias" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Planos ativos" value={stats.ativosCount} icon={CheckCircle2} tone="success" />
        <KpiCard label="MRR (base ativa)" value={brl(stats.valorAtivo)} icon={ClipboardList} />
        <KpiCard label="Ticket médio" value={brl(stats.ticket)} icon={ClipboardList} />
        <KpiCard label="Renov. automática" value={stats.autoRenov} icon={RefreshCw} />
        <KpiCard label="Vencendo 30d" value={stats.proximos} icon={AlertTriangle} tone="warning" />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Distribuição por tipo (ativos)</CardTitle></CardHeader>
        <CardContent>
          {porTipo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem planos ativos.</p>
          ) : (
            <div className="space-y-2">
              {porTipo.map((p) => {
                const pct = (p.qtd / totalAtivos) * 100;
                return (
                  <div key={p.nome}>
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{p.nome}</span>
                      <span className="text-muted-foreground">{p.qtd} • {brl(p.valor)} • {pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded mt-1 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Detalhamento ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Renov.</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 300).map((r) => (
                    <TableRow key={r.plano_id}>
                      <TableCell className="font-medium">{r.aluno_nome}</TableCell>
                      <TableCell className="capitalize">{r.tipo}</TableCell>
                      <TableCell>{r.data_inicio ? new Date(r.data_inicio).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell>{r.data_fim ? new Date(r.data_fim).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">{brl(Number(r.valor || 0))}</TableCell>
                      <TableCell>
                        {r.renovacao_automatica ? <Badge variant="secondary">Auto</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.situacao === "ativo" ? "default" : "secondary"}>{r.situacao}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum plano encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
