import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, CloudRain, Trophy, Gift, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const NIVEIS = [
  { key: "iniciante", nome: "Iniciante", emoji: "🌱", min: 0, max: 300 },
  { key: "dedicado", nome: "Dedicado", emoji: "💪", min: 300, max: 1000 },
  { key: "comprometido", nome: "Comprometido", emoji: "⭐", min: 1000, max: 3000 },
  { key: "elite", nome: "Elite", emoji: "🏆", min: 3000, max: Infinity },
];

function getCustoParaPlano(recompensa: any, tipoPlano: string): number {
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
      const { data } = await supabase.from("clube_recompensas").select("*").eq("ativo", true).order("custo_pontos");
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
  const nivelAtual = NIVEIS.find((n) => n.key === (pontos?.nivel ?? "iniciante"))!;
  const proxNivel = NIVEIS[NIVEIS.indexOf(nivelAtual) + 1];
  const progresso = proxNivel ? Math.min(100, ((saldo - nivelAtual.min) / (proxNivel.min - nivelAtual.min)) * 100) : 100;
  const posMinhaMes = ranking?.findIndex((r) => r.aluno_id === student.id);

  const posicaoRanking = posMinhaMes !== undefined && posMinhaMes >= 0 ? posMinhaMes + 1 : null;

  const meuCodigo = indicacoes?.[0]?.codigo;
  const indicConvertidas = indicacoes?.filter((i: any) => i.status === "convertido").length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
          Clube FORTEM
        </h1>
        {planoAtivo && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Plano {planoAtivo}
          </span>
        )}
      </div>

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
          {ranking.slice(0, 10).map((r, i) => (
            <div key={r.aluno_id} className={`flex items-center gap-3 p-2 rounded-md text-sm ${r.aluno_id === student.id ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
              <span className="w-8 text-center">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </span>
              <span className="flex-1 truncate">{r.nome}</span>
              <strong>{r.pontos}</strong>
            </div>
          ))}
          {posicaoRanking && posicaoRanking > 10 && (
            <div className="flex items-center gap-3 p-2 rounded-md text-sm bg-primary/10 border border-primary/30">
              <span className="w-8 text-center">#{posicaoRanking}</span>
              <span className="flex-1 truncate">Você</span>
              <strong>{ranking[posicaoRanking - 1].pontos}</strong>
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
          {historico?.length ? historico.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50">
              <div className="min-w-0 flex-1">
                <p className="truncate">{h.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {h.multiplicador_clima && " · 🌧️ 1.5×"}
                </p>
              </div>
              <strong className={h.pontos_final >= 0 ? "text-primary" : "text-destructive"}>
                {h.pontos_final >= 0 ? "+" : ""}{h.pontos_final}
              </strong>
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
    </div>
  );
}
