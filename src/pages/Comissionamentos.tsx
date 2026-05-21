import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CheckCircle2, Clock, AlertCircle, Target } from "lucide-react";
import {
  useIsCoordAdmin,
  useIsAdmin,
  useComissionamentos,
  useComissaoPendencias,
  useComissaoConfig,
  useCarteiraStats,
  useConcluirPendencia,
  useUpdateComissaoStatus,
  useUpdateConfig,
} from "@/hooks/useComissionamentos";
import {
  formatBRL,
  STATUS_LABEL,
  STATUS_COLOR,
  TIPO_LABEL,
  PENDENCIA_LABEL,
  type ComissaoStatus,
} from "@/lib/comissionamentos";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function Comissionamentos() {
  const { user } = useAuth();
  const { data: isCoordAdmin } = useIsCoordAdmin(user?.id);
  const { data: isAdmin } = useIsAdmin(user?.id);

  const [profSel, setProfSel] = useState<string>("me");
  const profissionalId = isCoordAdmin && profSel !== "todos" ? (profSel === "me" ? user?.id : profSel) : user?.id;
  const scope = isCoordAdmin && profSel === "todos" ? null : profissionalId;

  const { data: professores = [] } = useQuery({
    queryKey: ["comissao-professores"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["professor", "coordenador", "admin"]);
      if (!roles?.length) return [] as { user_id: string; full_name: string }[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      return (profs || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!isCoordAdmin,
    staleTime: 5 * 60_000,
  });

  const mesIni = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: comissoesMes = [] } = useComissionamentos({ profissionalId: scope, mesInicio: mesIni, mesFim });
  const { data: todasComissoes = [] } = useComissionamentos({ profissionalId: scope });
  const { data: pendenciasAll = [] } = useComissaoPendencias(scope);
  // Treino experimental é concluído automaticamente quando o relatório é salvo — não exibir na lista.
  const pendencias = useMemo(
    () => pendenciasAll.filter((p) => p.tipo_pendencia !== "avaliar_experimental"),
    [pendenciasAll]
  );
  const carteira = useCarteiraStats(profissionalId);

  // Mapas de profissional/aluno para a aba Histórico
  const { data: profMapData } = useQuery({
    queryKey: ["comissao-prof-map-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => (map[p.user_id] = p.full_name));
      return map;
    },
    staleTime: 5 * 60_000,
  });
  const { data: alunoMapData } = useQuery({
    queryKey: ["comissao-aluno-map-historico", todasComissoes.length],
    queryFn: async () => {
      const ids = Array.from(new Set(todasComissoes.map((r: any) => r.aluno_id).filter(Boolean)));
      const map: Record<string, string> = {};
      if (!ids.length) return map;
      const { data } = await supabase.from("alunos").select("id, nome").in("id", ids);
      (data || []).forEach((a: any) => (map[a.id] = a.nome));
      return map;
    },
    enabled: todasComissoes.length > 0,
    staleTime: 60_000,
  });
  const profMap = profMapData || {};
  const alunoMap = alunoMapData || {};

  const stats = useMemo(() => {
    const sum = (arr: any[]) => arr.reduce((s, c) => s + Number(c.valor), 0);
    return {
      mesTotal: sum(comissoesMes.filter((c) => c.status !== "cancelado")),
      pendente: sum(todasComissoes.filter((c) => ["pendente", "em_validacao", "aprovado"].includes(c.status))),
      pago: sum(todasComissoes.filter((c) => c.status === "pago")),
      conversoesMes: comissoesMes.filter((c) => c.tipo === "treino_experimental" && c.status !== "cancelado").length,
      avaliacoesMes: comissoesMes.filter((c) => c.tipo === "avaliacao_funcional" && c.status !== "cancelado").length,
    };
  }, [comissoesMes, todasComissoes]);

  const concluir = useConcluirPendencia();
  const updateStatus = useUpdateComissaoStatus();
  const { data: config = [] } = useComissaoConfig();
  const updateConfig = useUpdateConfig();

  const cfgCarteira = config.find((c) => c.tipo === "carteira_ativa");
  const meta = cfgCarteira?.meta_minima ?? 150;
  const valorCarteira = cfgCarteira?.valor ?? 5;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Comissionamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Conversões, avaliações e bonificações de carteira.</p>
        </div>
        {isCoordAdmin && (
          <Select value={profSel} onValueChange={setProfSel}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Eu (minhas comissões)</SelectItem>
              <SelectItem value="todos">Todos os profissionais</SelectItem>
              {professores.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências {pendencias.length > 0 && <Badge className="ml-2" variant="destructive">{pendencias.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
          {isCoordAdmin && <TabsTrigger value="admin">Gestão</TabsTrigger>}
          {isCoordAdmin && <TabsTrigger value="config">Configurações</TabsTrigger>}
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={DollarSign} label="Comissão do mês" value={formatBRL(stats.mesTotal)} />
            <StatCard icon={Clock} label="Pendente" value={formatBRL(stats.pendente)} tone="warning" />
            <StatCard icon={CheckCircle2} label="Paga" value={formatBRL(stats.pago)} tone="success" />
            <StatCard icon={Target} label="Conversões do mês" value={String(stats.conversoesMes)} />
            <StatCard icon={Target} label="Avaliações do mês" value={String(stats.avaliacoesMes)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meta da carteira</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {carteira.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold">{carteira.data?.meus ?? 0}</p>
                      <p className="text-sm text-muted-foreground">alunos ativos qualificados {scope ? "(você)" : "(equipe)"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Meta global: {carteira.data?.total ?? 0} / {meta}</p>
                      <p className="text-sm text-muted-foreground">Bonificação estimada: <span className="text-primary font-semibold">{formatBRL((carteira.data?.meus ?? 0) * valorCarteira)}</span></p>
                    </div>
                  </div>
                  <Progress value={Math.min(100, ((carteira.data?.total ?? 0) / meta) * 100)} />
                  {(carteira.data?.total ?? 0) < meta ? (
                    <p className="text-sm text-muted-foreground">Faltam {meta - (carteira.data?.total ?? 0)} alunos ativos para liberar a bonificação mensal.</p>
                  ) : (
                    <p className="text-sm text-emerald-500">Meta atingida — bonificação será gerada no fechamento mensal.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PENDÊNCIAS */}
        <TabsContent value="pendencias">
          <Card>
            <CardHeader><CardTitle className="text-base">Pendências em aberto</CardTitle></CardHeader>
            <CardContent>
              {pendencias.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência. 🎉</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Criado em</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pendencias.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell><Badge variant="outline">{PENDENCIA_LABEL[p.tipo_pendencia]}</Badge></TableCell>
                        <TableCell>{p.descricao}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          {p.tipo_pendencia === "avaliar_experimental" && (
                            <Button size="sm" onClick={() => concluir.mutate(p.id)} disabled={concluir.isPending}>Marcar como concluída</Button>
                          )}
                          {p.tipo_pendencia !== "avaliar_experimental" && (
                            <span className="text-xs text-muted-foreground">Conclusão automática</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de comissões</CardTitle></CardHeader>
            <CardContent>
              <ComissoesTable rows={todasComissoes} canManage={!!isCoordAdmin} onUpdate={(id, status) => updateStatus.mutate({ id, status })} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CARTEIRA */}
        <TabsContent value="carteira">
          <Card>
            <CardHeader><CardTitle className="text-base">Alunos qualificados</CardTitle></CardHeader>
            <CardContent>
              <CarteiraDetalhe profissionalId={profissionalId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADMIN */}
        {isCoordAdmin && (
          <TabsContent value="admin">
            <Card>
              <CardHeader><CardTitle className="text-base">Gestão administrativa</CardTitle></CardHeader>
              <CardContent>
                <AdminListagem isAdmin={!!isAdmin} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* CONFIG */}
        {isCoordAdmin && (
          <TabsContent value="config">
            <Card>
              <CardHeader><CardTitle className="text-base">Valores e metas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {config.map((c) => (
                  <div key={c.id} className="flex items-end gap-4 border-b border-border pb-3">
                    <div className="flex-1">
                      <p className="font-medium">{TIPO_LABEL[c.tipo]}</p>
                      <p className="text-xs text-muted-foreground">{c.tipo === "carteira_ativa" ? "Valor por aluno × meta global mínima" : "Valor por evento"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Valor (R$)</label>
                      <Input
                        type="number" step="0.01" defaultValue={c.valor}
                        className="w-28"
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== c.valor) updateConfig.mutate({ id: c.id, valor: v }); }}
                      />
                    </div>
                    {c.tipo === "carteira_ativa" && (
                      <div>
                        <label className="text-xs text-muted-foreground">Meta global</label>
                        <Input
                          type="number" defaultValue={c.meta_minima}
                          className="w-24"
                          onBlur={(e) => { const v = Number(e.target.value); if (v !== c.meta_minima) updateConfig.mutate({ id: c.id, meta_minima: v }); }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" | "warning" }) {
  const color = tone === "success" ? "text-emerald-500" : tone === "warning" ? "text-amber-500" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ComissoesTable({ rows, canManage, onUpdate }: { rows: any[]; canManage: boolean; onUpdate: (id: string, s: ComissaoStatus) => void }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sem registros.</p>;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead>{canManage && <TableHead></TableHead>}
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="text-sm">{new Date(c.data_referencia).toLocaleDateString("pt-BR")}</TableCell>
            <TableCell><Badge variant="outline">{TIPO_LABEL[c.tipo as keyof typeof TIPO_LABEL]}</Badge></TableCell>
            <TableCell className="text-sm">{c.descricao}</TableCell>
            <TableCell className="font-semibold">{formatBRL(c.valor)}</TableCell>
            <TableCell><Badge className={STATUS_COLOR[c.status as ComissaoStatus]} variant="outline">{STATUS_LABEL[c.status as ComissaoStatus]}</Badge></TableCell>
            {canManage && (
              <TableCell>
                <Select value={c.status} onValueChange={(v) => onUpdate(c.id, v as ComissaoStatus)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pendente", "em_validacao", "aprovado", "pago", "cancelado"] as ComissaoStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CarteiraDetalhe({ profissionalId }: { profissionalId?: string | null }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["carteira-detalhe", profissionalId],
    queryFn: async () => {
      let q = supabase.from("alunos").select("id, nome, status, responsavel_id").eq("status", "ativo");
      if (profissionalId) q = q.eq("responsavel_id", profissionalId);
      const { data: alunos, error } = await q;
      if (error) throw error;
      const ids = (alunos || []).map((a: any) => a.id);
      if (!ids.length) return [];
      const hoje = new Date().toISOString().slice(0, 10);
      const [{ data: planos }, { data: licencas }] = await Promise.all([
        supabase.from("planos").select("aluno_id, tipo, ativo").in("aluno_id", ids).eq("ativo", true),
        supabase.from("aluno_licencas").select("aluno_id, data_inicio, data_fim").in("aluno_id", ids).lte("data_inicio", hoje).gte("data_fim", hoje),
      ]);
      const planosByAluno = new Map<string, any[]>();
      (planos || []).forEach((p: any) => {
        const arr = planosByAluno.get(p.aluno_id) || [];
        arr.push(p);
        planosByAluno.set(p.aluno_id, arr);
      });
      const licencaSet = new Set((licencas || []).map((l: any) => l.aluno_id));
      return (alunos || []).map((a: any) => {
        const ps = planosByAluno.get(a.id) || [];
        const planoExcluido = !ps.some((p: any) => !["Gympass/Wellhub", "Total Pass"].includes(p.tipo));
        const emLicenca = licencaSet.has(a.id);
        const motivo = emLicenca ? "Em licença" : planoExcluido ? "Plano Gympass/TotalPass ou inativo" : null;
        return { ...a, qualificado: !motivo, motivo };
      });
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">Nenhum aluno ativo.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Aluno</TableHead><TableHead>Status</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((a: any) => (
          <TableRow key={a.id}>
            <TableCell>{a.nome}</TableCell>
            <TableCell>{a.qualificado ? <Badge className="bg-emerald-500/15 text-emerald-500" variant="outline">Qualificado</Badge> : <Badge variant="outline" className="bg-amber-500/15 text-amber-500">Excluído</Badge>}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{a.motivo || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AdminListagem({ isAdmin }: { isAdmin: boolean }) {
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const { data: rows = [] } = useComissionamentos(statusFiltro === "todos" ? {} : { status: [statusFiltro as ComissaoStatus] });
  const updateStatus = useUpdateComissaoStatus();
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [alunoMap, setAlunoMap] = useState<Record<string, string>>({});

  useQuery({
    queryKey: ["comissao-prof-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => (map[p.user_id] = p.full_name));
      setProfMap(map);
      return data;
    },
    staleTime: 5 * 60_000,
  });
  useQuery({
    queryKey: ["comissao-aluno-map", rows.length],
    queryFn: async () => {
      const ids = Array.from(new Set(rows.map((r: any) => r.aluno_id).filter(Boolean)));
      if (!ids.length) return [];
      const { data } = await supabase.from("alunos").select("id, nome").in("id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((a: any) => (map[a.id] = a.nome));
      setAlunoMap(map);
      return data;
    },
    enabled: rows.length > 0,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(["pendente", "em_validacao", "aprovado", "pago", "cancelado"] as ComissaoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Profissional</TableHead><TableHead>Aluno</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Ação</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell>{profMap[c.profissional_id] || c.profissional_id.slice(0, 8)}</TableCell>
              <TableCell>{c.aluno_id ? (alunoMap[c.aluno_id] || "—") : <em className="text-muted-foreground">Carteira</em>}</TableCell>
              <TableCell><Badge variant="outline">{TIPO_LABEL[c.tipo as keyof typeof TIPO_LABEL]}</Badge></TableCell>
              <TableCell className="text-sm">{new Date(c.data_referencia).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell className="font-semibold">{formatBRL(c.valor)}</TableCell>
              <TableCell><Badge className={STATUS_COLOR[c.status as ComissaoStatus]} variant="outline">{STATUS_LABEL[c.status as ComissaoStatus]}</Badge></TableCell>
              <TableCell>
                <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v as ComissaoStatus })}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pendente", "em_validacao", "aprovado", "pago", "cancelado"] as ComissaoStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
