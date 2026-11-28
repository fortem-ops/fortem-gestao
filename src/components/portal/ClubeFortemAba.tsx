import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CloudRain, Gift, HelpCircle, QrCode, X, Dumbbell, Sparkles, Tag, Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { useParceirosPortal } from "@/hooks/useParceirosPortal";
import {
  useMeuPlanoClube,
  useRankingGeral,
  useRegrasClube,
  useLimitesResgate,
  custoRecompensa,
  fmtDataBr,
} from "@/lib/clubePlano";
import { SeloPlano } from "@/components/portal/SeloPlano";
import { IndiqueUmAmigo } from "@/components/portal/IndiqueUmAmigo";
import PortalDesafioColetivo from "@/components/portal/PortalDesafioColetivo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";

interface RecompensaRow {
  id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  custo_start?: number | null;
  custo_agregador?: number | null;
  tipo: string;
  icone?: string | null;
}

interface HistoricoRow {
  id: string;
  label: string;
  created_at: string;
  pontos_final: number;
  multiplicador_clima?: boolean | null;
}

function IconeRecompensa({ nome }: { nome: string }) {
  const n = nome.toLowerCase();
  const cls = "h-5 w-5 shrink-0 text-[#B1B3B3]";
  if (n.includes("treino") || n.includes("aula")) return <Dumbbell className={cls} />;
  if (n.includes("desconto") || n.includes("cupom") || n.includes("loja")) return <Tag className={cls} />;
  if (n.includes("recovery") || n.includes("avalia") || n.includes("nutri") || n.includes("fisio")) return <Sparkles className={cls} />;
  if (n.includes("ingresso") || n.includes("voucher") || n.includes("parceiro")) return <Ticket className={cls} />;
  return <Gift className={cls} />;
}

function fmtMult(v?: number | null): string {
  return v == null ? "—" : `${String(v).replace(".", ",")}x`;
}

