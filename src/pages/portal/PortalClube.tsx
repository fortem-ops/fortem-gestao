import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, CloudRain, Trophy, Gift, Copy, ChevronDown, ChevronUp, ChevronRight, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const NIVEIS = [
  { key: "bronze",   nome: "Bronze",   emoji: "🥉", min: 0,    max: 0,     cor: "text-amber-700" },
  { key: "prata",    nome: "Prata",    emoji: "🥈", min: 0,    max: 300,   cor: "text-slate-300" },
  { key: "ouro",     nome: "Ouro",     emoji: "🥇", min: 300,  max: 1000,  cor: "text-yellow-400" },
  { key: "diamante", nome: "Diamante", emoji: "💎", min: 1000, max: 3000,  cor: "text-cyan-400" },
  { key: "platina",  nome: "Platina",  emoji: "👑", min: 3000, max: Infinity, cor: "text-purple-400" },
];

function isAgregadorPlan(tipo?: string | null): boolean {
  if (!tipo) return false;
  const t = tipo.toLowerCase();
  return t.includes("wellhub") || t.includes("gympass") || t.includes("total pass") || t.includes("totalpass");
}

function getCustoParaPlano(recompensa: any, tipoPlano: string): number {
  if (isAgregadorPlan(tipoPlano)) {
    return recompensa.custo_agregador ?? Math.round((recompensa.custo_start ?? recompensa.custo_pontos) * 1.3);
  }
  const tipo = tipoPlano.toLowerCase().replace('+', '_plus').replace(' ', '_');
  const mapa: Record<string, string> = {
    max: 'custo_max',
    pro: 'custo_pro',
    power: 'custo_power',
    start_plus: 'custo_start_plus',
    start: 'custo_start',
  };
  const campo = mapa[tipo];
  return campo && recompensa[campo] != null ? recompensa[campo] : recompensa.custo_pontos;
}

