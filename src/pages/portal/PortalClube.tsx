import PortalDesafioColetivo from "@/components/portal/PortalDesafioColetivo";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeuPlanoClube, custoRecompensa, proximoMarco, EXPLICACAO_BADGE, useRegrasClube, useLimitesResgate, fmtDataBr } from "@/lib/clubePlano";
import { ResumoRankingGeral } from "@/components/portal/RankingGeral";
import { SeloPlano } from "@/components/portal/SeloPlano";
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

function iniciais(nome?: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  return ((partes[0][0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export default function PortalClube() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [resgateConfirm, setResgateConfirm] = useState<any>(null);
  const [showRegras, setShowRegras] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  const [badgeAberto, setBadgeAberto] = useState<any>(null);

  const { data: membroFoto } = useQuery({
    queryKey: ["portal-clube-membro-foto", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clube_fortem_membros")
        .select("foto_url")
        .eq("aluno_id", student!.id)
        .maybeSingle();
      return (data?.foto_url as string | null) || null;
    },
  });

  const { data: meuPlano } = useMeuPlanoClube(!!student);

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
        .select("id, nome, descricao, custo_pontos, custo_start, custo_agregador, tipo, icone, planos_elegiveis")
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

  const { data: regras } = useRegrasClube(!!student);
  const { data: limites } = useLimitesResgate(!!student);

  const resgatar = useMutation({
    mutationFn: async (recompensa_id: string) => {
      const { data, error } = await supabase.rpc("fn_clube_resgatar", { p_recompensa_id: recompensa_id });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) throw new Error(r?.erro === "saldo_insuficiente" ? "Saldo insuficiente" : r?.erro === "limite_mensal" ? r.mensagem : (r?.erro ?? "Falha"));
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
      qc.invalidateQueries({ queryKey: ["portal-clube-limites"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!student) return null;

  const saldo = pontos?.saldo ?? 0;
  const isAgregador = !!meuPlano?.agregador;
  const marco = proximoMarco(saldo, (recompensas ?? []) as any[], isAgregador);
  const fmtMult = (v?: number | null) => (v == null ? "—" : `${String(v).replace(".", ",")}x`);

  const meuCodigo = indicacoes?.[0]?.codigo;
  const indicConvertidas = indicacoes?.filter((i: any) => i.status === "convertida").length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="pt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Programa de Fidelidade</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black uppercase text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Benefícios</h1>
            <SeloPlano chave={meuPlano?.chave} />
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

      <PortalDesafioColetivo enabled={!!student} />

      {/* Acesso rápido à carteirinha */}
      <Link to="/portal/carteirinha">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          {membroFoto ? (
            <img src={membroFoto} alt="" className="w-12 h-12 object-cover shrink-0" />
          ) : (
            <div aria-hidden className="w-12 h-12 bg-[#2C2C2C] flex items-center justify-center shrink-0 text-sm font-black uppercase text-[#B1B3B3]" style={{ fontFamily: "Archivo,sans-serif" }}>
              {iniciais(student.nome)}
            </div>
          )}
          <div className="flex-1">
            <p className="font-black text-base text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
              Minha Carteirinha
            </p>
            <p className="text-xs text-muted-foreground">QR Code para parceiros FORTEM</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </Link>

      {/* Card principal — plano + saldo + próximo marco */}
      <Card className="p-6 border-[#4A4B4B] bg-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Plano</p>
            <p className="text-2xl font-black uppercase mt-1" style={{fontFamily:'Archivo,sans-serif'}}>{meuPlano?.plano ?? "—"}</p>
            {meuPlano && (
              <p className="text-[11px] text-muted-foreground mt-1">Seus pontos de treino valem {fmtMult(meuPlano.multiplicador)}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Saldo</p>
            <p className="text-3xl font-black text-foreground mt-1" style={{fontFamily:'Archivo,sans-serif'}}>{saldo}</p>
            <p className="text-[10px] text-muted-foreground">pontos</p>
          </div>
        </div>
        {marco && (
          <div className="mt-4">
            <p className="text-[11px] mb-1.5 text-foreground">
              Faltam <strong>{marco.faltam}</strong> pontos para a próxima recompensa
              <span className="text-muted-foreground"> · {marco.recompensa.nome}</span>
            </p>
            <div className="h-1 bg-[#2C2C2C] overflow-hidden" role="progressbar" aria-valuenow={marco.progresso} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-[#c8282a] transition-all" style={{ width: `${marco.progresso}%` }} />
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
              Com plano <strong>Wellhub/Gympass</strong> ou <strong>Total Pass</strong> você pontua 50% menos
              e os resgates custam 30% a mais. Nos planos Fortem os pontos valem mais.
            </p>
          </div>
        )}
      </Card>

      {isAgregador && (
        <button
          onClick={() => window.open('https://wa.me/555135199451?text=Olá! Sou aluno Wellhub/TotalPass e quero conhecer os planos FORTEM.', '_blank')}
          className="w-full py-3 rounded-2xl bg-amber-500 text-black text-sm font-black flex items-center justify-center gap-2"
          style={{fontFamily:'Archivo,sans-serif'}}
        >
          Migrar para plano FORTEM
        </button>
      )}

      {/* Multiplicador climático */}
      {clima?.multiplicador_ativo && !isAgregador && (
        <Card className="glass-card p-4 border-primary/50 bg-primary/10 flex items-center gap-3">
          <CloudRain className="w-6 h-6 text-primary" />
          <div>
            <p className="font-heading font-semibold">Dia especial!</p>
            <p className="text-xs text-muted-foreground">{clima.motivo} — o multiplicador do clima ({fmtMult(meuPlano?.clima_multiplicador)}) se soma ao do seu plano hoje.</p>
          </div>
        </Card>
      )}

      {/* Badges */}
      <section>
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)] mb-3">Conquistas</p>
        {!badges ? <Skeleton className="h-32" /> : (
          <div className="grid grid-cols-3 gap-3">
            {badges.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBadgeAberto(b)}
                className={`min-h-[44px] border border-[#4A4B4B] bg-card p-3 text-center ${b.conquistado ? "" : "opacity-40 grayscale"}`}
              >
                <p className="text-[11px] font-semibold mt-1 leading-tight">{b.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {b.conquistado ? format(new Date(b.conquistado_em!), "dd/MM/yy") : "Bloqueado"}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {badgeAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setBadgeAberto(null)}>
          <div
            role="dialog"
            aria-label={badgeAberto.nome}
            className="w-full border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-3"
            style={{ fontFamily: "Archivo, sans-serif" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Conquista</p>
            <p className="text-xl font-black uppercase text-foreground">{badgeAberto.nome}</p>
            <p className={`text-xs font-bold uppercase tracking-[0.08em] ${badgeAberto.conquistado ? "text-[#4CC38A]" : "text-[#E3B341]"}`}>
              {badgeAberto.conquistado ? "Conquistada" : "Em andamento"}
            </p>
            <p className="text-sm text-muted-foreground">{EXPLICACAO_BADGE[badgeAberto.nome] ?? badgeAberto.descricao ?? ""}</p>
            <button
              onClick={() => setBadgeAberto(null)}
              className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Ranking único (treinos do mês) */}
      <ResumoRankingGeral />

      <button
        type="button"
        onClick={() => setShowRegras(true)}
        className="flex min-h-[56px] w-full items-center justify-between border border-[#4A4B4B] bg-card px-4 text-left"
        style={{ fontFamily: "Archivo,sans-serif" }}
      >
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Como funcionam os pontos</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Recompensas */}
      <section>
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)] mb-3 flex items-center gap-2">
          <Gift className="w-3 h-3" /> Catálogo de recompensas
        </p>
        <div className="grid grid-cols-1 gap-3">
          {recompensas?.map((r: any) => {
            const custo = custoRecompensa(r, isAgregador);
            const lim = limites?.find((l) => l.recompensa_id === r.id);
            const limiteAtingido = !!lim && lim.resgates_mes >= lim.limite_mensal;
            const podeResgatar = saldo >= custo && !limiteAtingido;
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
                  </div>
                </div>
                <Button size="sm" className="whitespace-normal h-auto min-h-[44px] max-w-[140px] text-center" disabled={!podeResgatar} onClick={() => setResgateConfirm({ ...r, __custo: custo })}>
                  {limiteAtingido ? `Disponível novamente em ${fmtDataBr(lim!.disponivel_em)}` : podeResgatar ? "Resgatar" : `Faltam ${custo - saldo}`}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Indicação */}
      {meuCodigo && (
        <Card className="glass-card p-4">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)] mb-2">Seu código de indicação</p>
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
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)] mb-3">Últimas movimentações</p>
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
                {mov.multiplicador_clima && <span className="text-[10px] ml-1">Clima</span>}
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
                Como funcionam os pontos
              </h2>
              <button onClick={() => setShowRegras(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <section className="space-y-3">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Pontos por plano</p>
              <p className="text-xs text-muted-foreground">
                Cada plano multiplica os pontos que você ganha. O custo das recompensas é o mesmo para Start, Power e Pro.
              </p>
              <div className="border border-[#4A4B4B] divide-y divide-[#4A4B4B]">
                {[
                  { rotulo: "Start", chave: "mult_plano_start" },
                  { rotulo: "Power", chave: "mult_plano_power" },
                  { rotulo: "Pro", chave: "mult_plano_pro" },
                  { rotulo: "Consultoria Online", chave: "mult_plano_consultoria" },
                  { rotulo: "Wellhub / Total Pass", chave: "mult_agregador" },
                ].map((l) => (
                  <div key={l.chave} className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-sm text-foreground">{l.rotulo}</span>
                    <span className="text-sm font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{fmtMult(meuPlano?.multiplicadores?.[l.chave])}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Em dia de clima extremo, o multiplicador do clima se soma ao do plano (por exemplo, Pro em dia de chuva: 1,5 x 1,5 = 2,25x). Wellhub e Total Pass não recebem o do clima. Os resgates para esses planos custam 30% a mais.
              </p>
            </section>

            <section className="space-y-3">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Como ganhar pontos</p>
              <div className="space-y-2">
                {[
                  { acao: "Treino realizado", pts: `${regras?.pontos_treino ?? 10} pts`, obs: "Por sessão confirmada, antes do multiplicador do plano" },
                  { acao: "Avaliação funcional", pts: "50 pts", obs: "A cada avaliação" },
                  { acao: "Indicação convertida", pts: "100 pts", obs: "Quando o indicado contrata" },
                  { acao: "Bônus por ser indicado", pts: "50 pts", obs: "Única vez" },
                  { acao: "Serviço contratado", pts: "30 pts", obs: "Por serviço" },
                  { acao: "Aniversário FORTEM", pts: "100 pts", obs: "Por ano completado" },
                  { acao: "Aniversário do aluno", pts: "50 pts", obs: "Uma vez por ano" },
                  { acao: "Avaliação no Google", pts: "50 pts", obs: "Única vez" },
                  { acao: "Perfil completo", pts: "20 pts", obs: "Única vez" },
                ].map(item => (
                  <div key={item.acao} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
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
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Multiplicador climático</p>
              <div className="bg-background border border-border rounded-xl p-3 space-y-1.5">
                <p className="text-sm font-bold text-foreground">Dias de chuva, frio ou calor intenso</p>
                <p className="text-xs text-muted-foreground">
                  Em dias de clima extremo em Porto Alegre, o multiplicador do clima (<strong className="text-foreground">{fmtMult(meuPlano?.clima_multiplicador)}</strong>) se soma ao do seu plano. O app exibe um aviso quando o multiplicador está ativo.
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Limite de resgate</p>
              <div className="bg-background border border-border p-3 space-y-1">
                {(regras?.limites ?? []).length ? (regras!.limites).map((l) => (
                  <p key={l.nome} className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{l.nome}</strong>: {l.limite_mensal} {l.limite_mensal === 1 ? "resgate" : "resgates"} por mês
                  </p>
                )) : <p className="text-xs text-muted-foreground">Sem limite mensal nas recompensas atuais.</p>}
                <p className="text-xs text-muted-foreground">O mês conta do dia 1 ao último dia, no horário de Brasília.</p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Plano FORTEM x agregador</p>
              <div className="bg-background border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Alunos com plano FORTEM ganham mais pontos do que alunos de Wellhub ou Total Pass, que pontuam {fmtMult(meuPlano?.multiplicadores?.mult_agregador ?? regras?.mult_agregador)}.
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Validade dos pontos</p>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">
                  Seus pontos são válidos por <strong className="text-foreground">12 meses</strong> a partir da última movimentação. Em caso de cancelamento do plano, os pontos expiram imediatamente e não podem ser transferidos.
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Parceiros FORTEM</p>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">
                  Estabelecimentos parceiros oferecem benefícios exclusivos para alunos FORTEM. Apresente sua carteirinha digital com QR Code ao fazer uso do benefício.
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