export function ClubeFortemAba() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [resgateConfirm, setResgateConfirm] = useState<(RecompensaRow & { custoCalculado: number }) | null>(null);
  const [showRegras, setShowRegras] = useState(false);
  const [verTodasRecompensas, setVerTodasRecompensas] = useState(false);
  const [verHistoricoCompleto, setVerHistoricoCompleto] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: meuPlano } = useMeuPlanoClube(!!student);
  const { data: ranking } = useRankingGeral();
  const { data: parceiros = [], isLoading: loadingParceiros } = useParceirosPortal(!!student);
  const { data: regras } = useRegrasClube(!!student);
  const { data: limites } = useLimitesResgate(!!student);

  const { data: pontos } = useQuery({
    queryKey: ["portal-clube-pontos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_pontos")
        .select("saldo, pontos_expiram_em")
        .eq("aluno_id", student!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: recompensas = [] } = useQuery<RecompensaRow[]>({
    queryKey: ["portal-clube-recompensas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_recompensas")
        .select("id, nome, descricao, custo_pontos, custo_start, custo_agregador, tipo, icone")
        .eq("ativo", true)
        .order("custo_pontos");
      return (data ?? []) as RecompensaRow[];
    },
  });

  const { data: historico = [] } = useQuery<HistoricoRow[]>({
    queryKey: ["portal-clube-hist", student?.id, verHistoricoCompleto],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_historico")
        .select("id, label, created_at, pontos_final, multiplicador_clima")
        .eq("aluno_id", student!.id)
        .order("created_at", { ascending: false })
        .limit(verHistoricoCompleto ? 50 : 10);
      return (data ?? []) as HistoricoRow[];
    },
  });

  const { data: clima } = useQuery({
    queryKey: ["portal-clube-clima", hoje],
    queryFn: async () => {
      const { data } = await supabase
        .from("clube_clima_cache")
        .select("multiplicador_ativo, motivo")
        .eq("data", hoje)
        .maybeSingle();
      return data;
    },
  });

  const resgatar = useMutation({
    mutationFn: async (recompensaId: string) => {
      const { data, error } = await supabase.rpc("fn_clube_resgatar", { p_recompensa_id: recompensaId });
      if (error) throw error;
      const r = data as { ok?: boolean; erro?: string; mensagem?: string; tipo?: string; custo?: number } | null;
      if (!r?.ok) {
        throw new Error(
          r?.erro === "saldo_insuficiente"
            ? "Saldo insuficiente"
            : r?.erro === "limite_mensal"
              ? (r.mensagem ?? "Limite mensal atingido")
              : (r?.erro ?? "Falha ao resgatar"),
        );
      }
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        (r.tipo === "automatico" ? "Resgate aprovado" : "Resgate solicitado — aguarde aprovação") +
          (r.custo ? ` (${r.custo} pts)` : ""),
      );
      setResgateConfirm(null);
      qc.invalidateQueries({ queryKey: ["portal-clube-pontos"] });
      qc.invalidateQueries({ queryKey: ["portal-clube-hist"] });
      qc.invalidateQueries({ queryKey: ["portal-clube-limites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!student) return null;

  const saldo = pontos?.saldo ?? 0;
  const isAgregador = !!meuPlano?.agregador;
  const euRanking = ranking?.eu;
  const diasRanking = euRanking?.treinos_mes ?? 0;
  const textoRanking = euRanking?.participa && euRanking.posicao
    ? `Você é o #${euRanking.posicao} no ranking deste mês · ${diasRanking} ${diasRanking === 1 ? "dia" : "dias"} com treino`
    : `${diasRanking} ${diasRanking === 1 ? "dia" : "dias"} com treino neste mês`;

  const recompensasVisiveis = verTodasRecompensas ? recompensas : recompensas.slice(0, 3);
  const historicoVisivel = verHistoricoCompleto ? historico : historico.slice(0, 3);
  const parceirosDestaque = parceiros.slice(0, 4);

  return (
    <div className="space-y-6 pb-8 animate-fade-in" style={{ fontFamily: "Archivo, sans-serif" }}>
      {/* a) Card de pontos */}
      <section className="border border-[#4A4B4B] bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <p className={ROTULO}>Seus pontos</p>
          <div className="flex items-center gap-2">
            <Link
              to="/portal/carteirinha"
              className="inline-flex min-h-[36px] items-center gap-1.5 border border-[#4A4B4B] px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-foreground hover:bg-[#2C2C2C]"
            >
              <QrCode className="h-3.5 w-3.5" /> Carteirinha
            </Link>
            <button
              type="button"
              onClick={() => setShowRegras(true)}
              aria-label="Como funcionam os pontos"
              className="flex h-9 w-9 items-center justify-center border border-[#4A4B4B] text-[#B1B3B3] hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-black leading-none text-foreground">{saldo.toLocaleString("pt-BR")}</p>
            <p className="mt-1.5 text-xs text-[#B1B3B3]">
              pontos{pontos?.pontos_expiram_em ? ` · válidos até ${format(new Date(pontos.pontos_expiram_em), "dd/MM/yyyy")}` : ""}
            </p>
          </div>
          {meuPlano && (
            <div className="flex items-center gap-1.5">
              <SeloPlano chave={meuPlano.chave} />
              <span className="text-xs font-bold text-[#B1B3B3]">· {fmtMult(meuPlano.multiplicador)}</span>
            </div>
          )}
        </div>

        {isAgregador && (
          <div className="border border-[#E3B341]/40 bg-[#E3B341]/10 p-3 text-xs text-[#B1B3B3]">
            Com plano Wellhub ou Total Pass você pontua {fmtMult(meuPlano?.multiplicador)} e os resgates custam 30% a mais.
          </div>
        )}

        {clima?.multiplicador_ativo && !isAgregador && (
          <div className="flex items-center gap-2.5 border border-[#C8282A]/50 bg-[#C8282A]/10 p-3 text-xs text-foreground">
            <CloudRain className="h-4 w-4 shrink-0 text-[#E73C3E]" />
            <span>{clima.motivo} — bônus de clima ({fmtMult(meuPlano?.clima_multiplicador)}) ativo hoje.</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[#4A4B4B] pt-3">
          <p className="min-w-0 truncate text-xs text-[#B1B3B3]">{textoRanking}</p>
          <Link
            to="/portal/comunidade?aba=ranking"
            className="shrink-0 text-[12px] font-bold uppercase tracking-[0.08em] text-[#E73C3E]"
          >
            Ver
          </Link>
        </div>
      </section>

      {/* b) Desafio coletivo */}
      <PortalDesafioColetivo enabled={!!student} />

      {/* c) Recompensas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className={ROTULO}>Recompensas</p>
          {recompensas.length > 3 && (
            <button
              type="button"
              onClick={() => setVerTodasRecompensas((v) => !v)}
              className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#E73C3E]"
            >
              {verTodasRecompensas ? "Ver menos" : "Ver todas"}
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {recompensasVisiveis.map((r) => {
            const custo = custoRecompensa(r, isAgregador);
            const lim = limites?.find((l) => l.recompensa_id === r.id);
            const limiteAtingido = !!lim && lim.resgates_mes >= lim.limite_mensal;
            const podeResgatar = saldo >= custo && !limiteAtingido;
            return (
              <div key={r.id} className="flex items-center gap-3 border border-[#4A4B4B] bg-card p-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#4A4B4B] bg-[#2C2C2C]">
                  <IconeRecompensa nome={r.nome} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{r.nome}</p>
                  {r.descricao && <p className="truncate text-xs text-[#B1B3B3]">{r.descricao}</p>}
                  <p className="mt-1 text-xs font-bold text-foreground">
                    {custo} pts
                    {lim ? <span className="font-normal text-[#B1B3B3]"> · {lim.limite_mensal} por mês</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!podeResgatar}
                  onClick={() => setResgateConfirm({ ...r, custoCalculado: custo })}
                  className="min-h-[44px] max-w-[130px] shrink-0 bg-[#C8282A] px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-white disabled:border disabled:border-[#4A4B4B] disabled:bg-transparent disabled:text-[#B1B3B3]"
                >
                  {limiteAtingido
                    ? `Volta em ${fmtDataBr(lim!.disponivel_em)}`
                    : podeResgatar
                      ? "Resgatar"
                      : `Faltam ${custo - saldo}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* d) Parceiros FORTEM */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className={ROTULO}>Parceiros FORTEM</p>
          <Link
            to="/portal/parceiros"
            className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#E73C3E]"
          >
            Ver todos
          </Link>
        </div>
        <p className="text-xs text-[#B1B3B3]">Mostre sua carteirinha e aproveite descontos e benefícios.</p>
        {loadingParceiros ? (
          <Skeleton className="h-32" />
        ) : parceirosDestaque.length === 0 ? (
          <p className="border border-[#4A4B4B] bg-card p-4 text-xs text-[#B1B3B3]">
            Nenhum parceiro com benefício ativo no momento.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {parceirosDestaque.map((p) => (
              <Link
                key={p.id}
                to="/portal/parceiros"
                className="flex flex-col justify-between border border-[#4A4B4B] bg-card p-3.5 hover:border-foreground"
              >
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3] truncate">
                    {p.categoria}
                  </p>
                  <p className="text-sm font-black leading-tight text-foreground line-clamp-2">{p.nome}</p>
                </div>
                <p className="mt-2 text-xs text-[#B1B3B3] line-clamp-2">{p.beneficios[0]?.titulo}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* e) Indique um amigo */}
      <IndiqueUmAmigo regras={regras} />

      {/* f) Últimas movimentações */}
      <section className="space-y-3">
        <p className={ROTULO}>Últimas movimentações</p>
        {historicoVisivel.length === 0 ? (
          <p className="border border-[#4A4B4B] bg-card p-4 text-xs text-[#B1B3B3]">Sem movimentações ainda.</p>
        ) : (
          <div className="divide-y divide-[#4A4B4B] border border-[#4A4B4B] bg-card">
            {historicoVisivel.map((mov) => (
              <div key={mov.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{mov.label}</p>
                  <p className="mt-0.5 text-xs text-[#B1B3B3]">
                    {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {mov.multiplicador_clima ? " · bônus de clima" : ""}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-black ${mov.pontos_final > 0 ? "text-[#4CC38A]" : "text-[#E73C3E]"}`}>
                  {mov.pontos_final > 0 ? "+" : ""}{mov.pontos_final}
                </span>
              </div>
            ))}
          </div>
        )}
        {historico.length > 3 && (
          <button
            type="button"
            onClick={() => setVerHistoricoCompleto((v) => !v)}
            className="min-h-[44px] w-full border border-[#4A4B4B] text-[12px] font-bold uppercase tracking-[0.08em] text-foreground"
          >
            {verHistoricoCompleto ? "Ver menos" : "Ver histórico completo"}
          </button>
        )}
      </section>

      {/* Confirmação de resgate */}
      <Dialog open={!!resgateConfirm} onOpenChange={(o) => !o && setResgateConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar resgate</DialogTitle></DialogHeader>
          {resgateConfirm && (
            <p className="text-sm">
              Usar <strong>{resgateConfirm.custoCalculado} pontos</strong> para resgatar{" "}
              <strong>{resgateConfirm.nome}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResgateConfirm(null)}>Cancelar</Button>
            <Button onClick={() => resgateConfirm && resgatar.mutate(resgateConfirm.id)} disabled={resgatar.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Como funcionam os pontos */}
      {showRegras && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowRegras(false)}>
          <div
            role="dialog"
            aria-label="Como funcionam os pontos"
            className="max-h-[85vh] w-full space-y-5 overflow-y-auto border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase text-foreground">Como funcionam os pontos</h2>
              <button
                type="button"
                onClick={() => setShowRegras(false)}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center border border-[#4A4B4B]"
              >
                <X className="h-4 w-4 text-[#B1B3B3]" />
              </button>
            </div>

            <section className="space-y-2">
              <p className={ROTULO}>Pontos por plano</p>
              <p className="text-xs text-[#B1B3B3]">
                Cada plano multiplica os pontos que você ganha. O custo das recompensas é o mesmo para Start, Power e Pro.
              </p>
              <div className="divide-y divide-[#4A4B4B] border border-[#4A4B4B]">
                {[
                  { rotulo: "Start", chave: "mult_plano_start" },
                  { rotulo: "Power", chave: "mult_plano_power" },
                  { rotulo: "Pro", chave: "mult_plano_pro" },
                  { rotulo: "Consultoria Online", chave: "mult_plano_consultoria" },
                  { rotulo: "Wellhub / Total Pass", chave: "mult_agregador" },
                ].map((l) => (
                  <div key={l.chave} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-foreground">{l.rotulo}</span>
                    <span className="font-black text-foreground">{fmtMult(meuPlano?.multiplicadores?.[l.chave])}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className={ROTULO}>Validade</p>
              <p className="text-xs text-[#B1B3B3]">
                Seus pontos são válidos por 12 meses a partir da última movimentação. Em caso de cancelamento do plano, expiram imediatamente.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}