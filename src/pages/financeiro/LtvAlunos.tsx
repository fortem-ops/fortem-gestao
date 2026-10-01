import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/relatorios/KpiCard";
import { TrendingUp, Wallet, Users, Receipt, Info, Search } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useLTV } from "@/hooks/useLTV";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compact = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

const FONTE_LABEL: Record<string, string> = {
  recebiveis_legado: "Recebíveis (legado)",
  box_checkin_2019: "Box check-in 2019",
};

const STATUS_CLASS: Record<string, string> = {
  ativo: "status-active",
  prospect: "status-warning",
  lead: "status-info",
};

export default function LtvAlunos() {
  const { data: roles, isLoading: loadingRoles } = useUserRoles();
  const canView = !!roles?.isCoordAdmin;
  const { data, isLoading, error } = useLTV(canView);
  const [busca, setBusca] = useState("");

  const top = useMemo(() => {
    if (!data) return [];
    const q = busca.trim().toLowerCase();
    const list = q ? data.clientes.filter((c) => c.nome.toLowerCase().includes(q)) : data.clientes;
    return list.slice(0, 50);
  }, [data, busca]);

  if (loadingRoles) return <p className="text-muted-foreground text-sm">Carregando…</p>;
  if (!canView) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-display font-semibold">LTV de Alunos</h1>
        <Badge variant="secondary">Acesso restrito a Admin/Coordenador.</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">LTV de Alunos</h1>
        <p className="text-sm text-muted-foreground">Quanto cada cliente pagou ao longo do tempo (Lifetime Value).</p>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground border-l-2 border-border pl-3">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Dados históricos de pagamentos (2019-2026) consolidados a partir do sistema de gestão anterior, para fins de análise de LTV. Os totais oficiais de receita da Fortem estão no módulo Receitas.
      </p>

      {error && <p className="text-sm text-destructive">Erro ao carregar dados: {(error as Error).message}</p>}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="LTV médio por cliente" value={data ? brl(data.ltvMedio) : "—"} icon={TrendingUp} />
        <KpiCard label="Receita histórica total" value={data ? brl(data.receitaTotal) : "—"} icon={Wallet} />
        <KpiCard label="Clientes únicos" value={data ? data.clientes.length.toLocaleString("pt-BR") : "—"} icon={Users} />
        <KpiCard label="Ticket médio anual" value={data ? brl(data.ticketMedioAnual) : "—"} icon={Receipt} hint="Média por cliente-ano" />
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Evolução da receita por ano</CardTitle></CardHeader>
        <CardContent className="h-72">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.porAno ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ano" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${compact(v)}`} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Coortes por ano de entrada</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano de entrada</TableHead>
                <TableHead className="text-right">Nº clientes</TableHead>
                <TableHead className="text-right">LTV médio da coorte</TableHead>
                <TableHead className="text-right">Ainda ativos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.coortes.map((c) => (
                <TableRow key={c.ano}>
                  <TableCell className="font-medium">{c.ano}</TableCell>
                  <TableCell className="text-right">{c.clientes}</TableCell>
                  <TableCell className="text-right">{brl(c.ltvMedio)}</TableCell>
                  <TableCell className="text-right">
                    {c.ativos}
                    <span className="text-xs text-muted-foreground"> de {c.vinculados} vinculados</span>
                  </TableCell>
                </TableRow>
              ))}
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Top 50 clientes por LTV</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">LTV total ↓</TableHead>
                <TableHead className="text-right">Anos pagando</TableHead>
                <TableHead className="text-right">Primeiro ano</TableHead>
                <TableHead className="text-right">Último ano</TableHead>
                <TableHead>Status atual</TableHead>
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((c, i) => (
                <TableRow key={c.chave}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right font-semibold">{brl(c.ltv)}</TableCell>
                  <TableCell className="text-right">{c.anos}</TableCell>
                  <TableCell className="text-right">{c.primeiroAno}</TableCell>
                  <TableCell className="text-right">{c.ultimoAno}</TableCell>
                  <TableCell>
                    {c.alunoId ? (
                      <Badge variant="outline" className={STATUS_CLASS[c.status ?? ""] ?? ""}>{c.status ?? "—"}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não vinculado</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.fontes.map((f) => FONTE_LABEL[f] ?? f).join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && top.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
              )}
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