export default function PortalClube() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [rankingAberto, setRankingAberto] = useState(false);
  const [resgateConfirm, setResgateConfirm] = useState<any>(null);
  const [showComparativo, setShowComparativo] = useState(false);
  const [showRegras, setShowRegras] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: planoAtivo } = useQuery({
    queryKey: ["portal-clube-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("tipo")
        .eq("aluno_id", student!.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.tipo ?? "Start";
    },
  });

  const { data: pontos } = useQuery({
    queryKey: ["portal-clube-pontos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase.from("clube_pontos").select("*").eq("aluno_id", student!.id).maybeSingle();
      return data;
    },
  });

  const { data: badges } = useQuery({
    queryKey: ["portal-clube-badges", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("clube_badges").select("*").eq("ativo", true),
        supabase.from("clube_aluno_badges").select("badge_id, conquistado_em").eq("aluno_id", student!.id),
      ]);
      const conquistados = new Map((mine.data || []).map((b: any) => [b.badge_id, b.conquistado_em]));
      return (all.data || []).map((b: any) => ({
        ...b,
        conquistado: conquistados.has(b.id),
        conquistado_em: conquistados.get(b.id),
      }));
    },
  });

  const { data: recompensas } = useQuery({
    queryKey: ["portal-clube-recompensas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_recompensas")
        .select("id, nome, descricao, custo_pontos, custo_start, custo_start_plus, custo_power, custo_pro, custo_max, custo_agregador, tipo, icone, planos_elegiveis")
        .eq("ativo", true)
        .order("custo_pontos");
      return data || [];
    },
  });

  const { data: historico } = useQuery({
    queryKey: ["portal-clube-hist", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase.from("clube_historico").select("*")
        .eq("aluno_id", student!.id).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: clima } = useQuery({
    queryKey: ["portal-clube-clima", hoje],
    queryFn: async () => {
      const { data } = await supabase.from("clube_clima_cache").select("*").eq("data", hoje).maybeSingle();
      return data;
    },
  });

  const { data: indicacoes } = useQuery({
    queryKey: ["portal-clube-indic", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase.from("clube_indicacoes").select("*").eq("padrinho_id", student!.id);
      return data || [];
    },
  });

  const { data: ranking } = useQuery({
    queryKey: ["portal-clube-ranking"],
    enabled: rankingAberto,
    queryFn: async () => {
      const inicio = new Date();
      inicio.setDate(1); inicio.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("clube_historico")
        .select("aluno_id, pontos_final, alunos!inner(nome)")
        .gte("created_at", inicio.toISOString())
        .gt("pontos_final", 0);
      const agrup = new Map<string, { nome: string; pontos: number }>();
      (data || []).forEach((r: any) => {
        const cur = agrup.get(r.aluno_id) || { nome: r.alunos?.nome ?? "—", pontos: 0 };
        cur.pontos += r.pontos_final;
        agrup.set(r.aluno_id, cur);
      });
      return Array.from(agrup.entries())
        .map(([id, v]) => ({ aluno_id: id, ...v }))
        .sort((a, b) => b.pontos - a.pontos);
    },
  });

  const resgatar = useMutation({
    mutationFn: async (recompensa_id: string) => {
      const { data, error } = await supabase.rpc("fn_clube_resgatar", { p_recompensa_id: recompensa_id });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) throw new Error(r?.erro === "saldo_insuficiente" ? "Saldo insuficiente" : (r?.erro ?? "Falha"));
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        (r.tipo === "automatico" ? "Resgate aprovado!" : "Resgate solicitado — aguarde aprovação") +
        (r.custo ? ` (${r.custo} pts)` : "")
      );
      setResgateConfirm(null);
      qc.invalidateQueries({ queryKey: ["portal-clube-pontos"] });
      qc.invalidateQueries({ queryKey: ["portal-clube-hist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!student) return null;

  const saldo = pontos?.saldo ?? 0;
  const nivelKey = pontos?.nivel ?? "prata";
  const nivelAtual = NIVEIS.find((n) => n.key === nivelKey) ?? NIVEIS[1];
  const isAgregador = nivelKey === "bronze";
  const proxNivel = isAgregador ? undefined : NIVEIS.slice(1).find((n, idx, arr) => n.key === nivelAtual.key ? arr[idx + 1] : false) || NIVEIS[NIVEIS.indexOf(nivelAtual) + 1];
  const progresso = proxNivel && proxNivel.min > nivelAtual.min
    ? Math.min(100, ((saldo - nivelAtual.min) / (proxNivel.min - nivelAtual.min)) * 100)
    : 100;
  const posMinhaMes = ranking?.findIndex((r) => r.aluno_id === student.id);

  const posicaoRanking = posMinhaMes !== undefined && posMinhaMes >= 0 ? posMinhaMes + 1 : null;

  const meuCodigo = indicacoes?.[0]?.codigo;
  const indicConvertidas = indicacoes?.filter((i: any) => i.status === "convertido").length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="pt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Programa de Fidelidade</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Clube FORTEM</h1>
            {planoAtivo && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Plano {planoAtivo}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowRegras(true)}
          aria-label="Como funciona"
          className="w-9 h-9 shrink-0 rounded-xl bg-card border border-border flex items-center justify-center"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Acesso rápido à carteirinha */}
      <Link to="/portal/carteirinha">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-2xl">🪪</span>
          </div>
          <div className="flex-1">
            <p className="font-black text-base text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
              Minha Carteirinha
            </p>
            <p className="text-xs text-muted-foreground">QR Code para parceiros FORTEM</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </Link>

      {/* Card principal — nível + saldo */}
      <Card className="glass-card p-6 bg-gradient-to-br from-primary/20 to-transparent border-primary/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Nível</p>
            <p className="text-2xl font-heading font-bold mt-1">
              <span className="mr-2">{nivelAtual.emoji}</span>{nivelAtual.nome}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Saldo</p>
            <p className="text-3xl font-heading font-bold text-primary mt-1">{saldo}</p>
            <p className="text-[10px] text-muted-foreground">pontos</p>
          </div>
        </div>
        {proxNivel && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-1">
              <span>Faltam <strong>{proxNivel.min - saldo}</strong> pts para {proxNivel.emoji} {proxNivel.nome}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}
        {pontos?.pontos_expiram_em && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Pontos válidos até {format(new Date(pontos.pontos_expiram_em), "dd/MM/yyyy")}
          </p>
        )}
        {isAgregador && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Plano Agregador</p>
            <p className="text-xs text-muted-foreground mt-1">
              Você tem plano <strong>Wellhub/Gympass</strong> ou <strong>Total Pass</strong> — seu nível fica fixo em Bronze,
              pontua 50% menos e resgates custam 30% a mais. Migre para um plano Fortem para desbloquear todos os níveis.
            </p>
          </div>
        )}
      </Card>

      {/* Multiplicador climático */}
      {clima?.multiplicador_ativo && (
        <Card className="glass-card p-4 border-primary/50 bg-primary/10 flex items-center gap-3">
          <CloudRain className="w-6 h-6 text-primary" />
          <div>
            <p className="font-heading font-semibold">Dia especial!</p>
            <p className="text-xs text-muted-foreground">{clima.motivo} — seus pontos de treino valem 1,5× hoje.</p>
          </div>
        </Card>
      )}

      {/* Badges */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Conquistas</p>
        {!badges ? <Skeleton className="h-32" /> : (
          <div className="grid grid-cols-3 gap-3">
            {badges.map((b) => (
              <Card key={b.id} className={`p-3 text-center ${b.conquistado ? "" : "opacity-40 grayscale"}`}>
                <div className="text-3xl">{b.emoji}</div>
                <p className="text-[11px] font-semibold mt-1 leading-tight">{b.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {b.conquistado ? format(new Date(b.conquistado_em!), "dd/MM/yy") : "Bloqueado"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Meu ranking */}
      <Card className="glass-card p-4 flex items-center gap-3">
        <Trophy className="w-8 h-8 text-amber-500" />
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Ranking mensal</p>
          <p className="font-heading font-bold">
            {posicaoRanking ? `#${posicaoRanking}` : rankingAberto ? "Fora do top" : "—"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setRankingAberto((v) => !v)}>
          {rankingAberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </Card>

      {rankingAberto && ranking && (
        <div className="space-y-2">
          {ranking.slice(0, 10).map((r, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            const isMe = r.aluno_id === student.id;
            return isMe ? (
              <div key={r.aluno_id} className="bg-primary/20 border border-primary/40 rounded-xl p-3 flex items-center gap-3">
                <span className="text-lg">🥇</span>
                <div className="flex-1">
                  <p className="font-black text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                    {student.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">{pontos?.saldo ?? 0} pontos</p>
                </div>
                <span className="text-xs font-bold text-primary">#{posicaoRanking} este mês</span>
              </div>
            ) : (
              <div key={r.aluno_id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <span className="text-base">{medal}</span>
                <p className="flex-1 text-sm font-semibold text-foreground truncate">{r.nome}</p>
                <p className="text-sm font-bold text-foreground">{r.pontos} pts</p>
              </div>
            );
          })}
          {posicaoRanking && posicaoRanking > 10 && (
            <div className="bg-primary/20 border border-primary/40 rounded-xl p-3 flex items-center gap-3">
              <span className="text-lg">🥇</span>
              <div className="flex-1">
                <p className="font-black text-sm text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                  {student.nome}
                </p>
                <p className="text-xs text-muted-foreground">{pontos?.saldo ?? 0} pontos</p>
              </div>
              <span className="text-xs font-bold text-primary">#{posicaoRanking} este mês</span>
            </div>
          )}
        </div>
      )}

      {/* Recompensas */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Gift className="w-3 h-3" /> Catálogo de recompensas
        </p>
        <div className="grid grid-cols-1 gap-3">
          {recompensas?.map((r: any) => {
            const custo = getCustoParaPlano(r, planoAtivo ?? "Start");
            const podeResgatar = saldo >= custo;
            return (
              <Card key={r.id} className="glass-card p-4 flex items-center gap-3">
                <span className="text-2xl">{r.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.descricao}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">
                      {custo} pts
                    </span>
                    {custo < r.custo_pontos && (
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        ↓ Benefício {planoAtivo}
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" disabled={!podeResgatar} onClick={() => setResgateConfirm({ ...r, __custo: custo })}>
                  {podeResgatar ? "Resgatar" : `Faltam ${custo - saldo}`}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Comparativo de planos */}
      <section className="space-y-2">
        <button
          onClick={() => setShowComparativo(!showComparativo)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <p className="text-sm font-semibold text-foreground">Ver vantagens por plano</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showComparativo ? 'rotate-180' : ''}`} />
        </button>

        {showComparativo && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-border" style={{gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr'}}>
              <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Recompensa</div>
              {['Start', 'Start+', 'Power', 'Pro', 'Max'].map(p => {
                const key = p.toLowerCase().replace('+','_plus').replace(' ','_');
                const isUser = key === (planoAtivo?.toLowerCase().replace('+','_plus').replace(' ','_') ?? 'start');
                return (
                  <div key={p} className={`px-1 py-2 text-center text-[10px] font-bold uppercase ${isUser ? 'text-primary' : 'text-muted-foreground'}`}>
                    {p}
                  </div>
                );
              })}
            </div>

            {/* Linhas por recompensa */}
            {recompensas?.map((r: any) => {
              const custos = [
                r.custo_start ?? r.custo_pontos,
                r.custo_start_plus ?? r.custo_pontos,
                r.custo_power ?? r.custo_pontos,
                r.custo_pro ?? r.custo_pontos,
                r.custo_max ?? r.custo_pontos,
              ];
              const minCusto = Math.min(...custos);
              return (
                <div key={r.id} className="grid border-b border-border last:border-0" style={{gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr'}}>
                  <div className="px-3 py-2.5 flex items-center gap-1.5">
                    <span className="text-sm shrink-0">{r.icone}</span>
                    <p className="text-[11px] font-medium text-foreground leading-tight">{r.nome}</p>
                  </div>
                  {custos.map((c, i) => {
                    const isUserPlan = i === ['start','start_plus','power','pro','max']
                      .indexOf(planoAtivo?.toLowerCase().replace('+','_plus').replace(' ','_') ?? 'start');
                    const isCheapest = c === minCusto;
                    return (
                      <div key={i} className={`px-1 py-2.5 text-center ${isUserPlan ? 'bg-primary/5' : ''}`}>
                        <p className={`text-[11px] font-bold ${
                          isUserPlan ? 'text-primary' :
                          isCheapest ? 'text-emerald-400' :
                          'text-foreground'
                        }`}>{c}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Legenda */}
            <div className="px-3 py-2 border-t border-border flex gap-3 flex-wrap">
              <span className="text-[10px] text-primary font-semibold">● Seu plano</span>
              <span className="text-[10px] text-emerald-400 font-semibold">● Menor custo</span>
              <span className="text-[10px] text-muted-foreground">Valores em pontos</span>
            </div>
          </div>
        )}
      </section>

      {/* Indicação */}
      {meuCodigo && (
        <Card className="glass-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Seu código de indicação</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-lg font-mono font-bold tracking-wider bg-muted/50 rounded-md px-3 py-2">{meuCodigo}</code>
            <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(meuCodigo); toast.success("Copiado"); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Você indicou <strong>{indicConvertidas}</strong> aluno(s) que contrataram.
          </p>
        </Card>
      )}

      {/* Histórico */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Últimas movimentações</p>
        <div className="space-y-1">
          {historico?.length ? historico.map((mov: any) => (
            <div key={mov.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{mov.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <span className={`text-sm font-black ml-3 ${mov.pontos_final > 0 ? 'text-emerald-400' : 'text-destructive'}`}
                style={{fontFamily:'Archivo,sans-serif'}}>
                {mov.pontos_final > 0 ? '+' : ''}{mov.pontos_final}
                {mov.multiplicador_clima && <span className="text-[10px] ml-1">🌧️</span>}
              </span>
            </div>
          )) : <p className="text-xs text-muted-foreground">Sem movimentações ainda.</p>}
        </div>
      </section>

      {/* Confirmação de resgate */}
      <Dialog open={!!resgateConfirm} onOpenChange={(o) => !o && setResgateConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar resgate</DialogTitle></DialogHeader>
          {resgateConfirm && (
            <p className="text-sm">
              Usar <strong>{resgateConfirm.__custo ?? resgateConfirm.custo_pontos} pontos</strong> para resgatar{" "}
              <strong>{resgateConfirm.nome}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResgateConfirm(null)}>Cancelar</Button>
            <Button onClick={() => resgatar.mutate(resgateConfirm.id)} disabled={resgatar.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Regras */}
      {showRegras && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowRegras(false)}>
          <div
            className="bg-card border-t border-border rounded-t-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-2" />

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                Como funciona o Clube
              </h2>
              <button onClick={() => setShowRegras(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Níveis da carteirinha</p>
              <p className="text-xs text-muted-foreground">
                Seu nível é definido pela combinação do seu plano ativo e dos pontos acumulados — sempre prevalece o maior entre os dois.
              </p>
              <div className="space-y-2">
                {[
                  { nivel: "🥉 Bronze", cor: "text-amber-700", plano: "Start / Start+", pontos: "0 – 299 pts", desc: "Nível inicial. Acesso aos benefícios básicos dos parceiros." },
                  { nivel: "🥈 Prata", cor: "text-slate-400", plano: "Power", pontos: "300 – 999 pts", desc: "Acesso a benefícios intermediários e desconto em recompensas." },
                  { nivel: "🥇 Ouro", cor: "text-yellow-400", plano: "Pro", pontos: "1.000 – 2.999 pts", desc: "Acesso a benefícios premium e desconto significativo nas recompensas." },
                  { nivel: "👑 Elite", cor: "text-primary", plano: "Max", pontos: "3.000+ pts", desc: "Nível máximo. Acesso VIP a todos os benefícios e mínimo de pontos para resgates." },
                ].map(n => (
                  <div key={n.nivel} className="bg-background border border-border rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className={`text-sm font-black ${n.cor}`} style={{fontFamily:'Archivo,sans-serif'}}>{n.nivel}</p>
                      <div className="flex gap-2">
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{n.plano}</span>
                        <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full text-primary">{n.pontos}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-foreground">
                  💡 <strong>Exemplo:</strong> Aluno com plano Power (nível mínimo Prata) que acumula 1.200 pontos sobe automaticamente para <strong>Ouro</strong> — o maior entre os dois prevalece.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Como ganhar pontos</p>
              <div className="space-y-2">
                {[
                  { emoji: "🏋️", acao: "Treino realizado", pts: "10 pts", obs: "Por sessão confirmada" },
                  { emoji: "📊", acao: "Avaliação funcional", pts: "50 pts", obs: "A cada avaliação" },
                  { emoji: "🤝", acao: "Indicação convertida", pts: "100 pts", obs: "Quando o indicado contrata" },
                  { emoji: "🎁", acao: "Bônus por ser indicado", pts: "50 pts", obs: "Única vez" },
                  { emoji: "💪", acao: "Serviço contratado", pts: "30 pts", obs: "Por serviço" },
                  { emoji: "🎂", acao: "Aniversário FORTEM", pts: "100 pts", obs: "Por ano completado" },
                  { emoji: "🎉", acao: "Aniversário do aluno", pts: "50 pts", obs: "Uma vez por ano" },
                  { emoji: "⭐", acao: "Avaliação no Google", pts: "50 pts", obs: "Única vez" },
                  { emoji: "✅", acao: "Perfil completo", pts: "20 pts", obs: "Única vez" },
                ].map(item => (
                  <div key={item.acao} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-lg shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.acao}</p>
                      <p className="text-xs text-muted-foreground">{item.obs}</p>
                    </div>
                    <span className="text-sm font-black text-emerald-400 shrink-0" style={{fontFamily:'Archivo,sans-serif'}}>
                      +{item.pts}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Multiplicador climático</p>
              <div className="bg-background border border-border rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-bold text-foreground">🌧️ Dias de chuva, frio ou calor intenso</p>
                <p className="text-xs text-muted-foreground">
                  Em dias de clima extremo em Porto Alegre, seus pontos de treino valem <strong className="text-foreground">1,5×</strong> automaticamente. O app exibe um aviso quando o multiplicador está ativo.
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Validade dos pontos</p>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">
                  Seus pontos são válidos por <strong className="text-foreground">12 meses</strong> a partir da última movimentação. Em caso de cancelamento do plano, os pontos expiram imediatamente e não podem ser transferidos.
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Parceiros FORTEM</p>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">
                  Estabelecimentos parceiros oferecem benefícios exclusivos para membros do Clube FORTEM. Apresente sua carteirinha digital com QR Code ao fazer uso do benefício. Cada parceiro pode ter um nível mínimo exigido para acesso.
                </p>
              </div>
            </section>

            <div className="pb-4" />
          </div>
        </div>
      )}
    </div>
  );
}
