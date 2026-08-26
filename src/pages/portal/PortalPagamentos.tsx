import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Loader2, AlertCircle, CheckCircle2, Clock, XCircle, Plus, Star, Trash2 } from "lucide-react";
import { CadastrarCartaoDialog } from "@/components/pagamentos/CadastrarCartaoDialog";

function statusInfo(status: string) {
  switch (status) {
    case "pago":
      return { icon: CheckCircle2, cor: "text-emerald-400", bg: "bg-emerald-500/10", label: "Pago" };
    case "pendente":
      return { icon: Clock, cor: "text-muted-foreground", bg: "bg-muted/50", label: "Pendente" };
    case "atrasado":
      return { icon: AlertCircle, cor: "text-destructive", bg: "bg-destructive/10", label: "Atrasado" };
    case "cancelado":
      return { icon: XCircle, cor: "text-muted-foreground", bg: "bg-muted/30", label: "Cancelado" };
    default:
      return { icon: Clock, cor: "text-muted-foreground", bg: "bg-muted/50", label: status };
  }
}

function formaLabel(forma: string) {
  if (!forma || forma === "pendente") return "—";
  if (forma.includes("cartao") || forma.includes("recorrencia")) return "Cartão";
  if (forma.includes("boleto")) return "Boleto";
  if (forma.includes("pix")) return "PIX";
  if (forma.includes("dinheiro")) return "Dinheiro";
  return forma;
}

function vigenciaLabel(v?: string | null) {
  if (v === "anual") return "Anual";
  if (v === "semestral") return "Semestral";
  if (v === "mensal") return "Mensal";
  return v ?? "";
}

