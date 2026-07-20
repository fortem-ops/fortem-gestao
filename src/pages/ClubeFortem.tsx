import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, CloudRain, Users, Gift, Trophy, Sparkles, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClubeFortem() {
  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Star className="w-6 h-6 text-primary" /> Clube FORTEM — Fidelidade
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pontos, níveis, badges e recompensas.
        </p>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-secondary/50 flex-wrap h-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="pontuacao">Pontuação</TabsTrigger>
          <TabsTrigger value="resgates">Resgates</TabsTrigger>
          <TabsTrigger value="recompensas">Recompensas</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6"><OverviewTab /></TabsContent>
        <TabsContent value="pontuacao" className="pt-6"><PontuacaoTab /></TabsContent>
        <TabsContent value="resgates" className="pt-6"><ResgatesTab /></TabsContent>
        <TabsContent value="recompensas" className="pt-6"><RecompensasTab /></TabsContent>
        <TabsContent value="ranking" className="pt-6"><RankingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── VISÃO GERAL ─── */
function OverviewTab() {
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["clube-fortem-overview"],
    queryFn: async () => {
      const [pontos, hist, resgates, clima, top] = await Promise.all([
        supabase.from("clube_pontos").select("aluno_id", { count: "exact", head: true }),
        supabase.from("clube_historico").select("pontos_final")
          .gte("created_at", `${hoje}T00:00:00`).gt("pontos_final", 0),
        supabase.from("clube_resgates").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("clube_clima_cache").select("*").eq("data", hoje).maybeSingle(),
        supabase.from("clube_pontos").select("aluno_id, saldo, nivel, alunos!inner(nome)")
          .order("saldo", { ascending: false }).limit(5),
      ]);
      const pontosHoje = (hist.data || []).reduce((s, r: any) => s + (r.pontos_final || 0), 0);
      return {
        totalAlunos: pontos.count ?? 0,
        pontosHoje,
        resgatesPendentes: resgates.count ?? 0,
        clima: clima.data,
        top: top.data as any[],
      };
    },
  });

  const testarClima = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-clube-clima");
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Clima atualizado"),
    onError: (e: any) => toast.error("Falha ao consultar clima", { description: e.message }),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Users} label="Alunos no clube" value={stats?.totalAlunos ?? 0} accent="text-blue-500" />
        <KPI icon={Sparkles} label="Pontos hoje" value={stats?.pontosHoje ?? 0} accent="text-emerald-500" />
        <KPI icon={Gift} label="Resgates pendentes" value={stats?.resgatesPendentes ?? 0} accent="text-amber-500" />
        <KPI
          icon={CloudRain}
          label="Multiplicador clima"
          value={stats?.clima?.multiplicador_ativo ? "ATIVO" : "—"}
          accent={stats?.clima?.multiplicador_ativo ? "text-rose-500" : "text-muted-foreground"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CloudRain className="w-4 h-4" /> Clima hoje
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => testarClima.mutate()} disabled={testarClima.isPending}>
            Atualizar agora
          </Button>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {stats?.clima ? (
            <>
              <p>Temperatura: {stats.clima.temperatura_min}°C – {stats.clima.temperatura_max}°C</p>
              <p>Precipitação: {stats.clima.precipitacao_mm}mm</p>
              <p>
                Multiplicador:{" "}
                <Badge variant={stats.clima.multiplicador_ativo ? "default" : "secondary"}>
                  {stats.clima.multiplicador_ativo ? stats.clima.motivo : "Inativo"}
                </Badge>
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Ainda sem dados climáticos para hoje.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Top 5 saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats?.top?.length ? stats.top.map((r, i) => (
            <div key={r.aluno_id} className="flex justify-between text-sm">
              <span>#{i + 1} {r.alunos?.nome}</span>
              <span className="flex items-center gap-2">
                <Badge variant="outline">{r.nivel}</Badge>
                <strong>{r.saldo} pts</strong>
              </span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-7 h-7 ${accent}`} />
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/* ─── PONTUAÇÃO ─── */
function PontuacaoTab() {
  const qc = useQueryClient();
  const { data: regras } = useQuery({
    queryKey: ["clube-regras"],
    queryFn: async () => {
      const { data } = await supabase.from("clube_regras_pontuacao").select("*").order("label");
      return data || [];
    },
  });
  const { data: configs } = useQuery({
    queryKey: ["clube-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("clube_config").select("*").order("chave");
      return data || [];
    },
  });

  const salvarRegra = useMutation({
    mutationFn: async (r: any) => {
      const { error } = await supabase.from("clube_regras_pontuacao")
        .update({ pontos: r.pontos, ativo: r.ativo }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regra atualizada"); qc.invalidateQueries({ queryKey: ["clube-regras"] }); },
  });

  const salvarConfig = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase.from("clube_config").update({ valor: c.valor }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["clube-configs"] }); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Regras de pontuação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {regras?.map((r: any) => (
            <RegraRow key={r.id} regra={r} onSave={salvarRegra.mutate} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {configs?.map((c: any) => (
            <ConfigRow key={c.id} cfg={c} onSave={salvarConfig.mutate} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RegraRow({ regra, onSave }: any) {
  const [pontos, setPontos] = useState(regra.pontos);
  const [ativo, setAtivo] = useState(regra.ativo);
  const dirty = pontos !== regra.pontos || ativo !== regra.ativo;
  return (
    <div className="flex items-center gap-3 border border-border rounded-md p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{regra.label}</p>
        <p className="text-xs text-muted-foreground">{regra.acao}{regra.unica_vez ? " · única vez" : ""}</p>
      </div>
      <Input type="number" value={pontos} onChange={(e) => setPontos(parseInt(e.target.value) || 0)} className="w-24" />
      <Switch checked={ativo} onCheckedChange={setAtivo} />
      <Button size="sm" disabled={!dirty} onClick={() => onSave({ ...regra, pontos, ativo })}>
        <Check className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ConfigRow({ cfg, onSave }: any) {
  const [valor, setValor] = useState(cfg.valor);
  const dirty = valor !== cfg.valor;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{cfg.chave}</p>
        <p className="text-[11px] text-muted-foreground">{cfg.descricao}</p>
      </div>
      <Input value={valor} onChange={(e) => setValor(e.target.value)} className="w-48" />
      <Button size="sm" disabled={!dirty} onClick={() => onSave({ ...cfg, valor })}>
        <Check className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ─── RESGATES ─── */
function ResgatesTab() {
  const qc = useQueryClient();
  const { data: resgates, isLoading } = useQuery({
    queryKey: ["clube-resgates"],
    queryFn: async () => {
      const { data } = await supabase.from("clube_resgates")
        .select("*, alunos(nome), clube_recompensas(nome, icone)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const { error } = await supabase.from("clube_resgates").update({
        status,
        aprovado_em: status === "aprovado" ? new Date().toISOString() : undefined,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resgate atualizado"); qc.invalidateQueries({ queryKey: ["clube-resgates"] }); },
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      {resgates?.map((r: any) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-2xl">{r.clube_recompensas?.icone || "🎁"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{r.alunos?.nome} → {r.clube_recompensas?.nome}</p>
              <p className="text-xs text-muted-foreground">
                {r.pontos_utilizados} pts · {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            </div>
            <Badge variant={r.status === "pendente" ? "secondary" : r.status === "cancelado" ? "destructive" : "default"}>
              {r.status}
            </Badge>
            {r.status === "pendente" && (
              <>
                <Button size="sm" onClick={() => mudarStatus.mutate({ id: r.id, status: "aprovado" })}>Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => mudarStatus.mutate({ id: r.id, status: "cancelado" })}>Cancelar</Button>
              </>
            )}
            {r.status === "aprovado" && (
              <Button size="sm" onClick={() => mudarStatus.mutate({ id: r.id, status: "entregue" })}>Marcar entregue</Button>
            )}
          </CardContent>
        </Card>
      ))}
      {!resgates?.length && <p className="text-sm text-muted-foreground text-center py-10">Sem resgates.</p>}
    </div>
  );
}

/* ─── RECOMPENSAS ─── */
function RecompensasTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const { data: recompensas } = useQuery({
    queryKey: ["clube-recompensas-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("clube_recompensas").select("*").order("custo_pontos");
      return data || [];
    },
  });

  const salvar = useMutation({
    mutationFn: async (r: any) => {
      const payload = {
        nome: r.nome, descricao: r.descricao, custo_pontos: r.custo_pontos,
        tipo: r.tipo, icone: r.icone, ativo: r.ativo,
        custo_start: r.custo_start ?? null,
        custo_start_plus: r.custo_start_plus ?? null,
        custo_power: r.custo_power ?? null,
        custo_pro: r.custo_pro ?? null,
        custo_max: r.custo_max ?? null,
        planos_elegiveis: r.planos_elegiveis ?? ['start','start_plus','power','pro','max'],
      };
      if (r.id) {
        const { error } = await supabase.from("clube_recompensas").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clube_recompensas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["clube-recompensas-admin"] }); setOpen(false); },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clube_recompensas").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Desativado"); qc.invalidateQueries({ queryKey: ["clube-recompensas-admin"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing({ nome: "", descricao: "", custo_pontos: 100, tipo: "manual", icone: "🎁", ativo: true }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova recompensa
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recompensas?.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-2xl">{r.icone}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{r.descricao}</p>
                <p className="text-xs mt-1">
                  <Badge variant="outline">{r.custo_pontos} pts</Badge>{" "}
                  <Badge variant="secondary">{r.tipo}</Badge>{" "}
                  {!r.ativo && <Badge variant="destructive">inativo</Badge>}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remover.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} recompensa</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Ícone</Label><Input value={editing.icone ?? "🎁"} onChange={(e) => setEditing({ ...editing, icone: e.target.value })} /></div>
                <div><Label>Custo (pts)</Label><Input type="number" value={editing.custo_pontos} onChange={(e) => setEditing({ ...editing, custo_pontos: parseInt(e.target.value) || 0 })} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={editing.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatico">Automático</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                <span className="text-sm">Ativo</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── RANKING ─── */
function RankingTab() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<"mensal" | "trimestral" | "semestral" | "anual">("mensal");
  const [ajuste, setAjuste] = useState<{ aluno_id: string; nome: string } | null>(null);
  const [pontos, setPontos] = useState(0);
  const [motivo, setMotivo] = useState("");

  const referencia = calcReferencia(periodo);

  const { data: ranking } = useQuery({
    queryKey: ["clube-ranking-view", periodo, referencia],
    queryFn: async () => {
      // On-the-fly ranking from historico
      const inicio = calcInicioPeriodo(periodo);
      const { data } = await supabase.from("clube_historico")
        .select("aluno_id, pontos_final, alunos!inner(nome)")
        .gte("created_at", inicio)
        .gt("pontos_final", 0);
      const agrupado = new Map<string, { nome: string; pontos: number }>();
      (data || []).forEach((r: any) => {
        const cur = agrupado.get(r.aluno_id) || { nome: r.alunos?.nome ?? "—", pontos: 0 };
        cur.pontos += r.pontos_final;
        agrupado.set(r.aluno_id, cur);
      });
      const arr = Array.from(agrupado.entries())
        .map(([aluno_id, v]) => ({ aluno_id, ...v }))
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 50);
      return arr;
    },
  });

  const ajustar = useMutation({
    mutationFn: async () => {
      if (!ajuste || !motivo.trim()) throw new Error("Motivo obrigatório");
      const { data, error } = await supabase.rpc("fn_clube_adicionar_pontos", {
        p_aluno_id: ajuste.aluno_id,
        p_acao: "ajuste_manual",
        p_motivo_manual: motivo,
        p_pontos_manual: pontos,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) throw new Error(r?.erro ?? "Falha");
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Ajuste aplicado (${r.pontos_adicionados} pts)`);
      setAjuste(null); setPontos(0); setMotivo("");
      qc.invalidateQueries({ queryKey: ["clube-ranking-view"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="trimestral">Trimestral</SelectItem>
            <SelectItem value="semestral">Semestral</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Ref: {referencia}</p>
      </div>

      <div className="space-y-2">
        {ranking?.map((r, i) => (
          <div key={r.aluno_id} className="flex items-center gap-3 border border-border rounded-md p-3">
            <span className="w-8 text-center font-bold">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </span>
            <span className="flex-1 text-sm">{r.nome}</span>
            <strong className="text-sm">{r.pontos} pts</strong>
            <Button size="sm" variant="outline" onClick={() => { setAjuste({ aluno_id: r.aluno_id, nome: r.nome }); setPontos(0); setMotivo(""); }}>
              Ajustar
            </Button>
          </div>
        ))}
        {!ranking?.length && <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período.</p>}
      </div>

      <Dialog open={!!ajuste} onOpenChange={(o) => !o && setAjuste(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajuste manual de pontos</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Aluno</Label><Input value={ajuste?.nome ?? ""} disabled /></div>
            <div>
              <Label>Pontos (use negativo para remover)</Label>
              <Input type="number" value={pontos} onChange={(e) => setPontos(parseInt(e.target.value) || 0)} />
            </div>
            <div><Label>Motivo</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Justificativa obrigatória" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjuste(null)}>Cancelar</Button>
            <Button onClick={() => ajustar.mutate()} disabled={!motivo.trim() || pontos === 0 || ajustar.isPending}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function calcReferencia(periodo: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (periodo === "mensal") return `${y}-${String(m).padStart(2, "0")}`;
  if (periodo === "trimestral") return `${y}-Q${Math.ceil(m / 3)}`;
  if (periodo === "semestral") return `${y}-S${m <= 6 ? 1 : 2}`;
  return `${y}`;
}

function calcInicioPeriodo(periodo: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  let start: Date;
  if (periodo === "mensal") start = new Date(y, m, 1);
  else if (periodo === "trimestral") start = new Date(y, Math.floor(m / 3) * 3, 1);
  else if (periodo === "semestral") start = new Date(y, m < 6 ? 0 : 6, 1);
  else start = new Date(y, 0, 1);
  return start.toISOString();
}