function ContratoBloco({ contrato }: { contrato: any }) {
  const isCorrida = contrato.plano_tipo === "corrida" || contrato.atividade === "corrida";

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ["portal-cobrancas", contrato.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("cobrancas")
        .select("id, numero_ciclo, valor, data_vencimento, data_pagamento, status, forma_pagamento, gateway, tid")
        .eq("contrato_id", contrato.id)
        .order("data_vencimento", { ascending: true });
      return data || [];
    },
  });

  const hoje = new Date();
  const totalParcelas = cobrancas.length > 0 ? cobrancas.length : (contrato?.parcelas ?? 1);
  const pagas = cobrancas.filter((c: any) => c.status === "pago").length;
  const atrasadas = cobrancas.filter((c: any) =>
    c.status === "atrasado" ||
    (c.status === "pendente" && new Date(c.data_vencimento) < hoje)
  );
  const proximaCobranca = cobrancas.find((c: any) =>
    c.status === "pendente" && new Date(c.data_vencimento) >= hoje
  );

  return (
    <section className="space-y-4 bg-card/40 border border-border rounded-2xl p-3">
      <div className="flex items-center gap-2 flex-wrap px-1">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase tracking-wide">Ativo</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
          {isCorrida ? "Corrida" : (contrato.plano_tipo ?? "Plano")}
        </span>
        {contrato.vigencia_tipo && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
            {vigenciaLabel(contrato.vigencia_tipo)}
          </span>
        )}
      </div>

      {atrasadas.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-destructive">
              {atrasadas.length === 1 ? "1 cobrança em atraso" : `${atrasadas.length} cobranças em atraso`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entre em contato com a equipe FORTEM para regularizar.
            </p>
          </div>
          <button
            onClick={() => window.open("https://wa.me/555135199451?text=Olá! Preciso regularizar minha situação financeira.", "_blank")}
            className="shrink-0 text-xs font-bold text-[#25D366] border border-[#25D366]/30 px-2 py-1 rounded-lg"
          >
            WhatsApp
          </button>
        </div>
      )}

      {proximaCobranca && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Próxima cobrança</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-black text-lg text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
                R$ {Number(proximaCobranca.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                Vence em {format(parseISO(proximaCobranca.data_vencimento + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {" · "}
                {(() => {
                  const dias = differenceInDays(parseISO(proximaCobranca.data_vencimento + "T12:00:00"), hoje);
                  if (dias === 0) return "hoje";
                  if (dias === 1) return "amanhã";
                  return `em ${dias} dias`;
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Resumo do contrato</p>
        <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{pagas}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pagas</p>
          </div>
          <div className="border-x border-border">
            <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>{totalParcelas}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>
              R$ {Number(contrato.valor_cobrado ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Mensalidade</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] text-muted-foreground">
            {isCorrida ? "Sem controle de créditos" : "Créditos do ciclo conforme seu plano"}
          </p>
          {(contrato.data_inicio || contrato.data_fim) && (
            <p className="text-[10px] text-muted-foreground">
              {contrato.data_inicio ? format(parseISO(contrato.data_inicio + "T12:00:00"), "dd/MM/yyyy") : "—"}
              {" → "}
              {contrato.data_fim ? format(parseISO(contrato.data_fim + "T12:00:00"), "dd/MM/yyyy") : "—"}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${totalParcelas > 0 ? Math.round((pagas / totalParcelas) * 100) : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            {pagas} de {totalParcelas} parcelas pagas
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Histórico</p>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : cobrancas.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {cobrancas.map((c: any, idx: number) => {
              const { icon: Icon, cor, bg } = statusInfo(c.status);
              const numParcela = c.numero_ciclo ?? (idx + 1);
              const isPaga = c.status === "pago";
              const isAtrasada = c.status === "atrasado" ||
                (c.status === "pendente" && new Date(c.data_vencimento) < hoje);
              const isFutura = c.status === "pendente" && new Date(c.data_vencimento) >= hoje;

              return (
                <div key={c.id} className={`flex items-center gap-3 px-4 py-3.5 ${isAtrasada ? "bg-destructive/5" : ""}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className={`w-4 h-4 ${cor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground">
                        Parcela {numParcela}
                        {totalParcelas > 1 && `/${totalParcelas}`}
                      </p>
                      {isPaga && <span className="text-emerald-400 text-xs">✅</span>}
                      {isFutura && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Agendada</span>}
                      {isAtrasada && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold">Em atraso</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPaga && c.data_pagamento
                        ? `Pago em ${format(parseISO(c.data_pagamento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
                        : `Vence ${format(parseISO(c.data_vencimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
                      }
                      {c.forma_pagamento && c.forma_pagamento !== "pendente" && ` · ${formaLabel(c.forma_pagamento)}`}
                    </p>
                  </div>
                  <p className={`text-sm font-black shrink-0 ${isAtrasada ? "text-destructive" : "text-foreground"}`} style={{fontFamily:'Archivo,sans-serif'}}>
                    R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function PortalPagamentos() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cadastroAberto, setCadastroAberto] = useState(false);

  const { cartoes, definirPrincipal, removerCartao } = usePortalCartoes(student?.id);



  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["portal-contratos-pagamentos", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contratos")
        .select("id, plano_tipo, vigencia_tipo, parcelas, valor_cobrado, data_inicio, data_fim, status")
        .eq("aluno_id", student!.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (!student) return null;

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Financeiro</p>
          <h1 className="text-xl font-black text-foreground" style={{fontFamily:'Archivo,sans-serif'}}>Pagamentos</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : contratos.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="text-sm text-muted-foreground">Nenhum contrato ativo.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {contratos.map((c: any) => <ContratoBloco key={c.id} contrato={c} />)}
        </div>
      )}


      {/* ── CARTEIRA ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Meus cartões</p>
          <button
            onClick={() => setCadastroAberto(true)}
            className="flex items-center gap-1 text-xs font-bold text-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {cartoes.length === 0 ? (
            <button
              onClick={() => setCadastroAberto(true)}
              className="w-full px-4 py-4 flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Cadastrar cartão</p>
                <p className="text-xs text-muted-foreground">Para cobranças futuras e renovação automática</p>
              </div>
            </button>
          ) : (
            <div className="divide-y divide-border">
              {cartoes.map((c: any) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${c.is_default ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground capitalize">{c.brand} •••• {c.last4}</p>
                      {c.is_default && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                          <Star className="w-2.5 h-2.5" /> Principal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {String(c.expiration_month).padStart(2,"0")}/{c.expiration_year} · {c.holder_name}
                    </p>
                    {!c.is_default && (
                      <button
                        onClick={() => definirPrincipal.mutate(c.id)}
                        disabled={definirPrincipal.isPending}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary disabled:opacity-50"
                      >
                        <Star className="w-3 h-3" /> Tornar principal
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => removerCartao.mutate(c.id)}
                      disabled={removerCartao.isPending}
                      aria-label="Remover cartão"
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground px-1">
          Não armazenamos o número do cartão — apenas um token seguro via Rede.
        </p>
      </section>

      <p className="text-[10px] text-muted-foreground text-center px-4">
        Notas fiscais são enviadas automaticamente para o seu e-mail cadastrado.
        Dúvidas? Fale com a equipe FORTEM.
      </p>

      <CadastrarCartaoDialog
        open={cadastroAberto}
        onOpenChange={setCadastroAberto}
        alunoId={student.id}
        alunoNome={student.nome}
        origem="portal_aluno"
        onSuccess={() => qc.invalidateQueries({ queryKey: ["portal-cartoes"] })}
      />
    </div>
  );
}
